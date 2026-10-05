import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { Actividad, ActividadService, TipoActividad } from '../../core/services/actividad.service';
import { mensajeError } from '../../core/utils/errores';

const CANTIDAD = 200;

const FILTROS: { valor: TipoActividad | null; etiqueta: string }[] = [
  { valor: null, etiqueta: 'Todo' },
  { valor: 'funcion', etiqueta: 'Funciones' },
  { valor: 'precio', etiqueta: 'Precios' },
  { valor: 'validacion', etiqueta: 'Validación de QR' },
];

/** Registro de actividad (email 10/03): quién creó una función, quién cambió un precio, quién validó un QR. */
@Component({
  selector: 'app-admin-actividad',
  imports: [DatePipe],
  template: `
    <div class="tarjeta">
      <h2>Registro de actividad</h2>
      <p class="meta">
        Quién creó, cambió o eliminó funciones, quién cambió precios y quién validó entradas o entregó productos,
        con fecha y hora. Se muestran los últimos {{ cantidad }} movimientos.
      </p>

      <div class="chips filtro-dias">
        @for (filtro of filtros; track filtro.etiqueta) {
          <button
            type="button"
            class="chip"
            [class.activo]="tipo() === filtro.valor"
            [attr.aria-pressed]="tipo() === filtro.valor"
            (click)="filtrar(filtro.valor)"
          >
            {{ filtro.etiqueta }}
          </button>
        }
      </div>

      @if (error()) {
        <p class="alerta alerta-error" animate.enter="aparecer">{{ error() }}</p>
      }

      @if (cargando()) {
        <p class="cargando">Cargando...</p>
      } @else if (!error()) {
        <div class="tabla-contenedor">
          <table>
            <thead>
              <tr>
                <th>Fecha y hora</th>
                <th>Usuario</th>
                <th>Qué hizo</th>
              </tr>
            </thead>
            <tbody>
              @for (linea of lineas(); track linea.id) {
                <tr>
                  <td class="fecha">{{ linea.creado_en | date: 'dd/MM/yyyy HH:mm:ss' }}</td>
                  <td>{{ linea.usuario }}</td>
                  <td>{{ linea.detalle }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="3" class="vacio">Todavía no hay actividad registrada.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: `
    .fecha { white-space: nowrap; font-variant-numeric: tabular-nums; }
  `,
})
export class AdminActividad implements OnInit {
  private readonly actividadService = inject(ActividadService);

  protected readonly cantidad = CANTIDAD;
  protected readonly filtros = FILTROS;
  protected readonly tipo = signal<TipoActividad | null>(null);
  protected readonly lineas = signal<Actividad[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  protected async filtrar(tipo: TipoActividad | null): Promise<void> {
    this.tipo.set(tipo);
    await this.cargar();
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    try {
      this.lineas.set(await this.actividadService.ultimas(this.tipo(), CANTIDAD));
    } catch (e) {
      this.lineas.set([]);
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }
}
