import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PeliculaCartelera } from '../../core/models/pelicula';
import { DuracionPipe } from '../pipes/duracion.pipe';
import { Estrellas } from './estrellas';

@Component({
  selector: 'app-pelicula-card',
  imports: [RouterLink, DuracionPipe, Estrellas],
  template: `
    <a class="card" [routerLink]="['/peliculas', pelicula().id]">
      <img [src]="pelicula().imagen_url" [alt]="'Póster de ' + pelicula().titulo" loading="lazy" />
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
    .card { display: flex; flex-direction: column; height: 100%; background: #fff; border: 1px solid var(--color-borde); border-radius: var(--radio); overflow: hidden; color: inherit; text-decoration: none; }
    .card:hover { border-color: #aaa; }
    img { width: 100%; aspect-ratio: 2 / 3; object-fit: cover; background: #ddd; }
    .cuerpo { padding: 10px 12px 12px; }
    h3 { font-size: 1rem; margin: 0 0 4px; }
    .puntaje { display: flex; align-items: center; gap: 6px; margin: 4px 0 0; font-size: .85rem; }
    .ventas { margin: 6px 0 0; font-size: .85rem; font-weight: 600; color: var(--color-primario); }
  `,
})
export class PeliculaCard {
  readonly pelicula = input.required<PeliculaCartelera>();
  readonly mostrarVentas = input(false);

  protected readonly generos = computed(() =>
    this.pelicula()
      .generos.map((g) => g.nombre)
      .join(', '),
  );
}
