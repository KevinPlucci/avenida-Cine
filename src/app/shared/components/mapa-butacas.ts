import { Component, input, model, output } from '@angular/core';
import { FILAS, idButaca, numerosPorBloque, ordenarButacas } from '../../core/utils/butacas';

@Component({
  selector: 'app-mapa-butacas',
  template: `
    <div class="contenedor-mapa">
      <div class="mapa">
        <div class="pantalla"><span>Pantalla</span></div>
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
    .contenedor-mapa { overflow-x: auto; margin-top: 18px; padding-bottom: 8px; }
    .mapa { width: max-content; margin: 0 auto; }
    .pantalla { position: relative; height: 38px; margin: 0 24px 12px; text-align: center; }
    .pantalla::before { content: ''; position: absolute; inset: 0 0 auto; height: 24px; border-top: 5px solid #8f8a85; border-radius: 50% 50% 0 0 / 100% 100% 0 0; }
    .pantalla span { position: relative; top: 14px; font: 500 .72rem var(--fuente-titulos); letter-spacing: .4em; color: #8f8a85; text-transform: uppercase; }
    .fila { display: flex; align-items: center; gap: 12px; margin-bottom: 3px; }
    .letra { width: 12px; font: 500 .8rem var(--fuente-titulos); color: #8f8a85; text-align: center; }
    .bloque { display: flex; gap: 2px; }
    .butaca { display: inline-block; width: 20px; height: 20px; padding: 0; font-size: 8px; line-height: 18px; color: #5f5a55; text-align: center; cursor: pointer; background: #fff; border: 1px solid #b9b3ac; border-radius: 5px 5px 2px 2px; transition: background-color .12s, border-color .12s, transform .12s; }
    button.butaca:hover:not(:disabled) { border-color: var(--color-primario); transform: translateY(-1px); }
    .seleccionada { color: #fff; background: var(--color-primario); border-color: var(--color-primario); }
    .ocupada { color: transparent; cursor: not-allowed; background: #d6d1cb; border-color: #d6d1cb; }
    .referencias { display: flex; flex-wrap: wrap; gap: 16px; margin: 12px 0 0; padding: 0; font-size: .85rem; list-style: none; }
    .referencias li { display: flex; align-items: center; gap: 6px; }
    .referencias .butaca { cursor: default; }
  `,
})
export class MapaButacas {
  readonly ocupadas = input.required<ReadonlySet<string>>();
  readonly seleccionadas = model<string[]>([]);
  readonly maximo = input.required<number>();
  /** Avisa al componente padre que se intentó elegir más butacas de las permitidas. */
  readonly limiteAlcanzado = output<number>();

  protected readonly filas = FILAS;
  protected readonly bloques = numerosPorBloque();
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
