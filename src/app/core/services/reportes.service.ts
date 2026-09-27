import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../supabase.service';

/** Ventas de un día (email 28/02). */
export interface VentasDia {
  /** AAAA-MM-DD, día de Argentina en que se hicieron las compras. */
  dia: string;
  cantidad_compras: number;
  entradas_vendidas: number;
  facturado: number;
}

@Injectable({ providedIn: 'root' })
export class ReportesService {
  private readonly db = inject(SupabaseService).client;

  /** Facturación y entradas vendidas por día entre dos fechas (AAAA-MM-DD). Solo para el administrador. */
  async ventasPorDia(desde: string, hasta: string): Promise<VentasDia[]> {
    const { data, error } = await this.db.rpc('reporte_ventas', { p_desde: desde, p_hasta: hasta });
    if (error) throw error;
    return (data as VentasDia[]).map((fila) => ({ ...fila, facturado: Number(fila.facturado) }));
  }
}
