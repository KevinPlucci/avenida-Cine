import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PeliculaCartelera } from '../../core/models/pelicula';
import { ImagenRespaldoDirective } from '../directives/imagen-respaldo.directive';
import { DuracionPipe } from '../pipes/duracion.pipe';
import { Estrellas } from './estrellas';

@Component({
  selector: 'app-pelicula-card',
  imports: [RouterLink, DuracionPipe, Estrellas, ImagenRespaldoDirective],
  template: `
    <a class="card" [routerLink]="['/peliculas', pelicula().id]" animate.enter="aparecer">
      <div class="poster">
        <img [src]="pelicula().imagen_url" [alt]="'Póster de ' + pelicula().titulo" loading="lazy" appImagenRespaldo />
        @if (posicion(); as numero) {
          <span class="posicion">#{{ numero }}</span>
        }
      </div>
      <div class="cuerpo">
        <h3>{{ pelicula().titulo }}</h3>
        <p class="meta">{{ pelicula().duracion_min | duracion }}</p>
        <p class="meta">{{ generos() }}</p>
        @if (pelicula().promedio !== null) {
          <p class="puntaje">
            <app-estrellas [valor]="pelicula().promedio ?? 0" />
            <span class="meta">{{ pelicula().promedio }} ({{ pelicula().cantidad_resenias }})</span>
          </p>
        } @else {
          <p class="meta">Sin reseñas</p>
        }
        @if (mostrarVentas()) {
          <p class="ventas">{{ pelicula().entradas_vendidas }} entradas vendidas</p>
        }
      </div>
    </a>
  `,
  styles: `
    .card { display: flex; flex-direction: column; height: 100%; overflow: hidden; color: inherit; text-decoration: none; background: #fff; border-radius: 10px; box-shadow: var(--sombra); transition: transform .18s ease, box-shadow .18s ease; }
    .card:hover { transform: translateY(-3px); box-shadow: 0 12px 26px rgb(0 0 0 / 14%); }
    .poster { position: relative; aspect-ratio: 2 / 3; overflow: hidden; background: #2b2a29; }
    img { width: 100%; height: 100%; object-fit: cover; transition: transform .35s ease; }
    .card:hover img { transform: scale(1.04); }
    .posicion { position: absolute; top: 10px; left: 10px; padding: 2px 10px; font: 600 1.05rem/1.4 var(--fuente-titulos); color: #fff; background: rgb(21 20 20 / 88%); border-left: 3px solid var(--color-dorado); border-radius: 4px; }
    .cuerpo { padding: 10px 12px 14px; }
    h3 { margin: 0 0 4px; font: 500 1.08rem/1.25 var(--fuente-titulos); letter-spacing: .01em; }
    .puntaje { display: flex; align-items: center; gap: 6px; margin: 6px 0 0; font-size: .85rem; }
    .ventas { margin: 8px 0 0; font-size: .85rem; font-weight: 600; color: var(--color-primario); }
  `,
})
export class PeliculaCard {
  readonly pelicula = input.required<PeliculaCartelera>();
  /** Posición en el ranking de más vendidas (opcional). */
  readonly posicion = input<number | null>(null);
  readonly mostrarVentas = input(false);

  protected readonly generos = computed(() =>
    this.pelicula()
      .generos.map((g) => g.nombre)
      .join(', '),
  );
}
