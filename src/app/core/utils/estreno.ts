import { Pelicula } from '../models/pelicula';

/** La preventa abre 7 días antes del estreno (email 08/03). */
export const DIAS_DE_PREVENTA = 7;

/** Hoy en Argentina (AAAA-MM-DD): los estrenos se cuentan con la fecha del cine, igual que en la base. */
export function hoyArgentina(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
}

export interface EstadoVenta {
  /** Todavía no se estrenó: se muestra en "Próximamente". */
  proximamente: boolean;
  /** Día en que abre la venta (AAAA-MM-DD): el del estreno o, con preventa, 7 días antes. */
  apertura: string | null;
  ventaAbierta: boolean;
  /** Las entradas se cobran al precio de preventa. */
  enPreventa: boolean;
}

/**
 * Estado de la venta de una película según su estreno y su preventa.
 * Son las mismas reglas que aplica comprar_entradas() en la base: acá solo se usan para mostrar.
 */
export function estadoVenta(
  pelicula: Pick<Pelicula, 'fecha_estreno' | 'precio_preventa'>,
  hoy = hoyArgentina(),
): EstadoVenta {
  const estreno = pelicula.fecha_estreno;
  if (!estreno || estreno <= hoy) {
    return { proximamente: false, apertura: null, ventaAbierta: true, enPreventa: false };
  }
  const apertura = pelicula.precio_preventa === null ? estreno : restarDias(estreno, DIAS_DE_PREVENTA);
  const ventaAbierta = apertura <= hoy;
  return { proximamente: true, apertura, ventaAbierta, enPreventa: ventaAbierta && pelicula.precio_preventa !== null };
}

function restarDias(fecha: string, dias: number): string {
  const resultado = new Date(`${fecha}T12:00:00Z`);
  resultado.setUTCDate(resultado.getUTCDate() - dias);
  return resultado.toISOString().slice(0, 10);
}
