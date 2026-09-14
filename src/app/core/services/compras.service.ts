import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { Comprador, CompraResumen, Cupon, DetalleCompra } from '../models/compra';
import { idButaca } from '../utils/butacas';

const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable({ providedIn: 'root' })
export class ComprasService {
  private readonly db = inject(SupabaseService).client;

  async butacasOcupadas(funcionId: number): Promise<Set<string>> {
    const { data, error } = await this.db.from('entradas').select('fila, numero').eq('funcion_id', funcionId);
    if (error) throw error;
    return new Set((data as { fila: string; numero: number }[]).map((e) => idButaca(e.fila, e.numero)));
  }

  /**
   * Confirma la compra llamando a la función comprar_entradas() de la base, que valida las butacas,
   * calcula el total y aplica el cupón. Devuelve el código de la compra.
   * Si el usuario está logueado, comprador va en null y se usan los datos de su perfil.
   */
  async comprar(funcionId: number, butacas: string[], comprador: Comprador | null): Promise<string> {
    const { data, error } = await this.db.rpc('comprar_entradas', {
      p_funcion_id: funcionId,
      p_butacas: butacas,
      p_email: comprador?.email ?? null,
      p_nombre: comprador?.nombre ?? null,
    });
    if (error) throw error;
    return data as string;
  }

  async obtener(codigo: string): Promise<DetalleCompra | null> {
    if (!FORMATO_UUID.test(codigo)) return null;
    const { data, error } = await this.db.rpc('obtener_compra', { p_codigo: codigo });
    if (error) throw error;
    return data as DetalleCompra | null;
  }

  async misCompras(): Promise<CompraResumen[]> {
    const { data, error } = await this.db.rpc('mis_compras');
    if (error) throw error;
    return data as CompraResumen[];
  }

  /** Cupón de primera compra del usuario logueado (null si no tiene). */
  async cuponPrimeraCompra(): Promise<Cupon | null> {
    const { data, error } = await this.db
      .from('cupones')
      .select('id, tipo, porcentaje, usado')
      .eq('tipo', 'primera_compra')
      .maybeSingle();
    if (error) throw error;
    return data as Cupon | null;
  }
}
