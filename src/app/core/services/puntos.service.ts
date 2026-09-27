import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { MisPuntos, Recompensa } from '../models/puntos';

/** Programa de puntos (email 03/03). Los puntos solo los suma o descuenta la base al comprar. */
@Injectable({ providedIn: 'root' })
export class PuntosService {
  private readonly db = inject(SupabaseService).client;

  /** Saldo e historial de canjes del usuario logueado. */
  async misPuntos(): Promise<MisPuntos> {
    const { data, error } = await this.db.rpc('mis_puntos');
    if (error) throw error;
    return data as MisPuntos;
  }

  async recompensas(): Promise<Recompensa[]> {
    const { data, error } = await this.db
      .from('recompensas')
      .select('id, tipo, producto_id, puntos, activa, producto:productos(nombre)')
      .order('puntos');
    if (error) throw error;
    return data as unknown as Recompensa[];
  }

  // ---------- Administración ----------

  async guardarEntrada(puntos: number, activa: boolean): Promise<void> {
    const { error } = await this.db.from('recompensas').update({ puntos, activa }).eq('tipo', 'entrada');
    if (error) throw error;
  }

  /** Con puntos en null el producto deja de poder canjearse. */
  async guardarProducto(productoId: number, puntos: number | null): Promise<void> {
    const { error } = puntos
      ? await this.db
          .from('recompensas')
          .upsert({ tipo: 'producto', producto_id: productoId, puntos, activa: true }, { onConflict: 'producto_id' })
      : await this.db.from('recompensas').delete().eq('producto_id', productoId);
    if (error) throw error;
  }
}
