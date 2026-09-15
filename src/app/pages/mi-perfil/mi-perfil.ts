import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { Beneficios, CompraResumen } from '../../core/models/compra';
import { ComprasService } from '../../core/services/compras.service';
import { mensajeError } from '../../core/utils/errores';

@Component({
  selector: 'app-mi-perfil',
  imports: [RouterLink, DatePipe, CurrencyPipe],
  templateUrl: './mi-perfil.html',
  styleUrl: './mi-perfil.css',
})
export class MiPerfil implements OnInit {
  private readonly comprasService = inject(ComprasService);
  protected readonly auth = inject(AuthService);

  protected readonly compras = signal<CompraResumen[]>([]);
  protected readonly beneficios = signal<Beneficios | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');

  async ngOnInit(): Promise<void> {
    try {
      const [compras, beneficios] = await Promise.all([
        this.comprasService.misCompras(),
        this.comprasService.misBeneficios(),
      ]);
      this.compras.set(compras);
      this.beneficios.set(beneficios);
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }
}
