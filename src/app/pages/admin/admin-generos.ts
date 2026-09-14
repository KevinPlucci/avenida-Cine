import { Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Genero } from '../../core/models/genero';
import { GenerosService } from '../../core/services/generos.service';
import { mensajeError } from '../../core/utils/errores';
import { ErrorCampo } from '../../shared/components/error-campo';

@Component({
  selector: 'app-admin-generos',
  imports: [ReactiveFormsModule, ErrorCampo],
  template: `
    <div class="tarjeta">
      <h2>Géneros</h2>
      <p class="meta">Cada película puede tener varios géneros. Los clientes los usan para filtrar la cartelera.</p>

      <form class="form-en-linea" [formGroup]="form" (ngSubmit)="crear()">
        <label class="campo">
          <span>Nuevo género</span>
          <input formControlName="nombre" placeholder="Ej: Musical" />
          <app-error-campo [control]="form.controls.nombre" />
        </label>
        <button type="submit" class="btn btn-primario" [disabled]="guardando()">Agregar</button>
      </form>

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
                <th>Nombre</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (genero of generos(); track genero.id) {
                <tr>
                  <td>{{ genero.nombre }}</td>
                  <td class="acciones-tabla">
                    <button type="button" class="btn btn-chico btn-peligro" (click)="eliminar(genero)">Eliminar</button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="2" class="vacio">No hay géneros cargados.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class AdminGeneros implements OnInit {
  private readonly generosService = inject(GenerosService);

  protected readonly generos = signal<Genero[]>([]);
  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly error = signal('');

  protected readonly form = new FormGroup({
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(40)] }),
  });

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  protected async crear(): Promise<void> {
    this.error.set('');
    const nombre = this.form.getRawValue().nombre.trim();
    if (this.form.invalid || !nombre) {
      this.form.markAllAsTouched();
      return;
    }
    this.guardando.set(true);
    try {
      await this.generosService.crear(nombre);
      this.form.reset();
      await this.cargar();
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  protected async eliminar(genero: Genero): Promise<void> {
    if (!confirm(`¿Eliminar el género "${genero.nombre}"? Se quita de todas las películas que lo tengan.`)) return;
    this.error.set('');
    try {
      await this.generosService.eliminar(genero.id);
      this.generos.update((lista) => lista.filter((g) => g.id !== genero.id));
    } catch (e) {
      this.error.set(mensajeError(e));
    }
  }

  private async cargar(): Promise<void> {
    try {
      this.generos.set(await this.generosService.listar());
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }
}
