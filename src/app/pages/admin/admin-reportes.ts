import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ExportarReporteService } from '../../core/services/exportar-reporte.service';
import { PeliculaMasVista, ProductoMasVendido, ReportesService, VentasDia } from '../../core/services/reportes.service';
import { mensajeError } from '../../core/utils/errores';
import { aFechaIso } from '../../core/utils/fechas';
import { GraficoBarras } from '../../shared/components/grafico-barras';

type Periodo = 'semana' | 'treinta' | 'mes' | 'mesAnterior';
type PeriodoGrafico = 'estaSemana' | 'semanaPasada' | 'esteMes' | 'mesPasado';

// El período se elige con un click (email 28/02: nada de calendarios).
const PERIODOS: { valor: Periodo; etiqueta: string }[] = [
  { valor: 'semana', etiqueta: 'Últimos 7 días' },
  { valor: 'treinta', etiqueta: 'Últimos 30 días' },
  { valor: 'mes', etiqueta: 'Este mes' },
  { valor: 'mesAnterior', etiqueta: 'Mes anterior' },
];

// Email 10/03: los gráficos son por semana (de lunes a domingo) y por mes.
const PERIODOS_GRAFICOS: { valor: PeriodoGrafico; etiqueta: string }[] = [
  { valor: 'estaSemana', etiqueta: 'Esta semana' },
  { valor: 'semanaPasada', etiqueta: 'Semana pasada' },
  { valor: 'esteMes', etiqueta: 'Este mes' },
  { valor: 'mesPasado', etiqueta: 'Mes pasado' },
];

const dia = (anio: number, mes: number, numero: number) => new Date(anio, mes, numero);

function rango(periodo: Periodo): { desde: Date; hasta: Date } {
  const hoy = new Date();
  switch (periodo) {
    case 'semana':
      return { desde: dia(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 6), hasta: hoy };
    case 'treinta':
      return { desde: dia(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 29), hasta: hoy };
    case 'mes':
      return { desde: dia(hoy.getFullYear(), hoy.getMonth(), 1), hasta: hoy };
    case 'mesAnterior':
      return { desde: dia(hoy.getFullYear(), hoy.getMonth() - 1, 1), hasta: dia(hoy.getFullYear(), hoy.getMonth(), 0) };
  }
}

function rangoGrafico(periodo: PeriodoGrafico): { desde: Date; hasta: Date } {
  const hoy = new Date();
  const lunes = hoy.getDate() - ((hoy.getDay() + 6) % 7);
  switch (periodo) {
    case 'estaSemana':
      return { desde: dia(hoy.getFullYear(), hoy.getMonth(), lunes), hasta: dia(hoy.getFullYear(), hoy.getMonth(), lunes + 6) };
    case 'semanaPasada':
      return { desde: dia(hoy.getFullYear(), hoy.getMonth(), lunes - 7), hasta: dia(hoy.getFullYear(), hoy.getMonth(), lunes - 1) };
    case 'esteMes':
      return { desde: dia(hoy.getFullYear(), hoy.getMonth(), 1), hasta: dia(hoy.getFullYear(), hoy.getMonth() + 1, 0) };
    case 'mesPasado':
      return { desde: dia(hoy.getFullYear(), hoy.getMonth() - 1, 1), hasta: dia(hoy.getFullYear(), hoy.getMonth(), 0) };
  }
}

