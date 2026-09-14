import { Component, input, model } from '@angular/core';
import { FILAS, idButaca, numerosPorBloque, ordenarButacas } from '../../core/utils/butacas';

@Component({
  selector: 'app-mapa-butacas',
  template: `
    <div class="contenedor-mapa">
      <div class="mapa">
        <div class="pantalla">Pantalla</div>
        @for (fila of filas; track fila) {
          <div class="fila">
            <span class="letra">{{ fila }}</span>
            @for (bloque of bloques; track $index) {
              <div class="bloque">
                @for (numero of bloque; track numero) {
                  @let id = idButaca(fila, numero);
                  <button
                    type="button"
                    class="butaca"
                    [class.ocupada]="ocupadas().has(id)"
                    [class.seleccionada]="seleccionadas().includes(id)"
                    [disabled]="ocupadas().has(id)"
                    [attr.aria-pressed]="seleccionadas().includes(id)"
                    [attr.aria-label]="'Fila ' + fila + ', butaca ' + numero"
                    [title]="id"
                    (click)="alternar(id)"
                  >{{ numero }}</button>
                }
              </div>
            }
            <span class="letra">{{ fila }}</span>
          </div>
        }
      </div>
    </div>
    <ul class="referencias">
      <li><span class="butaca"></span> Libre</li>
      <li><span class="butaca seleccionada"></span> Seleccionada</li>
      <li><span class="butaca ocupada"></span> Ocupada</li>
    </ul>
  `,
  styles: `
    .contenedor-mapa { overflow-x: auto; margin-top: 16px; padding-bottom: 8px; }
    .mapa { width: max-content; margin: 0 auto; }
    .pantalla { margin: 0 40px 16px; padding: 4px; text-align: center; font-size: .8rem; letter-spacing: .2em; text-transform: uppercase; color: #555; border-top: 4px solid #999; }
    .fila { display: flex; align-items: center; gap: 12px; margin-bottom: 3px; }
    .letra { width: 12px; text-align: center; font-size: .8rem; font-weight: 600; color: #555; }
    .bloque { display: flex; gap: 2px; }
    .butaca { width: 20px; height: 20px; padding: 0; font-size: 8px; line-height: 18px; text-align: center; border: 1px solid #999; border-radius: 4px 4px 2px 2px; background: #fff; color: #444; cursor: pointer; display: inline-block; }
    button.butaca:hover:not(:disabled) { border-color: var(--color-primario); }
    .seleccionada { background: var(--color-primario); border-color: var(--color-primario); color: #fff; }
    .ocupada { background: #cfcfcf; border-color: #cfcfcf; color: transparent; cursor: not-allowed; }
    .referencias { display: flex; flex-wrap: wrap; gap: 16px; list-style: none; padding: 0; margin: 12px 0 0; font-size: .85rem; }
    .referencias li { display: flex; align-items: center; gap: 6px; }
    .referencias .butaca { cursor: default; }
  `,
})
export class MapaButacas {
  readonly ocupadas = input.required<ReadonlySet<string>>();
  readonly seleccionadas = model<string[]>([]);
  readonly maximo = input.required<number>();

  protected readonly filas = FILAS;
  protected readonly bloques = numerosPorBloque();
  protected readonly idButaca = idButaca;

  protected alternar(id: string): void {
    const actuales = this.seleccionadas();
    if (actuales.includes(id)) {
      this.seleccionadas.set(actuales.filter((b) => b !== id));
    } else if (actuales.length < this.maximo()) {
      this.seleccionadas.set(ordenarButacas([...actuales, id]));
    }
  }
}
