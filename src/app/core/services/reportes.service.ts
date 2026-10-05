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

/** Entradas vendidas de una película en las funciones de un período (email 10/03). */
export interface PeliculaMasVista {
  pelicula: string;
  entradas_vendidas: number;
}

/** Unidades vendidas de un producto del candy bar, sueltas y en combos (email 10/03). */
export interface ProductoMasVendido {
  producto: string;
  unidades: number;
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

  /** Películas más vistas: entradas de las funciones del período, de mayor a menor. */
  async peliculasMasVistas(desde: string, hasta: string): Promise<PeliculaMasVista[]> {
    const { data, error } = await this.db.rpc('ranking_peliculas', { p_desde: desde, p_hasta: hasta });
    if (error) throw error;
    return data as PeliculaMasVista[];
  }

  /** Productos del candy bar más vendidos en las funciones del período, de mayor a menor. */
  async productosMasVendidos(desde: string, hasta: string): Promise<ProductoMasVendido[]> {
    const { data, error } = await this.db.rpc('ranking_productos', { p_desde: desde, p_hasta: hasta });
    if (error) throw error;
    return data as ProductoMasVendido[];
  }
}
