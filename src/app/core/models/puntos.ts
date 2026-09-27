/** Programa de puntos (email 03/03): 1 punto por cada peso pagado, canjeable por entradas o productos. */

/** Lo que se puede canjear y cuántos puntos cuesta. La entrada no tiene producto. */
export interface Recompensa {
  id: number;
  tipo: 'entrada' | 'producto';
  producto_id: number | null;
  puntos: number;
  activa: boolean;
  /** Nombre del producto (null en la entrada o si el producto se dio de baja). */
  producto?: { nombre: string } | null;
}

export interface CanjeHistorial {
  fecha: string;
  detalle: string;
  puntos: number;
  codigo: string;
  pelicula: string;
}

/** Respuesta de mis_puntos(). */
export interface MisPuntos {
  saldo: number;
  canjes: CanjeHistorial[];
}

/** Lo que se canjea en una compra: la base valida y descuenta los puntos. */
export interface Canje {
  entradas: number;
  productos: { producto_id: number; cantidad: number }[];
}
