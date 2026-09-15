import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../supabase.service';

/** Regla de descuento configurable por el administrador (email 30/01). */
export interface ReglaCupon {
  tipo: 'primera_compra' | 'mayores';
  porcentaje: number;
  /** Solo para la regla "mayores": edad a partir de la cual se aplica. */
  edad_minima: number | null;
  activo: boolean;
}

@Injectable({ providedIn: 'root' })
export class CuponesService {
  private readonly db = inject(SupabaseService).client;

  async listarReglas(): Promise<ReglaCupon[]> {
    const { data, error } = await this.db
      .from('cupones_regla')
      .select('tipo, porcentaje, edad_minima, activo')
      .order('tipo');
    if (error) throw error;
    return data as ReglaCupon[];
  }

  async obtenerRegla(tipo: ReglaCupon['tipo']): Promise<ReglaCupon | null> {
    const { data, error } = await this.db
      .from('cupones_regla')
      .select('tipo, porcentaje, edad_minima, activo')
      .eq('tipo', tipo)
      .maybeSingle();
    if (error) throw error;
    return data as ReglaCupon | null;
  }

  async guardarRegla(tipo: ReglaCupon['tipo'], cambios: Partial<ReglaCupon>): Promise<void> {
    const { error } = await this.db
      .from('cupones_regla')
      .update({ ...cambios, actualizado_en: new Date().toISOString() })
      .eq('tipo', tipo);
    if (error) throw error;
  }
}
