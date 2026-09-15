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
}

export type ProductoNuevo = Omit<Producto, 'id'>;
