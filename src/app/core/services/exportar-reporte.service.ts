import { Injectable } from '@angular/core';
import { NOMBRE_CINE } from '../constantes';
import { VentasDia } from './reportes.service';

/** El reporte de facturación de un período, con los días del más viejo al más nuevo. */
export interface ReporteFacturacion {
  /** AAAA-MM-DD */
  desde: string;
  hasta: string;
  dias: VentasDia[];
}

const COLUMNAS = ['Día', 'Compras', 'Entradas vendidas', 'Facturado'];

/**
 * Exporta el reporte de facturación a PDF y a Excel (email 10/03). Incluye todos los días del período,
 * también los que no tuvieron ventas. jsPDF y write-excel-file se descargan recién al exportar.
 */
@Injectable({ providedIn: 'root' })
export class ExportarReporteService {
  async pdf(reporte: ReporteFacturacion): Promise<void> {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const ancho = 210;
    const margen = 15;
    // Borde derecho de las columnas con números (se alinean a la derecha).
    const columnas = [margen, 110, 150, ancho - margen];

    // Encabezado oscuro con línea roja, igual que la entrada.
    doc.setFillColor(21, 20, 20);
    doc.rect(0, 0, ancho, 22, 'F');
    doc.setFillColor(166, 27, 27);
    doc.rect(0, 22, ancho, 1.2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(NOMBRE_CINE.toUpperCase(), margen, 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('REPORTE DE FACTURACIÓN', ancho - margen, 14, { align: 'right' });

    doc.setTextColor(28, 27, 26);
    doc.setFontSize(11);
    doc.text(`Del ${fechaCorta(reporte.desde)} al ${fechaCorta(reporte.hasta)}. Las compras canceladas no se cuentan.`, margen, 34);

    let y = 46;
    const encabezado = () => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(COLUMNAS[0], columnas[0], y);
      COLUMNAS.slice(1).forEach((titulo, i) => doc.text(titulo, columnas[i + 1], y, { align: 'right' }));
      doc.setDrawColor(200, 195, 190);
      doc.line(margen, y + 2, ancho - margen, y + 2);
      doc.setFont('helvetica', 'normal');
      y += 8;
    };
    encabezado();

    for (const fila of reporte.dias) {
      if (y > 280) {
        doc.addPage();
        y = 20;
        encabezado();
      }
      doc.text(fechaConDia(fila.dia), columnas[0], y);
      doc.text(String(fila.cantidad_compras), columnas[1], y, { align: 'right' });
      doc.text(String(fila.entradas_vendidas), columnas[2], y, { align: 'right' });
      doc.text(pesos(fila.facturado), columnas[3], y, { align: 'right' });
      y += 6.5;
    }

    const total = totales(reporte.dias);
    doc.line(margen, y - 3, ancho - margen, y - 3);
    y += 2;
    doc.setFont('helvetica', 'bold');
    doc.text('Total', columnas[0], y);
    doc.text(String(total.compras), columnas[1], y, { align: 'right' });
    doc.text(String(total.entradas), columnas[2], y, { align: 'right' });
    doc.text(pesos(total.facturado), columnas[3], y, { align: 'right' });

    doc.save(`${nombreArchivo(reporte)}.pdf`);
  }

  async excel(reporte: ReporteFacturacion): Promise<void> {
    const { default: escribirExcel } = await import('write-excel-file/browser');
    const negrita = (value: string | number, format?: string) => ({ value, fontWeight: 'bold' as const, format });
    const total = totales(reporte.dias);

    await escribirExcel(
      [
        [negrita(`${NOMBRE_CINE} · Reporte de facturación`)],
        [`Del ${fechaCorta(reporte.desde)} al ${fechaCorta(reporte.hasta)}. Las compras canceladas no se cuentan.`],
        [],
        COLUMNAS.map((titulo) => negrita(titulo)),
        ...reporte.dias.map((fila) => [
          { value: fechaUtc(fila.dia), type: Date, format: 'dd/mm/yyyy' },
          { value: fila.cantidad_compras, type: Number },
          { value: fila.entradas_vendidas, type: Number },
          { value: fila.facturado, type: Number, format: '#,##0.00' },
        ]),
        [negrita('Total'), negrita(total.compras), negrita(total.entradas), negrita(total.facturado, '#,##0.00')],
      ],
      { sheet: 'Facturación', columns: [{ width: 14 }, { width: 10 }, { width: 18 }, { width: 16 }] },
    ).toFile(`${nombreArchivo(reporte)}.xlsx`);
  }
}

function totales(dias: VentasDia[]): { compras: number; entradas: number; facturado: number } {
  return dias.reduce(
    (total, fila) => ({
      compras: total.compras + fila.cantidad_compras,
      entradas: total.entradas + fila.entradas_vendidas,
      facturado: total.facturado + fila.facturado,
    }),
    { compras: 0, entradas: 0, facturado: 0 },
  );
}

/** Las fechas del reporte son días sin hora: se arman en UTC para que no cambien con la zona horaria. */
function fechaUtc(dia: string): Date {
  const [anio, mes, numero] = dia.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, numero));
}

function fechaCorta(dia: string): string {
  return fechaUtc(dia).toLocaleDateString('es-AR', { timeZone: 'UTC' });
}

function fechaConDia(dia: string): string {
  return fechaUtc(dia).toLocaleDateString('es-AR', {
    timeZone: 'UTC',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function pesos(valor: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(valor);
}

function nombreArchivo(reporte: ReporteFacturacion): string {
  return `facturacion-${reporte.desde}-a-${reporte.hasta}`;
}
