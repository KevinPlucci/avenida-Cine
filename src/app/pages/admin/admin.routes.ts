import { Routes } from '@angular/router';
import { AdminLayout } from './admin-layout';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: AdminLayout,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'peliculas' },
      {
        path: 'peliculas',
        title: 'Películas',
        loadComponent: () => import('./admin-peliculas').then((m) => m.AdminPeliculas),
      },
      {
        path: 'peliculas/nueva',
        title: 'Nueva película',
        loadComponent: () => import('./pelicula-form').then((m) => m.PeliculaForm),
      },
      {
        path: 'peliculas/:id',
        title: 'Editar película',
        loadComponent: () => import('./pelicula-form').then((m) => m.PeliculaForm),
      },
      {
        path: 'funciones',
        title: 'Funciones',
        loadComponent: () => import('./admin-funciones').then((m) => m.AdminFunciones),
      },
      {
        path: 'salas',
        title: 'Salas',
        loadComponent: () => import('./admin-salas').then((m) => m.AdminSalas),
      },
      {
        path: 'generos',
        title: 'Géneros',
        loadComponent: () => import('./admin-generos').then((m) => m.AdminGeneros),
      },
    ],
  },
];
