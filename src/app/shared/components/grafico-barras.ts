import { DecimalPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';

export interface FilaGrafico {
  etiqueta: string;
  valor: number;
}

/**
 * Gráfico de barras horizontales de una sola serie (email 10/03), hecho con HTML y CSS.
 * Cada fila tiene el nombre y el valor como texto, así se lee también sin ver las barras.
 */
@Component({
  selector: 'app-grafico-barras',
  imports: [DecimalPipe],
  template: `
    <figure>
      <figcaption>{{ titulo() }}</figcaption>
      @if (filas().length) {
        <ul class="barras">
          @for (fila of filas(); track fila.etiqueta) {
            <li [title]="fila.etiqueta + ': ' + (fila.valor | number) + ' ' + unidad()">
              <span class="etiqueta">{{ fila.etiqueta }}</span>
              <span class="pista"><span class="barra" [style.width.%]="(fila.valor / maximo()) * 100"></span></span>
              <span class="valor">{{ fila.valor | number }}</span>
            </li>
          }
        </ul>
      } @else {
        <p class="vacio">Sin {{ unidad() }} en este período.</p>
      }
    </figure>
  `,
  styles: `
    figure { margin: 0; }
    figcaption { margin-bottom: 10px; font-weight: 600; }
    .barras { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
    .barras li { display: grid; grid-template-columns: minmax(6rem, 11rem) 1fr 3rem; align-items: center; gap: 10px; font-size: .9rem; }
    .pista { height: 16px; border-left: 1px solid var(--color-borde); }
    /* Una sola serie: todas las barras del mismo color, con el extremo de datos redondeado */
    .barra { display: block; height: 100%; min-width: 2px; background: var(--color-primario); border-radius: 0 4px 4px 0; }
    .barras li:hover .barra { background: var(--color-primario-oscuro); }
    .valor { text-align: right; font-variant-numeric: tabular-nums; }
    @media (max-width: 480px) {
      .barras li { grid-template-columns: 1fr 3rem; row-gap: 2px; }
      .etiqueta { grid-column: 1 / -1; }
    }
  `,
})
export class GraficoBarras {
  readonly titulo = input.required<string>();
  /** Qué se cuenta, en plural: "entradas", "unidades". */
  readonly unidad = input.required<string>();
  /** De mayor a menor. */
  readonly filas = input.required<FilaGrafico[]>();

  protected readonly maximo = computed(() => Math.max(1, ...this.filas().map((fila) => fila.valor)));
}
