import { CurrencyPipe, DatePipe, DecimalPipe, PercentPipe, TitleCasePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { Beneficios, CompraResumen } from '../../core/models/compra';
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
  protected readonly auth = inject(AuthService);

  protected readonly compras = signal<CompraResumen[]>([]);
  protected readonly beneficios = signal<Beneficios | null>(null);
  protected readonly puntos = signal<MisPuntos | null>(null);
  protected readonly recompensas = signal<Recompensa[]>([]);
  /** Lo que se puede canjear, con nombre (email 03/03). */
  protected readonly recompensasDisponibles = computed(() =>
    this.recompensas()
      .filter((r) => r.activa && (r.tipo === 'entrada' || r.producto))
      .map((r) => ({ id: r.id, nombre: r.tipo === 'entrada' ? 'Entrada gratis' : r.producto!.nombre, puntos: r.puntos })),
  );
  protected readonly cargando = signal(true);
  protected readonly error = signal('');

  async ngOnInit(): Promise<void> {
    try {
      const [compras, beneficios, puntos, recompensas] = await Promise.all([
        this.comprasService.misCompras(),
        this.comprasService.misBeneficios(),
        this.puntosService.misPuntos(),
        this.puntosService.recompensas(),
      ]);
      this.compras.set(compras);
      this.beneficios.set(beneficios);
      this.puntos.set(puntos);
      this.recompensas.set(recompensas);
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }
}
