import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { MAX_BUTACAS_POR_COMPRA, PORCENTAJE_CUPON_BIENVENIDA } from '../../core/constantes';
import { Cupon } from '../../core/models/compra';
import { FuncionConDetalle } from '../../core/models/funcion';
import { ComprasService } from '../../core/services/compras.service';
import { FuncionesService } from '../../core/services/funciones.service';
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
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly auth = inject(AuthService);

  protected readonly maximo = MAX_BUTACAS_POR_COMPRA;
  protected readonly porcentajeBienvenida = PORCENTAJE_CUPON_BIENVENIDA;

  protected readonly funcion = signal<FuncionConDetalle | null>(null);
  protected readonly ocupadas = signal<ReadonlySet<string>>(new Set());
  protected readonly seleccionadas = signal<string[]>([]);
  protected readonly cupon = signal<Cupon | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly errorCompra = signal('');
  protected readonly procesando = signal(false);

  // El total que se muestra es orientativo: el importe real lo calcula la base al confirmar.
  protected readonly subtotal = computed(() => (this.funcion()?.precio ?? 0) * this.seleccionadas().length);
  protected readonly porcentajeDescuento = computed(() => {
    const cupon = this.cupon();
    return cupon && !cupon.usado ? cupon.porcentaje : 0;
  });
  protected readonly descuento = computed(() => Math.round(this.subtotal() * this.porcentajeDescuento()) / 100);
  protected readonly total = computed(() => this.subtotal() - this.descuento());

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
      const [funcion, ocupadas] = await Promise.all([
        this.funcionesService.obtener(id),
        this.comprasService.butacasOcupadas(id),
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

      if (this.auth.logueado()) {
        // Los datos del comprador se toman del perfil.
        this.form.controls.comprador.disable();
        this.cupon.set(await this.comprasService.cuponPrimeraCompra());
      }
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
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
      const codigo = await this.comprasService.comprar(funcionId, this.seleccionadas(), comprador);
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
