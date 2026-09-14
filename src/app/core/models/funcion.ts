import { Pelicula } from './pelicula';
import { Sala } from './sala';

export const FORMATOS = ['2D', '3D', '4D', '5D'] as const;
export type Formato = (typeof FORMATOS)[number];

export const IDIOMAS = ['castellano', 'subtitulada'] as const;
export type Idioma = (typeof IDIOMAS)[number];

export interface Funcion {
  id: number;
  pelicula_id: number;
  sala_id: number;
  /** Fechas en formato ISO. */
  inicio: string;
  fin: string;
  bloqueada_hasta: string;
  formato: Formato;
  idioma: Idioma;
  precio: number;
}

export interface FuncionConDetalle extends Funcion {
  pelicula: Pick<Pelicula, 'id' | 'titulo' | 'imagen_url' | 'duracion_min' | 'en_cartelera'> | null;
  sala: Pick<Sala, 'id' | 'nombre'>;
}

export type FuncionNueva = Pick<Funcion, 'pelicula_id' | 'sala_id' | 'inicio' | 'formato' | 'idioma' | 'precio'>;
