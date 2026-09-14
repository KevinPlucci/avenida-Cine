/** Pasa a minúsculas y quita acentos, para que la búsqueda de "accion" encuentre "Acción". */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}
