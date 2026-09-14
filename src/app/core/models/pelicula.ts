import { Genero } from './genero';

export interface Pelicula {
  id: number;
  titulo: string;
  sinopsis: string;
  duracion_min: number;
  imagen_url: string;
  en_cartelera: boolean;
  generos: Genero[];
}

/** Película con los datos calculados que se muestran en la cartelera. */
export interface PeliculaCartelera extends Pelicula {
  promedio: number | null;
  cantidad_resenias: number;
  entradas_vendidas: number;
}

/** Entradas vendidas de una película (respuesta de la función ranking_ventas). */
export interface VentasPelicula {
  pelicula_id: number;
  entradas_vendidas: number;
}

export type PeliculaGuardar = Omit<Pelicula, 'id' | 'generos'>;
