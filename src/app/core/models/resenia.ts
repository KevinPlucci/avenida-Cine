export interface Resenia {
  id: number;
  pelicula_id: number;
  usuario_id: string;
  autor: string;
  estrellas: number;
  comentario: string;
  creado_en: string;
}

export interface Puntaje {
  pelicula_id: number;
  promedio: number;
  cantidad: number;
}
