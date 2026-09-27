import { CurrencyPipe, DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { MAX_BUTACAS_POR_COMPRA, MAX_UNIDADES_POR_PRODUCTO, PORCENTAJE_CUPON_BIENVENIDA } from '../../core/constantes';
import { Beneficios, Comprador } from '../../core/models/compra';
import { FuncionConDetalle } from '../../core/models/funcion';
import { CategoriaConProductos, Combo, contenidoCombo, ItemCarrito, ItemCombo, Producto } from '../../core/models/producto';
import { Canje, Recompensa } from '../../core/models/puntos';
import { CombosService } from '../../core/services/combos.service';
import { ComprasService } from '../../core/services/compras.service';
import { CuponesService } from '../../core/services/cupones.service';
import { PuntosService } from '../../core/services/puntos.service';
import { FuncionesService } from '../../core/services/funciones.service';
import { ProductosService } from '../../core/services/productos.service';
import { esAccesible, FILA_ACCESIBLE } from '../../core/utils/butacas';
import { mensajeError } from '../../core/utils/errores';
import { aniosHastaHoy, DIAS_DEL_MES, edadCumplida, fechaDeListas, MESES } from '../../core/utils/fechas';
import { Contador } from '../../shared/components/contador';
import { ErrorCampo } from '../../shared/components/error-campo';
import { MapaButacas } from '../../shared/components/mapa-butacas';
import { MascaraDirective } from '../../shared/directives/mascara.directive';
import { IdiomaPipe } from '../../shared/pipes/idioma.pipe';
import { RestriccionPipe } from '../../shared/pipes/restriccion.pipe';
import { edadMinimaValidator, fechaNacimientoValidator, vencimientoTarjetaValidator } from '../../shared/validators';

@Component({
  selector: 'app-comprar-entradas',
  imports: [
    RouterLink,
    DatePipe,
    CurrencyPipe,
    DecimalPipe,
    PercentPipe,
    ReactiveFormsModule,
    IdiomaPipe,
    RestriccionPipe,
    MapaButacas,
    Contador,
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
  private readonly combosService = inject(CombosService);
  private readonly puntosService = inject(PuntosService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly auth = inject(AuthService);

  protected readonly maximo = MAX_BUTACAS_POR_COMPRA;
  protected readonly maxUnidades = MAX_UNIDADES_POR_PRODUCTO;
  protected readonly filaAccesible = FILA_ACCESIBLE;
  protected readonly dias = DIAS_DEL_MES;
  protected readonly meses = MESES;
  protected readonly anios = aniosHastaHoy(101);

  protected readonly funcion = signal<FuncionConDetalle | null>(null);
  protected readonly ocupadas = signal<ReadonlySet<string>>(new Set());
  protected readonly seleccionadas = signal<string[]>([]);
  /** Máximo de butacas que se intentó superar; lo informa el mapa con su output limiteAlcanzado (0 = sin aviso). */
  protected readonly avisoLimite = signal(0);
  /** Butacas elegidas que compró otra persona mientras tanto (tiempo real, email 12/02). */
  protected readonly butacasPerdidas = signal<string[]>([]);
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
  /** Categoría que se está mirando; si no se eligió ninguna se muestra la primera. */
  protected readonly categoriaElegida = signal<number | null>(null);
  protected readonly categoriaVisible = computed<CategoriaConProductos | null>(() => {
    const categorias = this.categorias();
    return categorias.find((c) => c.id === this.categoriaElegida()) ?? categorias[0] ?? null;
  });
  /** Si el catálogo no carga se avisa, pero se pueden comprar las entradas igual. */
  protected readonly candyNoDisponible = signal(false);

  // Combos (email 03/03): cantidad elegida de cada uno. Cada combo usa una de las butacas elegidas.
  protected readonly combos = signal<Combo[]>([]);
  protected readonly combosElegidos = signal<Record<number, number>>({});
  protected readonly contenidoCombo = contenidoCombo;
  protected readonly lineasCombos = computed(() =>
    this.combos()
      .filter((combo) => this.cantidadCombo(combo) > 0)
      .map((combo) => ({ combo, cantidad: this.cantidadCombo(combo) })),
  );
  protected readonly totalCombos = computed(() => this.lineasCombos().reduce((total, linea) => total + linea.cantidad, 0));
  protected readonly subtotalCombos = computed(() =>
    this.lineasCombos().reduce((total, linea) => total + linea.combo.precio * linea.cantidad, 0),
  );

  // Programa de puntos (email 03/03): saldo del usuario y lo que elige canjear en esta compra.
  protected readonly saldoPuntos = signal<number | null>(null);
  protected readonly recompensas = signal<Recompensa[]>([]);
  protected readonly entradasConPuntos = signal(0);
  protected readonly productosConPuntos = signal<Record<number, number>>({});
  protected readonly puntosEntrada = computed(
    () => this.recompensas().find((r) => r.tipo === 'entrada' && r.activa)?.puntos ?? null,
  );
  private readonly puntosPorProducto = computed(
    () => new Map(this.recompensas().filter((r) => r.producto_id && r.activa).map((r) => [r.producto_id!, r.puntos])),
  );

  /** Edad mínima de la película (email 12/02): 0 es apta para todo público. */
  protected readonly restriccion = computed(() => this.funcion()?.pelicula?.restriccion_edad ?? 0);
  /** Un usuario registrado menor de la edad indicada no puede comprar: se avisa antes de elegir butacas. */
  protected readonly edadInsuficiente = computed(() => {
    const perfil = this.auth.perfil();
    return this.restriccion() > 0 && !!perfil && edadCumplida(perfil.fecha_nacimiento) < this.restriccion();
  });
  protected readonly hayAccesibles = computed(() => this.seleccionadas().some(esAccesible));

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

  /** Productos del carrito que se pueden pagar con puntos. */
  protected readonly lineasCanjeables = computed(() =>
    this.lineas()
      .filter((linea) => this.puntosPorProducto().has(linea.producto.id))
      .map((linea) => ({ ...linea, puntos: this.puntosPorProducto().get(linea.producto.id)! })),
  );
  /** El canje se ofrece solo si el saldo alcanza para alguna recompensa, así no ocupa lugar de más. */
  protected readonly puedeCanjear = computed(() => {
    const costos = [this.puntosEntrada(), ...this.lineasCanjeables().map((linea) => linea.puntos)].filter(
      (costo): costo is number => costo !== null,
    );
    return this.saldoPuntos() !== null && costos.some((costo) => (this.saldoPuntos() ?? 0) >= costo);
  });
  protected readonly puntosUsados = computed(
    () =>
      this.entradasConPuntos() * (this.puntosEntrada() ?? 0) +
      Object.entries(this.productosConPuntos()).reduce(
        (total, [id, cantidad]) => total + cantidad * (this.puntosPorProducto().get(Number(id)) ?? 0),
        0,
      ),
  );
  protected readonly puntosRestantes = computed(() => (this.saldoPuntos() ?? 0) - this.puntosUsados());

  /** Butacas que todavía no van en un combo ni se canjean con puntos. */
  protected readonly butacasLibres = computed(
    () => this.seleccionadas().length - this.totalCombos() - this.entradasConPuntos(),
  );
  protected readonly entradasPagas = computed(() => Math.max(this.butacasLibres(), 0));

  // El total que se muestra es orientativo: el importe real lo calcula la base al confirmar.
  protected readonly subtotal = computed(() => (this.funcion()?.precio ?? 0) * this.entradasPagas());
  protected readonly subtotalProductos = computed(() =>
    this.lineas().reduce(
      (suma, linea) => suma + linea.producto.precio * (linea.cantidad - this.canjeados(linea.producto)),
      0,
    ),
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
        etiqueta: `Descuento para mayores de ${beneficios.mayores.edad_minima} años`,
      });
    }
    return opciones.sort((a, b) => b.porcentaje - a.porcentaje)[0] ?? null;
  });

  protected readonly porcentajeDescuento = computed(() => this.descuentoAplicado()?.porcentaje ?? 0);
  /** El descuento se aplica solo sobre las entradas que se pagan aparte, no sobre combos ni candy bar. */
  protected readonly descuento = computed(() => Math.round(this.subtotal() * this.porcentajeDescuento()) / 100);
  protected readonly total = computed(
    () => this.subtotal() + this.subtotalProductos() + this.subtotalCombos() - this.descuento(),
  );
  /** 1 punto por cada peso pagado, solo con cuenta (la base hace el mismo cálculo). */
  protected readonly puntosAGanar = computed(() => (this.auth.logueado() ? Math.floor(this.total()) : 0));

  protected readonly form = this.fb.group({
    comprador: this.fb.group({
      nombre: ['', [Validators.required, Validators.maxLength(80)]],
      email: ['', [Validators.required, Validators.email]],
      // Solo se usa si la película tiene restricción de edad: sin cuenta no hay fecha de nacimiento.
      nacimiento: this.fb.group({
        dia: ['', Validators.required],
        mes: ['', Validators.required],
        anio: ['', Validators.required],
      }),
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
      // El candy bar es opcional: si no carga, igual se pueden comprar las entradas.
      const [funcion, ocupadas, categorias, combos] = await Promise.all([
        this.funcionesService.obtener(id),
        this.comprasService.butacasOcupadas(id),
        this.productosService.disponiblesPorCategoria().catch(() => null),
        this.combosService.disponibles().catch(() => [] as Combo[]),
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
      this.escucharVentas(id);
      if (categorias) {
        this.categorias.set(categorias);
      } else {
        this.candyNoDisponible.set(true);
      }
      this.combos.set(combos);

      const nacimiento = this.form.controls.comprador.controls.nacimiento;
      if (this.restriccion() > 0) {
        nacimiento.setValidators([fechaNacimientoValidator, edadMinimaValidator(this.restriccion())]);
      } else {
        nacimiento.disable();
      }

      if (this.auth.logueado()) {
        // Los datos del comprador se toman del perfil.
        this.form.controls.comprador.disable();
        const [beneficios, puntos, recompensas] = await Promise.all([
          this.comprasService.misBeneficios(),
          // Si los puntos no cargan, se puede comprar igual: solo no se ofrece el canje.
          this.puntosService.misPuntos().catch(() => null),
          this.puntosService.recompensas().catch(() => [] as Recompensa[]),
        ]);
        this.beneficios.set(beneficios);
        this.saldoPuntos.set(puntos?.saldo ?? null);
        this.recompensas.set(recompensas);
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
    this.butacasPerdidas.set([]);
    this.ajustarACantidades();
  }

  /** Marca al instante las butacas que compra otra persona y deja de escuchar al salir de la pantalla. */
  private escucharVentas(funcionId: number): void {
    const dejarDeEscuchar = this.comprasService.escucharVentas(
      funcionId,
      (butaca) => this.marcarOcupadas(new Set([...this.ocupadas(), butaca])),
      async () => {
        // Al conectarse (o reconectarse) se vuelve a leer lo vendido, por si algo se compró mientras tanto.
        try {
          this.marcarOcupadas(await this.comprasService.butacasOcupadas(funcionId));
        } catch {
          // Si falla, el mapa sigue con lo que tenía; la base igual rechaza una butaca ya vendida.
        }
      },
    );
    this.destroyRef.onDestroy(dejarDeEscuchar);
  }

  private marcarOcupadas(ocupadas: ReadonlySet<string>): void {
    this.ocupadas.set(ocupadas);
    const perdidas = this.seleccionadas().filter((b) => ocupadas.has(b));
    if (perdidas.length) {
      this.seleccionadas.update((butacas) => butacas.filter((b) => !ocupadas.has(b)));
      this.butacasPerdidas.set(perdidas);
      this.ajustarACantidades();
    }
  }

  /**
   * Si se quitan butacas o productos, los combos y los canjes no pueden quedar por encima:
   * primero se quitan las entradas con puntos y después los combos.
   */
  private ajustarACantidades(): void {
    let sobrantes = -this.butacasLibres();
    if (sobrantes > 0) {
      const quitar = Math.min(sobrantes, this.entradasConPuntos());
      this.entradasConPuntos.update((n) => n - quitar);
      sobrantes -= quitar;
    }
    if (sobrantes > 0) {
      const elegidos = { ...this.combosElegidos() };
      for (const id of Object.keys(elegidos)) {
        const quitar = Math.min(sobrantes, elegidos[Number(id)]);
        elegidos[Number(id)] -= quitar;
        sobrantes -= quitar;
      }
      this.combosElegidos.set(elegidos);
    }
    this.productosConPuntos.update((canje) =>
      Object.fromEntries(Object.entries(canje).map(([id, n]) => [id, Math.min(n, this.carrito()[Number(id)] ?? 0)])),
    );
  }

  protected cantidadCombo(combo: Combo): number {
    return this.combosElegidos()[combo.id] ?? 0;
  }

  protected sumarCombo(combo: Combo, paso: number): void {
    if (paso > 0 && this.butacasLibres() <= 0) return;
    const cantidad = Math.max(this.cantidadCombo(combo) + paso, 0);
    this.combosElegidos.update((actual) => ({ ...actual, [combo.id]: cantidad }));
  }

  protected sumarEntradaConPuntos(paso: number): void {
    if (paso > 0 && (this.butacasLibres() <= 0 || this.puntosRestantes() < (this.puntosEntrada() ?? 0))) return;
    this.entradasConPuntos.update((n) => Math.max(n + paso, 0));
  }

  protected canjeados(producto: Producto): number {
    return this.productosConPuntos()[producto.id] ?? 0;
  }

  protected sumarCanjeProducto(producto: Producto, paso: number): void {
    const puntos = this.puntosPorProducto().get(producto.id) ?? 0;
    const cantidad = this.canjeados(producto) + paso;
    if (cantidad < 0 || cantidad > this.cantidad(producto) || (paso > 0 && this.puntosRestantes() < puntos)) return;
    this.productosConPuntos.update((actual) => ({ ...actual, [producto.id]: cantidad }));
  }

  /** Unidades elegidas de una categoría, para mostrarlas en su botón. */
  protected elegidosEn(categoria: CategoriaConProductos): number {
    return categoria.productos.reduce((total, producto) => total + this.cantidad(producto), 0);
  }

  protected cantidad(producto: Producto): number {
    return this.carrito()[producto.id] ?? 0;
  }

  protected sumar(producto: Producto, paso: number): void {
    const cantidad = Math.min(Math.max(this.cantidad(producto) + paso, 0), MAX_UNIDADES_POR_PRODUCTO);
    this.carrito.update((actual) => ({ ...actual, [producto.id]: cantidad }));
    this.ajustarACantidades();
  }

  protected vaciarCarrito(): void {
    this.carrito.set({});
    this.combosElegidos.set({});
    this.ajustarACantidades();
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
    let comprador: Comprador | null = null;
    if (!this.auth.logueado()) {
      const { nombre, email, nacimiento } = this.form.controls.comprador.getRawValue();
      comprador = {
        nombre,
        email,
        fecha_nacimiento: this.restriccion() > 0 ? fechaDeListas(nacimiento.dia, nacimiento.mes, nacimiento.anio) : null,
      };
    }
    this.procesando.set(true);
    try {
      const combos: ItemCombo[] = this.lineasCombos().map(({ combo, cantidad }) => ({ combo_id: combo.id, cantidad }));
      const canje: Canje = {
        entradas: this.entradasConPuntos(),
        productos: Object.entries(this.productosConPuntos())
          .filter(([, cantidad]) => cantidad > 0)
          .map(([id, cantidad]) => ({ producto_id: Number(id), cantidad })),
      };
      const codigo = await this.comprasService.comprar(
        funcionId,
        this.seleccionadas(),
        comprador,
        this.items(),
        combos,
        canje,
      );
      await this.router.navigate(['/compras', codigo], { state: { recienComprada: true } });
    } catch (e) {
      this.errorCompra.set(mensajeError(e));
      // Puede que otra persona haya comprado alguna de las butacas mientras tanto.
      try {
        this.marcarOcupadas(await this.comprasService.butacasOcupadas(funcionId));
      } catch {
        // Queda el mensaje de error de la compra.
      }
    } finally {
      this.procesando.set(false);
    }
  }
}
