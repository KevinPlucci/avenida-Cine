import { Routes } from '@angular/router';
import { adminGuard, authGuard, invitadoGuard } from './core/auth/auth.guards';

// Todas las pantallas se cargan de forma diferida (lazy loading).
export const routes: Routes = [
  {
    path: '',
    title: 'Cartelera',
    loadComponent: () => import('./pages/inicio/inicio').then((m) => m.Inicio),
  },
  {
    path: 'peliculas/:id',
    title: 'Película',
    loadComponent: () => import('./pages/pelicula-detalle/pelicula-detalle').then((m) => m.PeliculaDetalle),
  },
  {
    path: 'funciones/:id/comprar',
    title: 'Comprar entradas',
    loadComponent: () => import('./pages/comprar-entradas/comprar-entradas').then((m) => m.ComprarEntradas),
  },
  {
    path: 'compras/:codigo',
    title: 'Tu entrada',
    loadComponent: () => import('./pages/ver-compra/ver-compra').then((m) => m.VerCompra),
  },
  {
    path: 'login',
    title: 'Ingresar',
    canActivate: [invitadoGuard],
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    path: 'registro',
    title: 'Crear cuenta',
    canActivate: [invitadoGuard],
    loadComponent: () => import('./pages/registro/registro').then((m) => m.Registro),
  },
  {
    path: 'perfil',
    title: 'Mi perfil',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/mi-perfil/mi-perfil').then((m) => m.MiPerfil),
  },
  {
    path: 'admin',
    canMatch: [adminGuard],
    loadChildren: () => import('./pages/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  {
    path: '**',
    title: 'Página no encontrada',
    loadComponent: () => import('./pages/no-encontrada/no-encontrada').then((m) => m.NoEncontrada),
  },
];
