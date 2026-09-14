import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

/** Estados HTTP que no llevan cuerpo: el constructor de Response falla si se le pasa uno. */
const ESTADOS_SIN_CUERPO = [101, 204, 205, 304];

/**
 * Adapta HttpClient a la firma de fetch para pasárselo a supabase-js.
 * Así todas las llamadas a Supabase (base de datos, autenticación y storage) salen por HttpClient
 * y pasan por los interceptores de la aplicación.
 */
export function crearFetchConHttpClient(http: HttpClient): typeof fetch {
  return async (entrada: RequestInfo | URL, opciones: RequestInit = {}): Promise<Response> => {
    const url = entrada instanceof Request ? entrada.url : String(entrada);
    const metodo = (opciones.method ?? (entrada instanceof Request ? entrada.method : 'GET')).toUpperCase();

    // supabase-js puede mandar los headers como objeto Headers, arreglo u objeto común.
    let headers = new HttpHeaders();
    new Headers(opciones.headers).forEach((valor, nombre) => {
      headers = headers.set(nombre, valor);
    });

    try {
      const respuesta = await firstValueFrom(
        http.request(metodo, url, {
          body: opciones.body ?? null,
          headers,
          observe: 'response',
          responseType: 'text',
        }),
      );
      return crearResponse(respuesta.status, respuesta.headers, respuesta.body, metodo);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status !== 0) {
        const cuerpo = typeof error.error === 'string' ? error.error : JSON.stringify(error.error ?? '');
        return crearResponse(error.status, error.headers, cuerpo, metodo);
      }
      // Igual que fetch: un error de red se informa con TypeError.
      throw new TypeError('Failed to fetch');
    }
  };
}

function crearResponse(status: number, headers: HttpHeaders, cuerpo: string | null, metodo: string): Response {
  const headersRespuesta = new Headers();
  for (const nombre of headers.keys()) {
    for (const valor of headers.getAll(nombre) ?? []) {
      headersRespuesta.append(nombre, valor);
    }
  }
  const sinCuerpo = ESTADOS_SIN_CUERPO.includes(status) || metodo === 'HEAD';
  return new Response(sinCuerpo ? null : (cuerpo ?? ''), { status, headers: headersRespuesta });
}
