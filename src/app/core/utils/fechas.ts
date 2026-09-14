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
