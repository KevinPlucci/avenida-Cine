import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PeliculaVista } from '../../core/models/pelicula';
import { ComprasService } from '../../core/services/compras.service';
import { mensajeError } from '../../core/utils/errores';
import { Estrellas } from '../../shared/components/estrellas';
import { ImagenRespaldoDirective } from '../../shared/directives/imagen-respaldo.directive';

/** Historial visual de lo que vio el usuario (email 08/03): póster, fechas y su calificación. */
@Component({
  selector: 'app-mis-peliculas',
  imports: [RouterLink, DatePipe, Estrellas, ImagenRespaldoDirective],
  template: `
    <h1>Mis películas</h1>
    <p class="meta intro">Las películas que viste en el cine, con la fecha de cada función y tu calificación.</p>

    @if (cargando()) {
      <p class="cargando">Cargando...</p>
    } @else if (error()) {
      <p class="alerta alerta-error">{{ error() }}</p>
    } @else {
      <div class="grid-peliculas">
        @for (pelicula of peliculas(); track pelicula.pelicula_id) {
          <article class="vista" animate.enter="aparecer">
            <img [src]="pelicula.imagen_url" [alt]="'Póster de ' + pelicula.titulo" loading="lazy" appImagenRespaldo />
            <div class="cuerpo">
              <h3>{{ pelicula.titulo }}</h3>
              <p class="meta">
                {{ pelicula.fechas.length === 1 ? 'La viste el' : 'La viste ' + pelicula.fechas.length + ' veces:' }}
                @for (fecha of pelicula.fechas; track fecha; let ultima = $last) {
                  {{ fecha | date: 'dd/MM/yyyy' }}{{ ultima ? '' : ',' }}
                }
              </p>
              @if (pelicula.estrellas) {
                <p class="calificacion">
                  <app-estrellas [valor]="pelicula.estrellas" />
                  <span class="meta">Tu calificación</span>
                </p>
              } @else {
                <a [routerLink]="['/peliculas', pelicula.pelicula_id]">Calificar</a>
              }
            </div>
          </article>
        } @empty {
          <p class="vacio">
            Todavía no hay películas en tu historial. Aparecen acá cuando termina la función de una de tus compras.
          </p>
        }
      </div>
    }
  `,
  styles: `
    .intro { margin-bottom: 18px; }
    .vista { display: flex; flex-direction: column; overflow: hidden; background: #fff; border-radius: 10px; box-shadow: var(--sombra); }
    img { width: 100%; aspect-ratio: 2 / 3; object-fit: cover; background: #2b2a29; }
    .cuerpo { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px 14px; }
    h3 { margin: 0; font: 500 1.08rem/1.25 var(--fuente-titulos); }
    .calificacion { display: flex; align-items: center; gap: 6px; margin: 0; }
  `,
})
export class MisPeliculas implements OnInit {
  private readonly comprasService = inject(ComprasService);

  protected readonly peliculas = signal<PeliculaVista[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');

  async ngOnInit(): Promise<void> {
    try {
      this.peliculas.set(await this.comprasService.misPeliculas());
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }
}
