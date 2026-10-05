import {
  CurrencyPipe,
  DatePipe,
  DecimalPipe,
  formatCurrency,
  formatDate,
  formatNumber,
  PercentPipe,
  TitleCasePipe,
} from '@angular/common';
import { Component, computed, inject, LOCALE_ID, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { Beneficios, CompraResumen, MiCredito } from '../../core/models/compra';
import { MisPuntos, Recompensa } from '../../core/models/puntos';
import { ComprasService } from '../../core/services/compras.service';
import { PuntosService } from '../../core/services/puntos.service';
import { mensajeError } from '../../core/utils/errores';

@Component({
  selector: 'app-mi-perfil',
  imports: [RouterLink, DatePipe, CurrencyPipe, DecimalPipe, PercentPipe, TitleCasePipe],
  templateUrl: './mi-perfil.html',
  styleUrl: './mi-perfil.css',
})
export class MiPerfil implements OnInit {
  private readonly comprasService = inject(ComprasService);
  private readonly puntosService = inject(PuntosService);
  private readonly locale = inject(LOCALE_ID);
  protected readonly auth = inject(AuthService);

  protected readonly compras = signal<CompraResumen[]>([]);
  protected readonly beneficios = signal<Beneficios | null>(null);
  protected readonly puntos = signal<MisPuntos | null>(null);
  protected readonly recompensas = signal<Recompensa[]>([]);
  /** Crédito de la cuenta por compras canceladas (email 10/03). */
  protected readonly credito = signal<MiCredito | null>(null);
  /** Lo que se puede canjear, con nombre (email 03/03). */
  protected readonly recompensasDisponibles = computed(() =>
    this.recompensas()
      .filter((r) => r.activa && (r.tipo === 'entrada' || r.producto))
      .map((r) => ({ id: r.id, nombre: r.tipo === 'entrada' ? 'Entrada gratis' : r.producto!.nombre, puntos: r.puntos })),
  );
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly exito = signal('');
  /** Código de la compra que se está cancelando. */
  protected readonly cancelando = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      await this.cargar();
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  /**
   * Cancela la compra hasta 2 horas antes de la función (email 10/03). No se devuelve dinero:
   * el total queda como crédito en la cuenta. Antes se confirma qué pasa con el crédito y los puntos.
   */
  protected async cancelar(compra: CompraResumen): Promise<void> {
    const funcion = formatDate(compra.inicio, "EEEE d/M 'a las' HH:mm", this.locale);
    const aviso = [
      `¿Cancelar la compra de ${compra.pelicula} del ${funcion}?`,
      `No se devuelve dinero: se acreditan ${this.pesos(compra.total)} en tu cuenta para usar en otra compra.`,
    ];
    if (compra.puntos_usados) aviso.push(`Te devolvemos los ${formatNumber(compra.puntos_usados, this.locale)} puntos que canjeaste.`);
    if (compra.puntos_ganados) {
      aviso.push(`Se descuentan los ${formatNumber(compra.puntos_ganados, this.locale)} puntos que sumaste con esta compra.`);
    }
    if (!confirm(aviso.join('\n'))) return;

    this.error.set('');
    this.exito.set('');
    this.cancelando.set(compra.codigo);
    try {
      const credito = await this.comprasService.cancelar(compra.codigo);
      await this.cargar();
      this.exito.set(`Compra cancelada. Se acreditaron ${this.pesos(credito)} en tu cuenta.`);
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cancelando.set(null);
    }
  }

  private async cargar(): Promise<void> {
    const [compras, beneficios, puntos, recompensas, credito] = await Promise.all([
      this.comprasService.misCompras(),
      this.comprasService.misBeneficios(),
      this.puntosService.misPuntos(),
      this.puntosService.recompensas(),
      this.comprasService.miCredito(),
    ]);
    this.compras.set(compras);
    this.beneficios.set(beneficios);
    this.puntos.set(puntos);
    this.recompensas.set(recompensas);
    this.credito.set(credito);
  }

  private pesos(importe: number): string {
    return formatCurrency(importe, this.locale, '$', 'ARS');
  }
}
