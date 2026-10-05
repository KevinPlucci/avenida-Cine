import { Formato, Idioma } from './funcion';
import { RestriccionEdad } from './pelicula';
import { LineaCombo, LineaProducto } from './producto';

/** Datos que se piden cuando la compra es anónima. */
export interface Comprador {
  nombre: string;
  email: string;
  /** AAAA-MM-DD. Solo para películas con restricción de edad (email 12/02). */
  fecha_nacimiento: string | null;
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
  /** Email 03/03: combos, entradas pagadas con puntos y puntos de la compra. */
  subtotal_combos: number;
  entradas_canjeadas: number;
  puntos_usados: number;
  puntos_ganados: number;
  /** Email 08/03: las entradas se cobraron al precio de preventa. */
  preventa: boolean;
  descuento: number;
  descuento_motivo: MotivoDescuento | null;
  total: number;
  /** Email 10/03: recargo de las butacas VIP y parte del total pagada con el crédito de la cuenta. */
  subtotal_vip: number;
  credito_usado: number;
  /** Email 10/03: fecha de cancelación y crédito que generó (null si no se canceló). */
  cancelada_en: string | null;
  credito_generado: number | null;
  pelicula: string;
  restriccion_edad: RestriccionEdad;
  imagen_url: string;
  duracion_min: number;
  sala: string;
  inicio: string;
  formato: Formato;
  idioma: Idioma;
  butacas: string[];
  productos: LineaProducto[];
  combos: LineaCombo[];
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
  /** Email 10/03: cancelación y si todavía se puede cancelar (hasta 2 horas antes de la función). */
  cancelada_en: string | null;
  credito_generado: number | null;
  puntos_usados: number;
  puntos_ganados: number;
  puede_cancelar: boolean;
}

/** Crédito de la cuenta (email 10/03): saldo y movimientos (positivos por cancelaciones, negativos al usarlo). */
export interface MiCredito {
  saldo: number;
  movimientos: { fecha: string; detalle: string; monto: number; codigo: string }[];
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
  restriccion_edad: RestriccionEdad;
  sala: string;
  inicio: string;
  fin: string;
  formato: Formato;
  idioma: Idioma;
  validada_en: string | null;
  entregado_en: string | null;
  /** Email 10/03: una compra cancelada no se valida. */
  cancelada_en: string | null;
  productos: { nombre: string; cantidad: number }[];
  combos: { nombre: string; contenido: string; cantidad: number }[];
}
