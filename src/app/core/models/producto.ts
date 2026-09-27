/** Candy bar (email 30/01): productos agrupados en categorías. */

export interface CategoriaProducto {
  id: number;
  nombre: string;
  orden: number;
}

export interface Producto {
  id: number;
  categoria_id: number;
  nombre: string;
  descripcion: string;
  precio: number;
  disponible: boolean;
}

export interface ProductoConCategoria extends Producto {
  categoria: Pick<CategoriaProducto, 'id' | 'nombre'> | null;
}

/** Productos disponibles agrupados para la pantalla de compra. */
export interface CategoriaConProductos {
  id: number;
  nombre: string;
  productos: Producto[];
}

/** Lo que se manda a la base al comprar: el precio lo pone el servidor. */
export interface ItemCarrito {
  producto_id: number;
  cantidad: number;
}

/** Línea de productos de una compra ya hecha. */
export interface LineaProducto {
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  /** Unidades pagadas con puntos (email 03/03). */
  canjeados: number;
}

export type ProductoNuevo = Omit<Producto, 'id'>;

/** Combo (email 03/03): una entrada más productos del candy bar a un precio fijo. */
export interface Combo {
  id: number;
  nombre: string;
  descripcion: string;
  precio: number;
  activo: boolean;
  productos: { producto_id: number; cantidad: number; producto: Pick<Producto, 'id' | 'nombre' | 'precio'> | null }[];
}

export type ComboGuardar = Pick<Combo, 'nombre' | 'descripcion' | 'precio' | 'activo'>;

/** Lo que se manda a la base al comprar: el precio lo pone el servidor. */
export interface ItemCombo {
  combo_id: number;
  cantidad: number;
}

/** Combo de una compra ya hecha, con su contenido congelado. */
export interface LineaCombo {
  nombre: string;
  contenido: string;
  cantidad: number;
  precio_unitario: number;
}

/** "1 entrada + 1 × Pochoclos medianos + 1 × Gaseosa grande" (la base arma el mismo texto al vender). */
export function contenidoCombo(combo: Combo): string {
  const productos = combo.productos
    .filter((item) => item.producto)
    .sort((a, b) => a.producto!.nombre.localeCompare(b.producto!.nombre))
    .map((item) => ` + ${item.cantidad} × ${item.producto!.nombre}`);
  return `1 entrada${productos.join('')}`;
}
