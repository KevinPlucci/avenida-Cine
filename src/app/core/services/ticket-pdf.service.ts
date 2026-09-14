import { Injectable } from '@angular/core';
import { DetalleCompra } from '../models/compra';
import { NOMBRE_CINE } from '../constantes';
import { generarQr } from '../utils/qr';

const ANCHO = 148; // hoja A5 en mm
const MARGEN = 14;

@Injectable({ providedIn: 'root' })
export class TicketPdfService {
  /** Genera y descarga el PDF de la entrada con los datos de la compra y el QR. */
  async descargar(compra: DetalleCompra): Promise<void> {
    // jsPDF se carga recién cuando se necesita, así no pesa en la carga inicial de la app.
    const [{ jsPDF }, qr] = await Promise.all([import('jspdf'), generarQr(compra.codigo)]);
    const doc = new jsPDF({ unit: 'mm', format: 'a5' });
    const inicio = new Date(compra.inicio);
    let y = 20;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(NOMBRE_CINE, MARGEN, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text('Entrada', ANCHO - MARGEN, y, { align: 'right' });
    y += 4;
    doc.setDrawColor(160);
    doc.line(MARGEN, y, ANCHO - MARGEN, y);

    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    const titulo: string[] = doc.splitTextToSize(compra.pelicula, ANCHO - MARGEN * 2);
    doc.text(titulo, MARGEN, y);
    y += titulo.length * 7;

    const datos: [string, string][] = [
      ['Fecha', inicio.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })],
      ['Hora', inicio.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })],
      ['Sala', compra.sala],
      ['Función', `${compra.formato} - ${compra.idioma === 'castellano' ? 'Castellano' : 'Subtitulada'}`],
      ['Butacas', compra.butacas.join(', ')],
      ['Comprador', compra.nombre],
    ];
    if (compra.descuento > 0) {
      datos.push(['Subtotal', precio(compra.subtotal)], ['Descuento', `- ${precio(compra.descuento)}`]);
    }
    datos.push(['Total', precio(compra.total)]);

    doc.setFontSize(11);
    for (const [etiqueta, valor] of datos) {
      doc.setFont('helvetica', 'bold');
      doc.text(etiqueta, MARGEN, y);
      doc.setFont('helvetica', 'normal');
      const lineas: string[] = doc.splitTextToSize(valor, ANCHO - MARGEN * 2 - 30);
      doc.text(lineas, MARGEN + 30, y);
      y += 6 * lineas.length;
    }

    const tamanioQr = 58;
    y += 6;
    doc.addImage(qr, 'PNG', (ANCHO - tamanioQr) / 2, y, tamanioQr, tamanioQr);
    y += tamanioQr + 6;

    doc.setFontSize(9);
    doc.text(`Código: ${compra.codigo}`, ANCHO / 2, y, { align: 'center' });
    y += 5;
    doc.text('Presentá este código QR en el ingreso a la sala.', ANCHO / 2, y, { align: 'center' });

    doc.save(`entrada-${compra.codigo.slice(0, 8)}.pdf`);
  }
}

function precio(valor: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(valor);
}
