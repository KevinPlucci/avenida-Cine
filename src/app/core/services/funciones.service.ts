import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { Formato, FuncionAdmin, FuncionConDetalle, FuncionNueva, Idioma } from '../models/funcion';
import { Sala } from '../models/sala';
import { MINUTOS_ENTRE_FUNCIONES } from '../constantes';
import { sumarMinutos } from '../utils/fechas';

const COLUMNAS =
  '*, pelicula:peliculas(id, titulo, imagen_url, duracion_min, en_cartelera), sala:salas(id, nombre)';

/** Resultado de programar un horario: la base informa cuáles se crearon y por qué falló el resto. */
export interface ResultadoProgramacion {
  inicio: string;
  creada: boolean;
  sala?: string;
  motivo?: string;
}

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

  /** Funciones que todavía no terminaron, con la cantidad de entradas vendidas (panel de administración). */
  async listarProximas(): Promise<FuncionAdmin[]> {
    const { data, error } = await this.db
      .from('funciones')
      .select(`${COLUMNAS}, entradas(count)`)
      .gt('fin', new Date().toISOString())
      .order('inicio');
    if (error) throw error;
    return (data as (FuncionConDetalle & { entradas: { count: number }[] })[]).map(({ entradas, ...funcion }) => ({
      ...funcion,
      vendidas: entradas[0]?.count ?? 0,
    }));
  }

  /**
   * Funciones de la sala que chocan con el horario indicado.
   * Dos funciones chocan si cada una empieza antes de que termine la otra más los 30 minutos de bloqueo.
   * La base tiene la misma regla como restricción; esto sirve para mostrar un mensaje claro antes de guardar.
   * Al editar se pasa el id de la función para no compararla consigo misma.
   */
  async buscarConflictos(
    salaId: number,
    inicio: Date,
    duracionMin: number,
    excluirId?: number,
  ): Promise<FuncionConDetalle[]> {
    const bloqueadaHasta = sumarMinutos(inicio, duracionMin + MINUTOS_ENTRE_FUNCIONES);
    let consulta = this.db
      .from('funciones')
      .select(COLUMNAS)
      .eq('sala_id', salaId)
      .lt('inicio', bloqueadaHasta.toISOString())
      .gt('bloqueada_hasta', inicio.toISOString());
    if (excluirId) {
      consulta = consulta.neq('id', excluirId);
    }
    const { data, error } = await consulta.order('inicio');
    if (error) throw error;
    return data as FuncionConDetalle[];
  }

  /** Salas activas libres para ese horario (email 06/02: asignación automática). */
  async salasLibres(inicio: Date, peliculaId: number, excluirFuncion?: number): Promise<Sala[]> {
    const { data, error } = await this.db.rpc('salas_libres', {
      p_inicio: inicio.toISOString(),
      p_pelicula_id: peliculaId,
      p_excluir_funcion: excluirFuncion ?? null,
    });
    if (error) throw error;
    return (data as { id: number; nombre: string }[]).map((s) => ({ ...s, activa: true }));
  }

  /**
   * Programa la misma película en varios horarios de una sola vez (email 06/02).
   * Con salaId en null la base asigna automáticamente la primera sala libre de cada horario.
   * Devuelve un resultado por horario: si uno falla, los demás se crean igual.
   */
  async programar(
    peliculaId: number,
    salaId: number | null,
    inicios: Date[],
    formato: Formato,
    idioma: Idioma,
    precio: number,
  ): Promise<ResultadoProgramacion[]> {
    const { data, error } = await this.db.rpc('programar_funciones', {
      p_pelicula_id: peliculaId,
      p_sala_id: salaId,
      p_inicios: inicios.map((fecha) => fecha.toISOString()),
      p_formato: formato,
      p_idioma: idioma,
      p_precio: precio,
    });
    if (error) throw error;
    return data as ResultadoProgramacion[];
  }

  async crear(funcion: FuncionNueva): Promise<void> {
    const { error } = await this.db.from('funciones').insert(funcion);
    if (error) throw error;
  }

  /** La base rechaza cambiar horario, sala, película, formato o idioma si la función ya tiene entradas vendidas. */
  async actualizar(id: number, cambios: Partial<FuncionNueva>): Promise<void> {
    const { error } = await this.db.from('funciones').update(cambios).eq('id', id);
    if (error) throw error;
  }

  async eliminar(id: number): Promise<void> {
    const { error } = await this.db.from('funciones').delete().eq('id', id);
    if (error) throw error;
  }
}
