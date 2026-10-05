/**
 * Distribución de las salas (email 01/01): filas identificadas con letras (A a T)
 * y 3 bloques de 4, 20 y 4 butacas, numeradas de izquierda a derecha (1 a 28).
 *
 * Email 12/02: las filas J y K se quitaron para dar lugar a una sola fila accesible,
 * la J, con bloques de 2, 10 y 2 butacas (1 a 14). La base valida lo mismo en butaca_valida().
 *
 * Email 10/03: las últimas 3 filas (R, S y T) son VIP y tienen un recargo. La base usa butaca_vip().
 */
export const BLOQUES = [4, 20, 4];
export const BLOQUES_ACCESIBLES = [2, 10, 2];

export const FILA_ACCESIBLE = 'J';
export const FILAS_VIP = ['R', 'S', 'T'];
/** Filas que ya no existen: su lugar lo ocupa la fila accesible. */
const FILAS_QUITADAS = ['K'];

export interface FilaSala {
  letra: string;
  accesible: boolean;
  vip: boolean;
  /** Números de butaca de cada bloque, por ejemplo [[1..4], [5..24], [25..28]]. */
  bloques: number[][];
}

export const FILAS: FilaSala[] = 'ABCDEFGHIJKLMNOPQRST'
  .split('')
  .filter((letra) => !FILAS_QUITADAS.includes(letra))
  .map((letra) => {
    const accesible = letra === FILA_ACCESIBLE;
    return {
      letra,
      accesible,
      vip: FILAS_VIP.includes(letra),
      bloques: numerosPorBloque(accesible ? BLOQUES_ACCESIBLES : BLOQUES),
    };
  });

export const TOTAL_BUTACAS = FILAS.reduce((total, fila) => total + fila.bloques.flat().length, 0);

function numerosPorBloque(bloques: number[]): number[][] {
  let siguiente = 1;
  return bloques.map((cantidad) => {
    const numeros = Array.from({ length: cantidad }, (_, i) => siguiente + i);
    siguiente += cantidad;
    return numeros;
  });
}

export function idButaca(fila: string, numero: number): string {
  return `${fila}${numero}`;
}

export function esAccesible(butaca: string): boolean {
  return butaca.charAt(0) === FILA_ACCESIBLE;
}

export function esVip(butaca: string): boolean {
  return FILAS_VIP.includes(butaca.charAt(0));
}

/** Ordena butacas del tipo "A1", "B12" por fila y después por número. */
export function ordenarButacas(butacas: string[]): string[] {
  return [...butacas].sort(
    (a, b) => a.charAt(0).localeCompare(b.charAt(0)) || Number(a.slice(1)) - Number(b.slice(1)),
  );
}
