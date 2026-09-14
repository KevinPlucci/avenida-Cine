import { HttpErrorResponse, HttpEventType, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, finalize, tap, throwError } from 'rxjs';
import { EstadoRedService } from './estado-red.service';

/** Cuenta las peticiones en curso para mostrar la barra de carga. */
export const cargaInterceptor: HttpInterceptorFn = (peticion, siguiente) => {
  const estado = inject(EstadoRedService);
  estado.inicioPeticion();
  return siguiente(peticion).pipe(finalize(() => estado.finPeticion()));
};

/** Detecta la falta de conexión (status 0) para avisarle al usuario. */
export const conexionInterceptor: HttpInterceptorFn = (peticion, siguiente) => {
  const estado = inject(EstadoRedService);
  return siguiente(peticion).pipe(
    tap((evento) => {
      if (evento.type === HttpEventType.Response) estado.registrarResultado(true);
    }),
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) estado.registrarResultado(error.status !== 0);
      return throwError(() => error);
    }),
  );
};
