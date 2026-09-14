import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { Puntaje, Resenia } from '../models/resenia';

@Injectable({ providedIn: 'root' })
export class ReseniasService {
  private readonly db = inject(SupabaseService).client;

  async listar(peliculaId: number): Promise<Resenia[]> {
    const { data, error } = await this.db
      .from('resenias')
      .select('*')
      .eq('pelicula_id', peliculaId)
      .order('creado_en', { ascending: false });
    if (error) throw error;
    return data as Resenia[];
  }

  async obtenerPuntaje(peliculaId: number): Promise<Puntaje | null> {
    const { data, error } = await this.db
      .from('puntajes_peliculas')
      .select('pelicula_id, promedio, cantidad')
      .eq('pelicula_id', peliculaId)
      .maybeSingle();
    if (error) throw error;
    return data as Puntaje | null;
  }

  /** El usuario y el nombre del autor los completa un trigger de la base. */
  async crear(peliculaId: number, estrellas: number, comentario: string): Promise<void> {
    const { error } = await this.db.from('resenias').insert({ pelicula_id: peliculaId, estrellas, comentario });
    if (error) throw error;
  }

  async actualizar(id: number, estrellas: number, comentario: string): Promise<void> {
    const { error } = await this.db.from('resenias').update({ estrellas, comentario }).eq('id', id);
    if (error) throw error;
  }

  async eliminar(id: number): Promise<void> {
    const { error } = await this.db.from('resenias').delete().eq('id', id);
    if (error) throw error;
  }
}
