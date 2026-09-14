import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Solo usuarios logueados. Si no lo está, lo manda al login y después lo devuelve a donde quería ir. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.esperarSesion();
  return auth.logueado() || router.createUrlTree(['/login'], { queryParams: { volver: state.url } });
};

/** Solo administradores. */
export const adminGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.esperarSesion();
  if (!auth.logueado()) {
    return router.createUrlTree(['/login'], { queryParams: { volver: state.url } });
  }
  return auth.esAdmin() || router.createUrlTree(['/']);
};

/** Login y registro: si ya está logueado no tiene sentido entrar. */
export const invitadoGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.esperarSesion();
  return !auth.logueado() || router.createUrlTree(['/']);
};
