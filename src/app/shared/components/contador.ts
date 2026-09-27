import { Component, input, output } from '@angular/core';

/**
 * Fila con un contador − / cantidad / +.
 * Lo que se escribe adentro de <app-contador> (nombre, precio, descripción) se proyecta a la izquierda
 * con <ng-content>, y los botones quedan a la derecha. El componente padre decide qué hacer con cada cambio.
 * Se usa en la compra (productos, combos y canje de puntos) y al armar un combo en el panel.
 */
@Component({
  selector: 'app-contador',
  template: `
    <div class="detalle"><ng-content /></div>
    <div class="botones">
      <button
        type="button"
        class="btn btn-chico"
        [disabled]="cantidad() <= 0"
        [attr.aria-label]="etiquetaQuitar()"
        (click)="cambio.emit(-1)"
      >
        −
      </button>
      <span class="cantidad">{{ cantidad() }}</span>
      <button
        type="button"
        class="btn btn-chico"
        [disabled]="!puedeSumar()"
        [attr.aria-label]="etiquetaAgregar()"
        (click)="cambio.emit(1)"
      >
        +
      </button>
    </div>
  `,
  styles: `
    :host { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; justify-content: space-between; }
    .detalle { min-width: 0; }
    .botones { display: flex; gap: 8px; align-items: center; }
    .cantidad { min-width: 2ch; font-variant-numeric: tabular-nums; text-align: center; }
  `,
})
export class Contador {
  readonly cantidad = input.required<number>();
  /** Si se puede sumar una unidad más (límite de cantidad, butacas libres o puntos). */
  readonly puedeSumar = input(true);
  readonly etiquetaQuitar = input.required<string>();
  readonly etiquetaAgregar = input.required<string>();
  /** Avisa si se tocó + (1) o − (-1). */
  readonly cambio = output<number>();
}
