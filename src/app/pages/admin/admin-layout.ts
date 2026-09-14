import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <h1>Administración</h1>
    <nav class="pestanias">
      <a routerLink="peliculas" routerLinkActive="activo">Películas</a>
      <a routerLink="funciones" routerLinkActive="activo">Funciones</a>
      <a routerLink="salas" routerLinkActive="activo">Salas</a>
      <a routerLink="generos" routerLinkActive="activo">Géneros</a>
    </nav>
    <router-outlet />
  `,
  styles: `
    .pestanias { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 20px; border-bottom: 1px solid var(--color-borde); }
    .pestanias a { margin-bottom: -1px; padding: 8px 14px; border: 1px solid transparent; border-bottom: 0; border-radius: var(--radio) var(--radio) 0 0; color: var(--color-texto); text-decoration: none; }
    .pestanias a.activo { background: #fff; border-color: var(--color-borde); font-weight: 600; }
  `,
})
export class AdminLayout {}
