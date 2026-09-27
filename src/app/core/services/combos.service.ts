import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { Combo, ComboGuardar } from '../models/producto';

const COLUMNAS = 'id, nombre, descripcion, precio, activo, productos:combo_productos(producto_id, cantidad, producto:productos(id, nombre, precio))';

/** Combos (email 03/03): una entrada más productos del candy bar a un precio fijo. */
@Injectable({ providedIn: 'root' })
export class CombosService {
  private readonly db = inject(SupabaseService).client;

  /**
   * Combos que se pueden comprar. Los productos dados de baja no llegan (la base no se los muestra al público),
   * así que un combo con alguno de ellos queda afuera, igual que en comprar_entradas().
   */
  async disponibles(): Promise<Combo[]> {
    const combos = await this.consultar(true);
    return combos.filter((combo) => combo.productos.length > 0 && combo.productos.every((item) => item.producto));
  }

  // ---------- Administración ----------

  async listar(): Promise<Combo[]> {
    return this.consultar(false);
  }

  /** Crea (id null) o actualiza un combo y reemplaza sus productos. */
  async guardar(id: number | null, datos: ComboGuardar, productos: { producto_id: number; cantidad: number }[]): Promise<void> {
    const respuesta = id
      ? await this.db.from('combos').update(datos).eq('id', id).select('id').single()
      : await this.db.from('combos').insert(datos).select('id').single();
    if (respuesta.error) throw respuesta.error;
    const comboId = respuesta.data.id as number;

    const borrado = await this.db.from('combo_productos').delete().eq('combo_id', comboId);
    if (borrado.error) throw borrado.error;

    const { error } = await this.db
      .from('combo_productos')
      .insert(productos.map((item) => ({ combo_id: comboId, ...item })));
    if (error) throw error;
  }

  async cambiarActivo(id: number, activo: boolean): Promise<void> {
    const { error } = await this.db.from('combos').update({ activo }).eq('id', id);
    if (error) throw error;
  }

  async eliminar(id: number): Promise<void> {
    const { error } = await this.db.from('combos').delete().eq('id', id);
    if (error) throw error;
  }

  private async consultar(soloActivos: boolean): Promise<Combo[]> {
    let consulta = this.db.from('combos').select(COLUMNAS).order('precio');
    if (soloActivos) {
      consulta = consulta.eq('activo', true);
    }
    const { data, error } = await consulta;
    if (error) throw error;
    return (data as unknown as Combo[]).map((combo) => ({ ...combo, precio: Number(combo.precio) }));
  }
}
