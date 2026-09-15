import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, CanDeactivateFn, CanMatchFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** canActivate: solo usuarios logueados. Si no lo está, lo manda al login y después lo devuelve a donde quería ir. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.esperarSesion();
  return auth.logueado() || router.createUrlTree(['/login'], { queryParams: { volver: state.url } });
};

/**
 * canMatch: la sección de administración solo coincide para administradores.
 * Se evalúa antes de cargar la ruta lazy, así el código del panel no se descarga para el resto de los usuarios.
 */
export const adminGuard: CanMatchFn = async (_route, segmentos) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.esperarSesion();
  if (!auth.logueado()) {
    const volver = '/' + segmentos.map((segmento) => segmento.path).join('/');
    return router.createUrlTree(['/login'], { queryParams: { volver } });
  }
  return auth.esAdmin() || router.createUrlTree(['/']);
};

/**
 * canMatch: la pantalla de validación de QR solo coincide para empleados y administradores.
 * Igual que con el panel, el código no se descarga para el resto de los usuarios.
 */
export const empleadoGuard: CanMatchFn = async (_route, segmentos) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.esperarSesion();
  if (!auth.logueado()) {
    const volver = '/' + segmentos.map((segmento) => segmento.path).join('/');
    return router.createUrlTree(['/login'], { queryParams: { volver } });
  }
  return auth.esEmpleado() || router.createUrlTree(['/']);
};

/** canActivate: vuelve a leer el rol desde la base antes de abrir la validación de QR. */
export const rolEmpleadoVigenteGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.refrescarPerfil();
  return auth.esEmpleado() || router.createUrlTree(['/']);
};

/**
 * canActivateChild: antes de entrar a cada pantalla del panel vuelve a leer el rol desde la base,
 * por si se lo quitaron o se cerró la sesión mientras navegaba por el panel.
 */
export const rolAdminVigenteGuard: CanActivateChildFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.refrescarPerfil();
  return auth.esAdmin() || router.createUrlTree(['/']);
};

/** canActivate: login y registro no tienen sentido con la sesión iniciada. */
export const invitadoGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.esperarSesion();
  return !auth.logueado() || router.createUrlTree(['/']);
};

/** Pantallas que pueden tener cambios sin guardar. */
export interface ConCambiosSinGuardar {
  tieneCambiosSinGuardar(): boolean;
}

/** canDeactivate: pide confirmación antes de salir de una pantalla con cambios sin guardar. */
export const cambiosSinGuardarGuard: CanDeactivateFn<ConCambiosSinGuardar> = (pantalla) =>
  !pantalla.tieneCambiosSinGuardar() || confirm('Tenés cambios sin guardar. ¿Querés salir igual?');
