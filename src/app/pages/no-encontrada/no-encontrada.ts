import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Se muestra para cualquier dirección que no coincide con una ruta (ruta comodín **). */
@Component({
  selector: 'app-no-encontrada',
  imports: [RouterLink],
  template: `
    <div class="tarjeta no-encontrada">
      <p class="codigo">404</p>
      <h1>Página no encontrada</h1>
      <p class="meta">La dirección que buscás no existe o cambió de lugar.</p>
      <div class="acciones">
        <a routerLink="/" class="btn btn-primario">Ir a la cartelera</a>
      </div>
    </div>
  `,
  styles: `
    .no-encontrada { max-width: 520px; margin: 40px auto; text-align: center; }
    .codigo { margin: 0; font: 600 5rem/1 var(--fuente-titulos); letter-spacing: .04em; color: var(--color-primario); }
    .acciones { justify-content: center; margin-top: 18px; }
  `,
})
export class NoEncontrada {}
