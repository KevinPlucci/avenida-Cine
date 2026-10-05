import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { Beneficios, Comprador, CompraResumen, DetalleCompra } from '../models/compra';
import { PeliculaVista } from '../models/pelicula';
import { ItemCarrito, ItemCombo } from '../models/producto';
import { Canje } from '../models/puntos';
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
   * los productos, los combos y el canje de puntos, calcula el total y aplica el descuento.
   * Devuelve el código de la compra. Si el usuario está logueado, comprador va en null y se usan
   * los datos de su perfil.
   */
  async comprar(
    funcionId: number,
    butacas: string[],
    comprador: Comprador | null,
    productos: ItemCarrito[] = [],
    combos: ItemCombo[] = [],
    canje: Canje = { entradas: 0, productos: [] },
  ): Promise<string> {
    const { data, error } = await this.db.rpc('comprar_entradas', {
      p_funcion_id: funcionId,
      p_butacas: butacas,
      p_email: comprador?.email ?? null,
      p_nombre: comprador?.nombre ?? null,
      p_productos: productos,
      p_fecha_nacimiento: comprador?.fecha_nacimiento ?? null,
      p_combos: combos,
      p_canje: canje,
    });
    if (error) throw error;
    return data as string;
  }

  /**
   * Butacas en tiempo real (email 12/02): avisa cada butaca que se vende en la función mientras la
   * pantalla está abierta, con Supabase Realtime. alConectar se llama cada vez que el canal queda
   * conectado, para volver a leer lo vendido mientras tanto. Devuelve la función que deja de escuchar.
   */
  escucharVentas(funcionId: number, alVender: (butaca: string) => void, alConectar: () => void): () => void {
    const canal = this.db
      .channel(`ventas-funcion-${funcionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'entradas', filter: `funcion_id=eq.${funcionId}` },
        (cambio) => {
          const entrada = cambio.new as { fila: string; numero: number };
          alVender(idButaca(entrada.fila, entrada.numero));
        },
      )
      .subscribe((estado) => {
        if (estado === 'SUBSCRIBED') alConectar();
      });
    return () => void this.db.removeChannel(canal);
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

  /** Películas que vio el usuario logueado, con las fechas y su calificación (email 08/03). */
  async misPeliculas(): Promise<PeliculaVista[]> {
    const { data, error } = await this.db.rpc('mis_peliculas');
    if (error) throw error;
    return data as PeliculaVista[];
  }

  /** Descuentos disponibles del usuario logueado: cupón de bienvenida y beneficio por edad. */
  async misBeneficios(): Promise<Beneficios> {
    const { data, error } = await this.db.rpc('mis_beneficios');
    if (error) throw error;
    return data as Beneficios;
  }

}
