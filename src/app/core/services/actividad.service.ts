import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../supabase.service';

export type TipoActividad = 'funcion' | 'precio' | 'validacion';

/** Una línea del registro de actividad (email 10/03). La escriben triggers de la base. */
export interface Actividad {
  id: number;
  creado_en: string;
  /** Nombre y email de quien lo hizo, al momento de la acción. */
  usuario: string;
  tipo: TipoActividad;
  detalle: string;
}

@Injectable({ providedIn: 'root' })
export class ActividadService {
  private readonly db = inject(SupabaseService).client;

  /** Las últimas líneas, de la más nueva a la más vieja. Solo el administrador las puede leer (RLS). */
  async ultimas(tipo: TipoActividad | null, cantidad: number): Promise<Actividad[]> {
    let consulta = this.db.from('actividad').select('id, creado_en, usuario, tipo, detalle');
    if (tipo) {
      consulta = consulta.eq('tipo', tipo);
    }
    const { data, error } = await consulta.order('creado_en', { ascending: false }).limit(cantidad);
    if (error) throw error;
    return data as Actividad[];
  }
}
