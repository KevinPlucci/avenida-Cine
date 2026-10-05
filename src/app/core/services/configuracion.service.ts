import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../supabase.service';

/** Configuración general del cine (tabla de una sola fila). */
@Injectable({ providedIn: 'root' })
export class ConfiguracionService {
  private readonly db = inject(SupabaseService).client;

  /** Recargo de cada butaca VIP de las filas R, S y T (email 10/03). */
  async recargoVip(): Promise<number> {
    const { data, error } = await this.db.from('configuracion').select('recargo_vip').eq('id', 1).single();
    if (error) throw error;
    return Number(data.recargo_vip);
  }

  /** Solo el administrador puede cambiarlo (RLS). El cambio queda en el registro de actividad. */
  async cambiarRecargoVip(recargo: number): Promise<void> {
    const { error } = await this.db.from('configuracion').update({ recargo_vip: recargo }).eq('id', 1);
    if (error) throw error;
  }
}
