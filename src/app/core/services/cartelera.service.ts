import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Pelicula, PeliculaCartelera, VentasPelicula } from '../models/pelicula';
import { Puntaje } from '../models/resenia';

/**
 * Arma la cartelera consumiendo la API REST de Supabase con peticiones GET.
 * Son datos públicos, así que no necesitan la sesión del usuario.
 */
@Injectable({ providedIn: 'root' })
export class CarteleraService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.supabaseUrl}/rest/v1`;
  private readonly headers = new HttpHeaders({ apikey: environment.supabaseAnonKey });

  /** Películas en cartelera con su puntaje promedio y la cantidad de entradas vendidas. */
  obtenerCartelera(): Observable<PeliculaCartelera[]> {
    return forkJoin({
      peliculas: this.http.get<Pelicula[]>(`${this.api}/peliculas`, {
        headers: this.headers,
        params: {
          select: 'id,titulo,sinopsis,duracion_min,imagen_url,en_cartelera,generos(id,nombre)',
          en_cartelera: 'eq.true',
          order: 'titulo',
        },
      }),
      puntajes: this.http.get<Puntaje[]>(`${this.api}/puntajes_peliculas`, {
        headers: this.headers,
        params: { select: 'pelicula_id,promedio,cantidad' },
      }),
      ventas: this.http.get<VentasPelicula[]>(`${this.api}/rpc/ranking_ventas`, { headers: this.headers }),
    }).pipe(
      map(({ peliculas, puntajes, ventas }) => {
        const puntajePorPelicula = new Map(puntajes.map((p) => [p.pelicula_id, p]));
        const ventasPorPelicula = new Map(ventas.map((v) => [v.pelicula_id, v.entradas_vendidas]));
        return peliculas.map((pelicula) => ({
          ...pelicula,
          promedio: puntajePorPelicula.get(pelicula.id)?.promedio ?? null,
          cantidad_resenias: puntajePorPelicula.get(pelicula.id)?.cantidad ?? 0,
          entradas_vendidas: ventasPorPelicula.get(pelicula.id) ?? 0,
        }));
      }),
    );
  }
}
