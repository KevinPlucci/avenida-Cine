import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NOMBRE_CINE } from '../../core/constantes';
import { DetalleCompra } from '../../core/models/compra';
import { ComprasService } from '../../core/services/compras.service';
import { TicketPdfService } from '../../core/services/ticket-pdf.service';
import { mensajeError } from '../../core/utils/errores';
import { generarQr } from '../../core/utils/qr';
import { IdiomaPipe } from '../../shared/pipes/idioma.pipe';

@Component({
  selector: 'app-ver-compra',
  imports: [RouterLink, DatePipe, CurrencyPipe, IdiomaPipe],
  templateUrl: './ver-compra.html',
  styleUrl: './ver-compra.css',
})
export class VerCompra implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly comprasService = inject(ComprasService);
  private readonly ticketPdf = inject(TicketPdfService);

  protected readonly nombreCine = NOMBRE_CINE;
  /** Viene en true cuando se llega desde la pantalla de compra. */
  protected readonly recienComprada = history.state?.recienComprada === true;
  protected readonly compra = signal<DetalleCompra | null>(null);
  protected readonly qr = signal('');
  protected readonly cargando = signal(true);
  protected readonly descargando = signal(false);
  protected readonly error = signal('');

  async ngOnInit(): Promise<void> {
    // Parámetro :codigo de la ruta /compras/:codigo
    const codigo = this.route.snapshot.paramMap.get('codigo') ?? '';
    try {
      const compra = await this.comprasService.obtener(codigo);
      if (!compra) {
        this.error.set('No encontramos una compra con ese código.');
        return;
      }
      this.compra.set(compra);
      this.qr.set(await generarQr(compra.codigo));
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected async descargarPdf(): Promise<void> {
    const compra = this.compra();
    if (!compra) return;
    this.descargando.set(true);
    try {
      await this.ticketPdf.descargar(compra);
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.descargando.set(false);
    }
  }
}
