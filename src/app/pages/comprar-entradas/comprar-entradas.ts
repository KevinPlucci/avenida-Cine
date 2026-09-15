import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { MAX_BUTACAS_POR_COMPRA, MAX_UNIDADES_POR_PRODUCTO, PORCENTAJE_CUPON_BIENVENIDA } from '../../core/constantes';
import { Beneficios } from '../../core/models/compra';
import { FuncionConDetalle } from '../../core/models/funcion';
import { CategoriaConProductos, ItemCarrito, Producto } from '../../core/models/producto';
import { ComprasService } from '../../core/services/compras.service';
import { CuponesService } from '../../core/services/cupones.service';
import { FuncionesService } from '../../core/services/funciones.service';
import { ProductosService } from '../../core/services/productos.service';
import { mensajeError } from '../../core/utils/errores';
import { ErrorCampo } from '../../shared/components/error-campo';
import { MapaButacas } from '../../shared/components/mapa-butacas';
import { MascaraDirective } from '../../shared/directives/mascara.directive';
import { IdiomaPipe } from '../../shared/pipes/idioma.pipe';
import { vencimientoTarjetaValidator } from '../../shared/validators';

@Component({
  selector: 'app-comprar-entradas',
  imports: [
    RouterLink,
    DatePipe,
    CurrencyPipe,
    ReactiveFormsModule,
    IdiomaPipe,
    MapaButacas,
    ErrorCampo,
    MascaraDirective,
  ],
  templateUrl: './comprar-entradas.html',
  styleUrl: './comprar-entradas.css',
})
export class ComprarEntradas implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly funcionesService = inject(FuncionesService);
  private readonly comprasService = inject(ComprasService);
  private readonly productosService = inject(ProductosService);
  private readonly cuponesService = inject(CuponesService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly auth = inject(AuthService);

  protected readonly maximo = MAX_BUTACAS_POR_COMPRA;
  protected readonly maxUnidades = MAX_UNIDADES_POR_PRODUCTO;

  protected readonly funcion = signal<FuncionConDetalle | null>(null);
  protected readonly ocupadas = signal<ReadonlySet<string>>(new Set());
  protected readonly seleccionadas = signal<string[]>([]);
  /** Máximo de butacas que se intentó superar; lo informa el mapa con su output limiteAlcanzado (0 = sin aviso). */
  protected readonly avisoLimite = signal(0);
  protected readonly beneficios = signal<Beneficios | null>(null);
  /** Porcentaje del cupón de bienvenida, para invitar a registrarse a quien compra sin cuenta. */
  protected readonly porcentajeBienvenida = signal(PORCENTAJE_CUPON_BIENVENIDA);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly errorCompra = signal('');
  protected readonly procesando = signal(false);

  // Candy bar (email 30/01): cantidad elegida de cada producto.
  protected readonly categorias = signal<CategoriaConProductos[]>([]);
  protected readonly carrito = signal<Record<number, number>>({});

  private readonly porId = computed(() => {
    const mapa = new Map<number, Producto>();
    for (const categoria of this.categorias()) {
      for (const producto of categoria.productos) mapa.set(producto.id, producto);
    }
    return mapa;
  });

  protected readonly items = computed<ItemCarrito[]>(() =>
    Object.entries(this.carrito())
      .filter(([, cantidad]) => cantidad > 0)
      .map(([id, cantidad]) => ({ producto_id: Number(id), cantidad })),
  );

  protected readonly lineas = computed(() =>
    this.items().map((item) => ({
      producto: this.porId().get(item.producto_id)!,
      cantidad: item.cantidad,
    })),
  );

  // El total que se muestra es orientativo: el importe real lo calcula la base al confirmar.
  protected readonly subtotal = computed(() => (this.funcion()?.precio ?? 0) * this.seleccionadas().length);
  protected readonly subtotalProductos = computed(() =>
    this.lineas().reduce((suma, linea) => suma + linea.producto.precio * linea.cantidad, 0),
  );

  /** Los dos descuentos no se acumulan: se aplica el más alto (la base hace el mismo cálculo). */
  protected readonly descuentoAplicado = computed(() => {
    const beneficios = this.beneficios();
    if (!beneficios) return null;
    const opciones: { porcentaje: number; etiqueta: string }[] = [];
    if (beneficios.primera_compra && !beneficios.primera_compra.usado) {
      opciones.push({ porcentaje: beneficios.primera_compra.porcentaje, etiqueta: 'Cupón primera compra' });
    }
    if (beneficios.mayores) {
      opciones.push({
        porcentaje: beneficios.mayores.porcentaje,
        etiqueta: `Descuento desde los ${beneficios.mayores.edad_minima} años`,
      });
    }
    return opciones.sort((a, b) => b.porcentaje - a.porcentaje)[0] ?? null;
  });

  protected readonly porcentajeDescuento = computed(() => this.descuentoAplicado()?.porcentaje ?? 0);
  /** El descuento se aplica solo sobre las entradas, no sobre el candy bar. */
  protected readonly descuento = computed(() => Math.round(this.subtotal() * this.porcentajeDescuento()) / 100);
  protected readonly total = computed(() => this.subtotal() + this.subtotalProductos() - this.descuento());

  protected readonly form = this.fb.group({
    comprador: this.fb.group({
      nombre: ['', [Validators.required, Validators.maxLength(80)]],
      email: ['', [Validators.required, Validators.email]],
    }),
    // Pago simulado: se validan los datos pero no se procesa ningún cobro.
    pago: this.fb.group({
      titular: ['', [Validators.required, Validators.maxLength(80)]],
      numero: ['', [Validators.required, Validators.pattern(/^(\d{4} ?){3}\d{4}$/)]],
      vencimiento: ['', [Validators.required, vencimientoTarjetaValidator]],
      cvv: ['', [Validators.required, Validators.pattern(/^\d{3,4}$/)]],
    }),
  });

  async ngOnInit(): Promise<void> {
    // Parámetro :id de la ruta /funciones/:id/comprar
    const id = Number(this.route.snapshot.paramMap.get('id'));
    try {
      await this.auth.esperarSesion();
      const [funcion, ocupadas, categorias] = await Promise.all([
        this.funcionesService.obtener(id),
        this.comprasService.butacasOcupadas(id),
        this.productosService.disponiblesPorCategoria(),
      ]);
      if (!funcion?.pelicula) {
        this.error.set('La función no existe o la película ya no está en cartelera.');
        return;
      }
      if (new Date(funcion.inicio) <= new Date()) {
        this.error.set('Esta función ya comenzó. Elegí otro horario.');
        return;
      }
      this.funcion.set(funcion);
      this.ocupadas.set(ocupadas);
      this.categorias.set(categorias);

      if (this.auth.logueado()) {
        // Los datos del comprador se toman del perfil.
        this.form.controls.comprador.disable();
        this.beneficios.set(await this.comprasService.misBeneficios());
      } else {
        const regla = await this.cuponesService.obtenerRegla('primera_compra');
        if (regla?.activo) this.porcentajeBienvenida.set(regla.porcentaje);
      }
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  /** Recibe del mapa (output seleccionadasChange) las butacas elegidas. */
  protected cambiarSeleccion(butacas: string[]): void {
    this.seleccionadas.set(butacas);
    this.avisoLimite.set(0);
  }

  protected cantidad(producto: Producto): number {
    return this.carrito()[producto.id] ?? 0;
  }

  protected sumar(producto: Producto, paso: number): void {
    const cantidad = Math.min(Math.max(this.cantidad(producto) + paso, 0), MAX_UNIDADES_POR_PRODUCTO);
    this.carrito.update((actual) => ({ ...actual, [producto.id]: cantidad }));
  }

  protected vaciarCarrito(): void {
    this.carrito.set({});
  }

  protected async confirmar(): Promise<void> {
    this.errorCompra.set('');
    if (!this.seleccionadas().length) {
      this.errorCompra.set('Elegí al menos una butaca.');
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const funcionId = this.funcion()!.id;
    const comprador = this.auth.logueado() ? null : this.form.controls.comprador.getRawValue();
    this.procesando.set(true);
    try {
      const codigo = await this.comprasService.comprar(
        funcionId,
        this.seleccionadas(),
        comprador,
        this.items(),
      );
      await this.router.navigate(['/compras', codigo], { state: { recienComprada: true } });
    } catch (e) {
      this.errorCompra.set(mensajeError(e));
      // Puede que otra persona haya comprado alguna de las butacas mientras tanto.
      const ocupadas = await this.comprasService.butacasOcupadas(funcionId);
      this.ocupadas.set(ocupadas);
      this.seleccionadas.update((butacas) => butacas.filter((b) => !ocupadas.has(b)));
    } finally {
      this.procesando.set(false);
    }
  }
}
