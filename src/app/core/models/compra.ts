import { Formato, Idioma } from './funcion';

/** Datos que se piden cuando la compra es anónima. */
export interface Comprador {
  nombre: string;
  email: string;
}

/** Lo que devuelve la función obtener_compra() de la base. Se usa para la pantalla y el PDF. */
export interface DetalleCompra {
  codigo: string;
  fecha_compra: string;
  nombre: string;
  email: string;
  cantidad: number;
  subtotal: number;
  descuento: number;
  total: number;
  pelicula: string;
  imagen_url: string;
  duracion_min: number;
  sala: string;
  inicio: string;
  formato: Formato;
  idioma: Idioma;
  butacas: string[];
}

export interface CompraResumen {
  codigo: string;
  fecha_compra: string;
  pelicula: string;
  imagen_url: string;
  sala: string;
  inicio: string;
  cantidad: number;
  total: number;
}

export interface Cupon {
  id: number;
  tipo: string;
  porcentaje: number;
  usado: boolean;
}
