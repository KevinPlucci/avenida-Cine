import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Pelicula } from '../../core/models/pelicula';
import { PeliculasService } from '../../core/services/peliculas.service';
import { mensajeError } from '../../core/utils/errores';
import { DuracionPipe } from '../../shared/pipes/duracion.pipe';

@Component({
  selector: 'app-admin-peliculas',
  imports: [RouterLink, DuracionPipe],
  template: `
    <div class="cabecera">
      <h2>Películas</h2>
      <a routerLink="nueva" class="btn btn-primario">Nueva película</a>
    </div>
    <p class="meta">Solo las películas marcadas como "En cartelera" se muestran a los clientes.</p>

    @if (error()) {
      <p class="alerta alerta-error">{{ error() }}</p>
    }

    @if (cargando()) {
      <p class="cargando">Cargando...</p>
    } @else {
      <div class="tabla-contenedor">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Título</th>
              <th>Duración</th>
              <th>Géneros</th>
              <th>En cartelera</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (pelicula of peliculas(); track pelicula.id) {
              <tr>
                <td><img class="miniatura" [src]="pelicula.imagen_url" alt="" /></td>
                <td>{{ pelicula.titulo }}</td>
                <td>{{ pelicula.duracion_min | duracion }}</td>
                <td>{{ nombresGeneros(pelicula) }}</td>
                <td>
                  <input
                    type="checkbox"
                    [checked]="pelicula.en_cartelera"
                    [attr.aria-label]="'En cartelera: ' + pelicula.titulo"
                    (change)="cambiarCartelera(pelicula, $event)"
                  />
                </td>
                <td class="acciones-tabla">
                  <a [routerLink]="[pelicula.id]" class="btn btn-chico">Editar</a>
                  <button type="button" class="btn btn-chico btn-peligro" (click)="eliminar(pelicula)">Eliminar</button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6" class="vacio">No hay películas cargadas.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class AdminPeliculas implements OnInit {
  private readonly peliculasService = inject(PeliculasService);

  protected readonly peliculas = signal<Pelicula[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');

  async ngOnInit(): Promise<void> {
    try {
      this.peliculas.set(await this.peliculasService.listarTodas());
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected nombresGeneros(pelicula: Pelicula): string {
    return pelicula.generos.map((g) => g.nombre).join(', ');
  }

  protected async cambiarCartelera(pelicula: Pelicula, evento: Event): Promise<void> {
    const checkbox = evento.target as HTMLInputElement;
    this.error.set('');
    try {
      await this.peliculasService.cambiarCartelera(pelicula.id, checkbox.checked);
      this.peliculas.update((lista) =>
        lista.map((p) => (p.id === pelicula.id ? { ...p, en_cartelera: checkbox.checked } : p)),
      );
    } catch (e) {
      checkbox.checked = !checkbox.checked;
      this.error.set(mensajeError(e));
    }
  }

  protected async eliminar(pelicula: Pelicula): Promise<void> {
    if (!confirm(`¿Eliminar "${pelicula.titulo}"?`)) return;
    this.error.set('');
    try {
      await this.peliculasService.eliminar(pelicula.id);
      this.peliculas.update((lista) => lista.filter((p) => p.id !== pelicula.id));
    } catch (e) {
      this.error.set(mensajeError(e));
    }
  }
}
