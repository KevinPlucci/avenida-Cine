import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import {
  CategoriaConProductos,
  CategoriaProducto,
  ProductoConCategoria,
  ProductoNuevo,
} from '../models/producto';

/** Candy bar (email 30/01): catálogo público y administración. */
@Injectable({ providedIn: 'root' })
export class ProductosService {
  private readonly db = inject(SupabaseService).client;

  /** Productos disponibles agrupados por categoría, para la pantalla de compra. */
  async disponiblesPorCategoria(): Promise<CategoriaConProductos[]> {
    const [categorias, productos] = await Promise.all([this.listarCategorias(), this.listar(true)]);
    return categorias
      .map((categoria) => ({
        id: categoria.id,
        nombre: categoria.nombre,
        productos: productos.filter((p) => p.categoria_id === categoria.id),
      }))
      .filter((grupo) => grupo.productos.length > 0);
  }

  /** Con soloDisponibles en false trae también los que el admin dio de baja. */
  async listar(soloDisponibles = false): Promise<ProductoConCategoria[]> {
    let consulta = this.db
      .from('productos')
      .select('*, categoria:categorias_productos(id, nombre)')
      .order('nombre');
    if (soloDisponibles) {
      consulta = consulta.eq('disponible', true);
    }
    const { data, error } = await consulta;
    if (error) throw error;
    return data as ProductoConCategoria[];
  }

  async crear(producto: ProductoNuevo): Promise<void> {
    const { error } = await this.db.from('productos').insert(producto);
    if (error) throw error;
  }

  async actualizar(id: number, cambios: Partial<ProductoNuevo>): Promise<void> {
    const { error } = await this.db.from('productos').update(cambios).eq('id', id);
    if (error) throw error;
  }

  async eliminar(id: number): Promise<void> {
    const { error } = await this.db.from('productos').delete().eq('id', id);
    if (error) throw error;
  }

  async listarCategorias(): Promise<CategoriaProducto[]> {
    const { data, error } = await this.db
      .from('categorias_productos')
      .select('id, nombre, orden')
      .order('orden')
      .order('nombre');
    if (error) throw error;
    return data as CategoriaProducto[];
  }

  async crearCategoria(nombre: string, orden: number): Promise<void> {
    const { error } = await this.db.from('categorias_productos').insert({ nombre, orden });
    if (error) throw error;
  }

  async eliminarCategoria(id: number): Promise<void> {
    const { error } = await this.db.from('categorias_productos').delete().eq('id', id);
    if (error) throw error;
  }
}
