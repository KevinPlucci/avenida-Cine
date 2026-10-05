import { Genero } from './genero';

/** Edad mínima para ver la película (email 12/02): 0 es apta para todo público. */
export const RESTRICCIONES_EDAD = [
  { valor: 0, etiqueta: 'ATP', descripcion: 'Apta para todo público' },
  { valor: 13, etiqueta: '+13', descripcion: 'Solo mayores de 13 años' },
  { valor: 18, etiqueta: '+18', descripcion: 'Solo mayores de 18 años' },
] as const;
export type RestriccionEdad = (typeof RESTRICCIONES_EDAD)[number]['valor'];

export interface Pelicula {
  id: number;
  titulo: string;
  sinopsis: string;
  duracion_min: number;
  imagen_url: string;
  en_cartelera: boolean;
  restriccion_edad: RestriccionEdad;
  /** Email 08/03: AAAA-MM-DD. Null si ya está en cartelera; con fecha futura va en "Próximamente". */
  fecha_estreno: string | null;
  /** Precio de las entradas en la preventa (7 días antes del estreno). Null si no tiene preventa. */
  precio_preventa: number | null;
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

/** Alerta de estreno que ya se puede avisar (respuesta de avisar_alertas, email 08/03). */
export interface AlertaDisponible {
  pelicula_id: number;
  titulo: string;
  /** La venta abrió con la preventa. */
  preventa: boolean;
}

/** Película que vio el usuario (respuesta de mis_peliculas, email 08/03). */
export interface PeliculaVista {
  pelicula_id: number;
  titulo: string;
  imagen_url: string;
  /** Inicio de cada función que vio, de la más reciente a la más vieja. */
  fechas: string[];
  /** Calificación de su reseña (null si todavía no la calificó). */
  estrellas: number | null;
}
