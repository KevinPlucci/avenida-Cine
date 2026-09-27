export interface GrupoPorDia<T> {
  clave: string;
  fecha: Date;
  items: T[];
}

/** Agrupa elementos ordenados por fecha de inicio según el día (hora local). */
export function agruparPorDia<T extends { inicio: string }>(items: T[]): GrupoPorDia<T>[] {
  const grupos = new Map<string, GrupoPorDia<T>>();
  for (const item of items) {
    const fecha = new Date(item.inicio);
    const clave = aFechaIso(fecha);
    if (!grupos.has(clave)) {
      grupos.set(clave, { clave, fecha, items: [] });
    }
    grupos.get(clave)!.items.push(item);
  }
  return [...grupos.values()];
}

/** Fecha local en formato AAAA-MM-DD. */
export function aFechaIso(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/** Los próximos días a partir de hoy, para elegir con un click en lugar de un calendario. */
export function proximosDias(cantidad: number): { valor: string; fecha: Date }[] {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Array.from({ length: cantidad }, (_, i) => {
    const fecha = new Date(hoy);
    fecha.setDate(hoy.getDate() + i);
    return { valor: aFechaIso(fecha), fecha };
  });
}

export function sumarMinutos(fecha: Date, minutos: number): Date {
  return new Date(fecha.getTime() + minutos * 60_000);
}

// Fecha de nacimiento con tres listas (día, mes, año) en lugar de un calendario (email 28/02).
export const DIAS_DEL_MES = Array.from({ length: 31 }, (_, i) => i + 1);
export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
/** Años desde el actual hacia atrás, para elegir el año directo sin navegar mes por mes. */
export function aniosHastaHoy(cantidad: number): number[] {
  return Array.from({ length: cantidad }, (_, i) => new Date().getFullYear() - i);
}

/** Arma la fecha AAAA-MM-DD a partir de los valores de las tres listas. */
export function fechaDeListas(dia: string | number, mes: string | number, anio: string | number): string {
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** Años cumplidos hoy por alguien nacido en esa fecha (AAAA-MM-DD). La base calcula lo mismo con edad(). */
export function edadCumplida(fechaNacimiento: string): number {
  const [anio, mes, dia] = fechaNacimiento.split('-').map(Number);
  const hoy = new Date();
  const cumplioEsteAnio = hoy.getMonth() + 1 > mes || (hoy.getMonth() + 1 === mes && hoy.getDate() >= dia);
  return hoy.getFullYear() - anio - (cumplioEsteAnio ? 0 : 1);
}
