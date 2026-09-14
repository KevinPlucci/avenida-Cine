import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { NOMBRE_CINE } from '../../core/constantes';
import { SiRolDirective } from '../directives/si-rol.directive';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, SiRolDirective],
  template: `
    <header>
      <div class="contenedor barra">
        <a routerLink="/" class="logo">
          <svg class="logo-icono" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="#a61b1b" />
            <path d="M7 11h18v3.2a1.8 1.8 0 0 0 0 3.6V21H7v-3.2a1.8 1.8 0 0 0 0-3.6z" fill="#fff" />
            <path d="M20 11.8v8.4" stroke="#a61b1b" stroke-width="1.2" stroke-dasharray="1.4 1.1" />
          </svg>
          <span>{{ nombreCine }}</span>
        </a>
        <nav aria-label="Principal">
          <a routerLink="/" routerLinkActive="activo" [routerLinkActiveOptions]="{ exact: true }">Cartelera</a>
          <a *appSiRol="'admin'" routerLink="/admin" routerLinkActive="activo">Administración</a>
          <ng-container *appSiRol="['cliente', 'admin']">
            <a routerLink="/perfil" routerLinkActive="activo">Mi perfil</a>
            <button type="button" class="enlace" (click)="salir()">Salir</button>
          </ng-container>
          <ng-container *appSiRol="'invitado'">
            <a routerLink="/login" routerLinkActive="activo">Ingresar</a>
            <a routerLink="/registro" class="registrarse">Registrarse</a>
          </ng-container>
        </nav>
      </div>
    </header>
  `,
  styles: `
    header { color: #fff; background: var(--color-oscuro); border-bottom: 3px solid var(--color-primario); }
    .barra { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 24px; min-height: 64px; padding-block: 8px; }
    .logo { display: flex; align-items: center; gap: 10px; color: #fff; text-decoration: none; font: 600 1.35rem/1 var(--fuente-titulos); letter-spacing: .08em; text-transform: uppercase; }
    .logo-icono { width: 32px; height: 32px; }
    nav { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 20px; }
    nav a, .enlace { padding: 4px 0; font: inherit; font-size: .95rem; color: #d6d2cd; text-decoration: none; cursor: pointer; background: none; border: 0; }
    nav a:hover, .enlace:hover, nav a.activo { color: #fff; }
    nav a.activo { box-shadow: inset 0 -2px 0 var(--color-primario); }
    nav a.registrarse { padding: 5px 12px; color: #fff; border: 1px solid rgb(255 255 255 / 45%); border-radius: 6px; transition: background-color .15s, border-color .15s; }
    nav a.registrarse:hover { background: var(--color-primario); border-color: var(--color-primario); }
  `,
})
export class Header {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly nombreCine = NOMBRE_CINE;

  protected async salir(): Promise<void> {
    await this.auth.cerrarSesion();
    await this.router.navigateByUrl('/');
  }
}