@Component({
  selector: 'app-admin-reportes',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, GraficoBarras],
  template: `
    <div class="tarjeta">
      <h2>Ventas por día</h2>
      <p class="meta">
        Cuánto se facturó y cuántas entradas se vendieron cada día. Cada compra cuenta en el día en que se hizo,
        no en el de la función. Las compras canceladas no se cuentan.
      </p>

      <div class="chips filtro-dias">
        @for (opcion of periodos; track opcion.valor) {
          <button
            type="button"
            class="chip"
            [class.activo]="periodo() === opcion.valor"
            [attr.aria-pressed]="periodo() === opcion.valor"
            (click)="elegir(opcion.valor)"
          >
            {{ opcion.etiqueta }}
          </button>
        }
      </div>

      @if (error()) {
        <p class="alerta alerta-error" animate.enter="aparecer">{{ error() }}</p>
      }

      @if (cargando()) {
        <p class="cargando">Cargando...</p>
      } @else if (!error()) {
        <p class="resumen-periodo">
          Del {{ desde() | date: 'd/M/yyyy' }} al {{ hasta() | date: 'd/M/yyyy' }}:
          <strong>{{ totales().facturado | currency }}</strong> facturados y
          <strong>{{ totales().entradas }}</strong> {{ totales().entradas === 1 ? 'entrada vendida' : 'entradas vendidas' }}
          en {{ totales().compras }} {{ totales().compras === 1 ? 'compra' : 'compras' }}.
        </p>

        <!-- Email 10/03: el reporte del período se descarga en PDF o en Excel -->
        <div class="acciones exportar">
          <button type="button" class="btn btn-chico" [disabled]="exportando()" (click)="exportar('pdf')">Exportar a PDF</button>
          <button type="button" class="btn btn-chico" [disabled]="exportando()" (click)="exportar('excel')">Exportar a Excel</button>
        </div>

        <label class="check">
          <input type="checkbox" [checked]="verDiasSinVentas()" (change)="verDiasSinVentas.set(!verDiasSinVentas())" />
          Mostrar también los días sin ventas
        </label>

        <div class="tabla-contenedor">
          <table>
            <thead>
              <tr>
                <th>Día</th>
                <th class="numero">Compras</th>
                <th class="numero">Entradas vendidas</th>
                <th class="numero">Facturado</th>
              </tr>
            </thead>
            <tbody>
              @for (fila of filasVisibles(); track fila.dia) {
                <tr [class.sin-ventas]="!fila.cantidad_compras">
                  <td class="dia">{{ fila.dia | date: "EEE d 'de' MMMM" }}</td>
                  <td class="numero">{{ fila.cantidad_compras }}</td>
                  <td class="numero">{{ fila.entradas_vendidas }}</td>
                  <td class="numero">{{ fila.facturado | currency }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4" class="vacio">No hubo ventas en este período.</td>
                </tr>
              }
            </tbody>
            <tfoot>
              <tr>
                <th>Total</th>
                <th class="numero">{{ totales().compras }}</th>
                <th class="numero">{{ totales().entradas }}</th>
                <th class="numero">{{ totales().facturado | currency }}</th>
              </tr>
            </tfoot>
          </table>
        </div>
      }
    </div>

    <div class="tarjeta">
      <h2>Más vistas y más vendidos</h2>
      <p class="meta">
        Entradas de cada película y unidades de cada producto del candy bar (sueltos y en combos) en las funciones del
        período. Las compras canceladas no se cuentan.
      </p>

      <div class="chips filtro-dias">
        @for (opcion of periodosGraficos; track opcion.valor) {
          <button
            type="button"
            class="chip"
            [class.activo]="periodoGrafico() === opcion.valor"
            [attr.aria-pressed]="periodoGrafico() === opcion.valor"
            (click)="elegirGrafico(opcion.valor)"
          >
            {{ opcion.etiqueta }}
          </button>
        }
      </div>

      @if (errorGraficos()) {
        <p class="alerta alerta-error" animate.enter="aparecer">{{ errorGraficos() }}</p>
      }

      @if (cargandoGraficos()) {
        <p class="cargando">Cargando...</p>
      } @else if (!errorGraficos()) {
        <p class="meta">
          Funciones del {{ desdeGrafico() | date: 'd/M/yyyy' }} al {{ hastaGrafico() | date: 'd/M/yyyy' }}.
        </p>
        @if (productos()[0]; as masVendido) {
          <p class="destacado">
            <span class="meta">Producto más vendido</span>
            <strong>{{ masVendido.producto }}</strong>
            <span>{{ masVendido.unidades | number }} {{ masVendido.unidades === 1 ? 'unidad' : 'unidades' }}</span>
          </p>
        }
        <div class="graficos">
          <app-grafico-barras titulo="Películas más vistas (entradas)" unidad="entradas" [filas]="filasPeliculas()" />
          <app-grafico-barras titulo="Productos más vendidos (unidades)" unidad="unidades" [filas]="filasProductos()" />
        </div>
      }
    </div>
  `,
  styles: `
    .tarjeta > .meta { margin-bottom: 10px; }
    .resumen-periodo { margin: 0 0 12px; }
    .exportar { margin: 0 0 12px; }
    .numero { text-align: right; font-variant-numeric: tabular-nums; }
    .dia::first-letter { text-transform: uppercase; }
    tr.sin-ventas td { color: var(--color-texto-suave); }
    tfoot th { font-size: .95rem; color: var(--color-texto); text-transform: none; letter-spacing: 0; border-bottom: 0; }
    .destacado { display: flex; flex-direction: column; gap: 2px; margin: 14px 0 18px; padding: 10px 14px; background: var(--color-fondo); border-radius: var(--radio); }
    .destacado strong { font-size: 1.4rem; line-height: 1.2; }
    .graficos { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px 32px; margin-top: 12px; }
  `,
})
export class AdminReportes implements OnInit {
  private readonly reportesService = inject(ReportesService);
  private readonly exportarService = inject(ExportarReporteService);

