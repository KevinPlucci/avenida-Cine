import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { Pelicula, PeliculaCartelera, PeliculaGuardar } from '../models/pelicula';
import { Puntaje } from '../models/resenia';

const COLUMNAS = 'id, titulo, sinopsis, duracion_min, imagen_url, en_cartelera, generos(id, nombre)';

@Injectable({ providedIn: 'root' })
export class PeliculasService {
  private readonly db = inject(SupabaseService).client;

  /** Películas en cartelera con su puntaje promedio y la cantidad de entradas vendidas. */
  async listarCartelera(): Promise<PeliculaCartelera[]> {
    const [peliculas, puntajes, ranking] = await Promise.all([
      this.db.from('peliculas').select(COLUMNAS).eq('en_cartelera', true).order('titulo'),
      this.db.from('puntajes_peliculas').select('pelicula_id, promedio, cantidad'),
      // GET en lugar de POST para que el service worker pueda guardarla y mostrar la cartelera sin conexión.
      this.db.rpc('ranking_ventas', {}, { get: true }),
    ]);
    if (peliculas.error) throw peliculas.error;
    if (puntajes.error) throw puntajes.error;
    if (ranking.error) throw ranking.error;

    const puntajePorPelicula = new Map((puntajes.data as Puntaje[]).map((p) => [p.pelicula_id, p]));
    const ventasPorPelicula = new Map(
      (ranking.data as { pelicula_id: number; entradas_vendidas: number }[]).map((r) => [
        r.pelicula_id,
        r.entradas_vendidas,
      ]),
    );

    return (peliculas.data as Pelicula[]).map((pelicula) => ({
      ...pelicula,
      promedio: puntajePorPelicula.get(pelicula.id)?.promedio ?? null,
      cantidad_resenias: puntajePorPelicula.get(pelicula.id)?.cantidad ?? 0,
      entradas_vendidas: ventasPorPelicula.get(pelicula.id) ?? 0,
    }));
  }

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
