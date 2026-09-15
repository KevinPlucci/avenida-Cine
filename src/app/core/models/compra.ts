import { Formato, Idioma } from './funcion';
import { LineaProducto } from './producto';

/** Datos que se piden cuando la compra es anónima. */
export interface Comprador {
  nombre: string;
  email: string;
}

/** Lo que devuelve la función obtener_compra() de la base. Se usa para la pantalla y el PDF. */
/** Por qué se aplicó el descuento (lo decide la base). */
export type MotivoDescuento = 'primera_compra' | 'mayores';

export interface DetalleCompra {
  codigo: string;
  fecha_compra: string;
  nombre: string;
  email: string;
  cantidad: number;
  subtotal: number;
  subtotal_productos: number;
  descuento: number;
  descuento_motivo: MotivoDescuento | null;
  total: number;
  pelicula: string;
  imagen_url: string;
  duracion_min: number;
  sala: string;
  inicio: string;
  formato: Formato;
  idioma: Idioma;
  butacas: string[];
  productos: LineaProducto[];
  /** Fecha en que se validó el QR en el ingreso (null si todavía no se usó). */
  validada_en: string | null;
  /** Fecha en que se retiraron los productos del candy bar. */
  entregado_en: string | null;
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
  validada_en: string | null;
}

export interface Cupon {
  id: number;
  tipo: string;
  porcentaje: number;
  usado: boolean;
}

/** Descuentos que tiene disponibles el usuario logueado (email 30/01). */
export interface Beneficios {
  primera_compra: { porcentaje: number; usado: boolean } | null;
  mayores: { porcentaje: number; edad_minima: number } | null;
}

/** Lo que ve el empleado al escanear un QR (email 06/02). */
export interface CompraParaValidar {
  codigo: string;
  nombre: string;
  cantidad: number;
  butacas: string[];
  pelicula: string;
  sala: string;
  inicio: string;
  fin: string;
  formato: Formato;
  idioma: Idioma;
  validada_en: string | null;
  entregado_en: string | null;
  productos: { nombre: string; cantidad: number }[];
}