  protected readonly periodos = PERIODOS;
  protected readonly periodo = signal<Periodo>('semana');
  protected readonly desde = computed(() => rango(this.periodo()).desde);
  protected readonly hasta = computed(() => rango(this.periodo()).hasta);
  protected readonly ventas = signal<VentasDia[]>([]);
  protected readonly verDiasSinVentas = signal(false);
  protected readonly cargando = signal(true);
  protected readonly exportando = signal(false);
  protected readonly error = signal('');

  // Gráficos (email 10/03)
  protected readonly periodosGraficos = PERIODOS_GRAFICOS;
  protected readonly periodoGrafico = signal<PeriodoGrafico>('estaSemana');
  protected readonly desdeGrafico = computed(() => rangoGrafico(this.periodoGrafico()).desde);
  protected readonly hastaGrafico = computed(() => rangoGrafico(this.periodoGrafico()).hasta);
  protected readonly peliculas = signal<PeliculaMasVista[]>([]);
  protected readonly productos = signal<ProductoMasVendido[]>([]);
  protected readonly filasPeliculas = computed(() =>
    this.peliculas().map((p) => ({ etiqueta: p.pelicula, valor: p.entradas_vendidas })),
  );
  protected readonly filasProductos = computed(() =>
    this.productos().map((p) => ({ etiqueta: p.producto, valor: p.unidades })),
  );
  protected readonly cargandoGraficos = signal(true);
  protected readonly errorGraficos = signal('');

  /** Del día más reciente al más viejo. Sin ventas se ocultan para no hacer scroll de más (email 28/02). */
  protected readonly filasVisibles = computed(() =>
    [...this.ventas()].reverse().filter((fila) => this.verDiasSinVentas() || fila.cantidad_compras > 0),
  );

  protected readonly totales = computed(() =>
    this.ventas().reduce(
      (total, fila) => ({
        compras: total.compras + fila.cantidad_compras,
        entradas: total.entradas + fila.entradas_vendidas,
        facturado: total.facturado + fila.facturado,
      }),
      { compras: 0, entradas: 0, facturado: 0 },
    ),
  );

  async ngOnInit(): Promise<void> {
    await Promise.all([this.cargar(), this.cargarGraficos()]);
  }

  protected async elegir(periodo: Periodo): Promise<void> {
    this.periodo.set(periodo);
    await this.cargar();
  }

  protected async elegirGrafico(periodo: PeriodoGrafico): Promise<void> {
    this.periodoGrafico.set(periodo);
    await this.cargarGraficos();
  }

  /** Exporta todos los días del período elegido, también los que no tuvieron ventas. */
  protected async exportar(formato: 'pdf' | 'excel'): Promise<void> {
    const reporte = { desde: aFechaIso(this.desde()), hasta: aFechaIso(this.hasta()), dias: this.ventas() };
    this.exportando.set(true);
    try {
      await (formato === 'pdf' ? this.exportarService.pdf(reporte) : this.exportarService.excel(reporte));
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.exportando.set(false);
    }
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    try {
      this.ventas.set(await this.reportesService.ventasPorDia(aFechaIso(this.desde()), aFechaIso(this.hasta())));
    } catch (e) {
      this.ventas.set([]);
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  private async cargarGraficos(): Promise<void> {
    this.cargandoGraficos.set(true);
    this.errorGraficos.set('');
    const desde = aFechaIso(this.desdeGrafico());
    const hasta = aFechaIso(this.hastaGrafico());
    try {
      const [peliculas, productos] = await Promise.all([
        this.reportesService.peliculasMasVistas(desde, hasta),
        this.reportesService.productosMasVendidos(desde, hasta),
      ]);
      this.peliculas.set(peliculas);
      this.productos.set(productos);
    } catch (e) {
      this.peliculas.set([]);
      this.productos.set([]);
      this.errorGraficos.set(mensajeError(e));
    } finally {
      this.cargandoGraficos.set(false);
    }
  }
}
