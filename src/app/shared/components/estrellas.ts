import { Component, computed, input, model } from '@angular/core';

/** Muestra una calificación de 1 a 5 estrellas. Con editable=true permite elegirla. */
@Component({
  selector: 'app-estrellas',
  template: `
    @if (editable()) {
      <span class="estrellas" role="radiogroup" aria-label="Calificación">
        @for (n of posiciones; track n) {
          <button
            type="button"
            role="radio"
            [class.llena]="n <= valor()"
            [attr.aria-checked]="n === valor()"
            [attr.aria-label]="n + (n === 1 ? ' estrella' : ' estrellas')"
            (click)="valor.set(n)"
          >★</button>
        }
      </span>
    } @else {
      <span class="estrellas" role="img" [attr.aria-label]="valor() + ' de 5 estrellas'">
        @for (n of posiciones; track n) {
          <span [class.llena]="n <= redondeado()">★</span>
        }
      </span>
    }
  `,
  styles: `
    .estrellas { display: inline-flex; gap: 1px; color: #c9c9c9; line-height: 1; vertical-align: middle; }
    .llena { color: #d4a017; }
    button { background: none; border: 0; padding: 0 2px; font-size: 1.6rem; cursor: pointer; color: inherit; }
    button.llena { color: #d4a017; }
  `,
})
export class Estrellas {
  readonly valor = model(0);
  readonly editable = input(false);

  protected readonly posiciones = [1, 2, 3, 4, 5];
  protected readonly redondeado = computed(() => Math.round(this.valor()));
}
