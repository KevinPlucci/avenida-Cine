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

    // Encabezado oscuro con línea roja, igual que en la app.
    doc.setFillColor(21, 20, 20);
    doc.rect(0, 0, ANCHO, 24, 'F');
    doc.setFillColor(166, 27, 27);
    doc.rect(0, 24, ANCHO, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(NOMBRE_CINE.toUpperCase(), MARGEN, 15);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('ENTRADA', ANCHO - MARGEN, 15, { align: 'right' });

    doc.setTextColor(28, 27, 26);
    let y = 40;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    const titulo: string[] = doc.splitTextToSize(compra.pelicula, ANCHO - MARGEN * 2);
    doc.text(titulo, MARGEN, y);
    y += titulo.length * 7 + 2;

    const datos: [string, string][] = [
      ['Fecha', inicio.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })],
      ['Hora', inicio.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })],
      ['Sala', compra.sala],
      ['Función', `${compra.formato} - ${compra.idioma === 'castellano' ? 'Castellano' : 'Subtitulada'}`],
      ['Butacas', compra.butacas.join(', ')],
      ['Comprador', compra.nombre],
    ];
    if (compra.productos.length) {
      datos.push([
        'Candy bar',
        compra.productos.map((p) => `${p.cantidad} x ${p.nombre}`).join(', '),
      ]);
    }
    if (compra.descuento > 0 || compra.subtotal_productos > 0) {
      datos.push(['Entradas', precio(compra.subtotal)]);
    }
    if (compra.subtotal_productos > 0) {
      datos.push(['Productos', precio(compra.subtotal_productos)]);
    }
    if (compra.descuento > 0) {
      const etiqueta = compra.descuento_motivo === 'mayores' ? 'Descuento por edad' : 'Cupón 1ra compra';
      datos.push([etiqueta, `- ${precio(compra.descuento)}`]);
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

    // Línea punteada como el talón de una entrada.
    y += 4;
    doc.setDrawColor(170, 165, 160);
    doc.setLineDashPattern([2, 1.5], 0);
    doc.line(MARGEN, y, ANCHO - MARGEN, y);
    doc.setLineDashPattern([], 0);

    const tamanioQr = 56;
    y += 6;
    doc.addImage(qr, 'PNG', (ANCHO - tamanioQr) / 2, y, tamanioQr, tamanioQr);
    y += tamanioQr + 6;

    doc.setFontSize(9);
    doc.setTextColor(107, 102, 97);
    doc.text(`Código: ${compra.codigo}`, ANCHO / 2, y, { align: 'center' });
    y += 5;
    const aclaracion = compra.productos.length
      ? 'Presentá este código QR en el ingreso a la sala y en el candy bar.'
      : 'Presentá este código QR en el ingreso a la sala.';
    doc.text(aclaracion, ANCHO / 2, y, { align: 'center' });
    if (compra.validada_en) {
      y += 5;
      doc.setTextColor(166, 27, 27);
      doc.text('Entrada ya validada: este código no sirve para ingresar de nuevo.', ANCHO / 2, y, { align: 'center' });
    }

    doc.save(`entrada-${compra.codigo.slice(0, 8)}.pdf`);
  }
}

function precio(valor: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(valor);
}
