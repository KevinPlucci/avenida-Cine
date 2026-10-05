import { CurrencyPipe, NgClass } from '@angular/common';
import { Component, input, model, output } from '@angular/core';
import { FILA_ACCESIBLE, FILAS, FILAS_VIP, idButaca, ordenarButacas } from '../../core/utils/butacas';

@Component({
  selector: 'app-mapa-butacas',
  imports: [NgClass, CurrencyPipe],
  template: `
    <div class="contenedor-mapa">
      <div class="mapa">
        <div class="pantalla"><span>Pantalla</span></div>
        @for (fila of filas; track fila.letra) {
          <div class="fila" [class.fila-accesible]="fila.accesible">
            <span class="letra">{{ fila.letra }}</span>
            @for (bloque of fila.bloques; track $index) {
              <div class="bloque">
                @for (numero of bloque; track numero) {
                  @let id = idButaca(fila.letra, numero);
                  <button
                    type="button"
                    class="butaca"
                    [ngClass]="{
                      accesible: fila.accesible,
                      vip: fila.vip,
                      ocupada: ocupadas().has(id),
                      seleccionada: seleccionadas().includes(id),
                    }"
                    [disabled]="ocupadas().has(id)"
                    [attr.aria-pressed]="seleccionadas().includes(id)"
                    [attr.aria-label]="'Fila ' + fila.letra + ', butaca ' + numero + (fila.accesible ? ', accesible' : '') + (fila.vip ? ', VIP' : '')"
                    [title]="id"
                    (click)="alternar(id)"
                  >{{ numero }}</button>
                }
              </div>
            }
            <span class="letra">{{ fila.letra }}</span>
          </div>
        }
      </div>
    </div>
    <ul class="referencias">
      <li><span class="butaca"></span> Libre</li>
      <li><span class="butaca seleccionada"></span> Seleccionada</li>
      <li><span class="butaca ocupada"></span> Ocupada</li>
      <li><span class="butaca accesible"></span> Accesible (fila {{ filaAccesible }}, para personas con discapacidad)</li>
      <li>
        <span class="butaca vip"></span> VIP (filas {{ filasVip.join(', ') }}{{ recargoVip() ? ', + ' + (recargoVip() | currency) + ' cada una' : '' }})
      </li>
    </ul>
  `,
  styles: `
    .contenedor-mapa { overflow-x: auto; margin-top: 18px; padding-bottom: 8px; }
    .mapa { width: max-content; margin: 0 auto; }
    .pantalla { position: relative; height: 38px; margin: 0 24px 12px; text-align: center; }
    .pantalla::before { content: ''; position: absolute; inset: 0 0 auto; height: 24px; border-top: 5px solid #8f8a85; border-radius: 50% 50% 0 0 / 100% 100% 0 0; }
    .pantalla span { position: relative; top: 14px; font: 500 .72rem var(--fuente-titulos); letter-spacing: .4em; color: #8f8a85; text-transform: uppercase; }
    .fila { display: flex; align-items: center; gap: 12px; margin-bottom: 3px; }
    /* La fila accesible ocupa el lugar de dos filas (J y K): 40px de butaca + 6px arriba + 3px abajo = 2 filas de 20px y 3 separaciones */
    .fila-accesible { margin-top: 6px; }
    .letra { width: 12px; font: 500 .8rem var(--fuente-titulos); color: #8f8a85; text-align: center; }
    .bloque { display: flex; gap: 2px; }
    .butaca { display: inline-block; width: 20px; height: 20px; padding: 0; font-size: 8px; line-height: 18px; color: #5f5a55; text-align: center; cursor: pointer; background: #fff; border: 1px solid #b9b3ac; border-radius: 5px 5px 2px 2px; transition: background-color .12s, border-color .12s, transform .12s; }
    button.butaca:hover:not(:disabled) { border-color: var(--color-primario); transform: translateY(-1px); }
    /* Una butaca accesible ocupa el ancho de dos: los bloques quedan alineados con el resto de la sala */
    .butaca.accesible { width: 42px; height: 40px; font-size: 10px; line-height: 38px; color: var(--color-accesible); background: var(--color-accesible-suave); border: 1px solid var(--color-accesible); border-radius: 6px; }
    /* Email 10/03: butacas VIP en dorado */
    .butaca.vip { color: #6b4e00; background: var(--color-destacado-suave); border-color: var(--color-dorado); }
    .seleccionada, .butaca.accesible.seleccionada, .butaca.vip.seleccionada { color: #fff; background: var(--color-primario); border-color: var(--color-primario); }
    .ocupada, .butaca.accesible.ocupada, .butaca.vip.ocupada { color: transparent; cursor: not-allowed; background: #d6d1cb; border-color: #d6d1cb; }
    .referencias { display: flex; flex-wrap: wrap; gap: 8px 16px; margin: 12px 0 0; padding: 0; font-size: .85rem; list-style: none; }
    .referencias li { display: flex; align-items: center; gap: 6px; }
    .referencias .butaca { cursor: default; }
    .referencias .butaca.accesible { width: 20px; height: 20px; }
  `,
})
export class MapaButacas {
  readonly ocupadas = input.required<ReadonlySet<string>>();
  readonly seleccionadas = model<string[]>([]);
  readonly maximo = input.required<number>();
  /** Recargo de cada butaca VIP, para mostrarlo en las referencias (email 10/03). */
  readonly recargoVip = input<number | null>(null);
  /** Avisa al componente padre que se intentó elegir más butacas de las permitidas. */
  readonly limiteAlcanzado = output<number>();

  protected readonly filas = FILAS;
  protected readonly filaAccesible = FILA_ACCESIBLE;
  protected readonly filasVip = FILAS_VIP;
  protected readonly idButaca = idButaca;

  protected alternar(id: string): void {
    const actuales = this.seleccionadas();
    if (actuales.includes(id)) {
      this.seleccionadas.set(actuales.filter((b) => b !== id));
    } else if (actuales.length < this.maximo()) {
      this.seleccionadas.set(ordenarButacas([...actuales, id]));
    } else {
      this.limiteAlcanzado.emit(this.maximo());
    }
  }
}
