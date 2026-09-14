/**
 * Distribución de las salas (email 01/01): 20 filas identificadas con letras (A a T)
 * y 3 bloques de 4, 20 y 4 butacas. Las butacas se numeran de izquierda a derecha (1 a 28).
 */
export const FILAS = 'ABCDEFGHIJKLMNOPQRST'.split('');

export const BLOQUES = [4, 20, 4];

/** Números de butaca de cada bloque: [[1..4], [5..24], [25..28]]. */
export function numerosPorBloque(): number[][] {
  let siguiente = 1;
  return BLOQUES.map((cantidad) => {
    const numeros = Array.from({ length: cantidad }, (_, i) => siguiente + i);
    siguiente += cantidad;
    return numeros;
  });
}

export function idButaca(fila: string, numero: number): string {
  return `${fila}${numero}`;
}

/** Ordena butacas del tipo "A1", "B12" por fila y después por número. */
export function ordenarButacas(butacas: string[]): string[] {
  return [...butacas].sort(
    (a, b) => a.charAt(0).localeCompare(b.charAt(0)) || Number(a.slice(1)) - Number(b.slice(1)),
  );
}
