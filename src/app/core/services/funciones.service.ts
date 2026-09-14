import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { FuncionConDetalle, FuncionNueva } from '../models/funcion';
import { MINUTOS_ENTRE_FUNCIONES } from '../constantes';
import { sumarMinutos } from '../utils/fechas';

const COLUMNAS =
  '*, pelicula:peliculas(id, titulo, imagen_url, duracion_min, en_cartelera), sala:salas(id, nombre)';

@Injectable({ providedIn: 'root' })
export class FuncionesService {
  private readonly db = inject(SupabaseService).client;

  async proximasDePelicula(peliculaId: number): Promise<FuncionConDetalle[]> {
    const { data, error } = await this.db
      .from('funciones')
      .select(COLUMNAS)
      .eq('pelicula_id', peliculaId)
      .gt('inicio', new Date().toISOString())
      .order('inicio');
    if (error) throw error;
    return data as FuncionConDetalle[];
  }

  async obtener(id: number): Promise<FuncionConDetalle | null> {
    const { data, error } = await this.db.from('funciones').select(COLUMNAS).eq('id', id).maybeSingle();
    if (error) throw error;
    return data as FuncionConDetalle | null;
  }

  /** Funciones que todavía no terminaron (para el panel de administración). */
  async listarProximas(): Promise<FuncionConDetalle[]> {
    const { data, error } = await this.db
      .from('funciones')
      .select(COLUMNAS)
      .gt('fin', new Date().toISOString())
      .order('inicio');
    if (error) throw error;
    return data as FuncionConDetalle[];
  }

  /**
   * Funciones de la sala que chocan con una nueva función.
   * Dos funciones chocan si cada una empieza antes de que termine la otra más los 30 minutos de bloqueo.
   * La base tiene la misma regla como restricción; esto sirve para mostrar un mensaje claro antes de guardar.
   */
  async buscarConflictos(salaId: number, inicio: Date, duracionMin: number): Promise<FuncionConDetalle[]> {
    const bloqueadaHasta = sumarMinutos(inicio, duracionMin + MINUTOS_ENTRE_FUNCIONES);
    const { data, error } = await this.db
      .from('funciones')
      .select(COLUMNAS)
      .eq('sala_id', salaId)
      .lt('inicio', bloqueadaHasta.toISOString())
      .gt('bloqueada_hasta', inicio.toISOString())
      .order('inicio');
    if (error) throw error;
    return data as FuncionConDetalle[];
  }

  async crear(funcion: FuncionNueva): Promise<void> {
    const { error } = await this.db.from('funciones').insert(funcion);
    if (error) throw error;
  }

  async eliminar(id: number): Promise<void> {
    const { error } = await this.db.from('funciones').delete().eq('id', id);
    if (error) throw error;
  }
}
