import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { Pelicula, PeliculaGuardar } from '../models/pelicula';

const COLUMNAS = 'id, titulo, sinopsis, duracion_min, imagen_url, en_cartelera, generos(id, nombre)';

@Injectable({ providedIn: 'root' })
export class PeliculasService {
  private readonly db = inject(SupabaseService).client;

  async obtener(id: number): Promise<Pelicula | null> {
    const { data, error } = await this.db.from('peliculas').select(COLUMNAS).eq('id', id).maybeSingle();
    if (error) throw error;
    return data as Pelicula | null;
  }

  // ---------- Administración ----------

  async listarTodas(): Promise<Pelicula[]> {
    const { data, error } = await this.db.from('peliculas').select(COLUMNAS).order('titulo');
    if (error) throw error;
    return data as Pelicula[];
  }

  /** Crea (id null) o actualiza una película y reemplaza sus géneros. */
  async guardar(id: number | null, datos: PeliculaGuardar, generoIds: number[]): Promise<void> {
    const respuesta = id
      ? await this.db.from('peliculas').update(datos).eq('id', id).select('id').single()
      : await this.db.from('peliculas').insert(datos).select('id').single();
    if (respuesta.error) throw respuesta.error;
    const peliculaId = respuesta.data.id as number;

    const borrado = await this.db.from('pelicula_generos').delete().eq('pelicula_id', peliculaId);
    if (borrado.error) throw borrado.error;

    if (generoIds.length) {
      const filas = generoIds.map((genero_id) => ({ pelicula_id: peliculaId, genero_id }));
      const { error } = await this.db.from('pelicula_generos').insert(filas);
      if (error) throw error;
    }
  }

  async cambiarCartelera(id: number, enCartelera: boolean): Promise<void> {
    const { error } = await this.db.from('peliculas').update({ en_cartelera: enCartelera }).eq('id', id);
    if (error) throw error;
  }

  async eliminar(id: number): Promise<void> {
    const { error } = await this.db.from('peliculas').delete().eq('id', id);
    if (error) throw error;
  }

  /** Sube el póster al bucket "posters" de Supabase Storage y devuelve la URL pública. */
  async subirPoster(archivo: File): Promise<string> {
    const extension = archivo.name.split('.').pop()?.toLowerCase() || 'jpg';
    const ruta = `${crypto.randomUUID()}.${extension}`;
    const { error } = await this.db.storage.from('posters').upload(ruta, archivo, { contentType: archivo.type });
    if (error) throw error;
    return this.db.storage.from('posters').getPublicUrl(ruta).data.publicUrl;
  }
}
