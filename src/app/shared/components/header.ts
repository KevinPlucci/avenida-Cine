import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { NOMBRE_CINE } from '../../core/constantes';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header>
      <div class="contenedor barra">
        <a routerLink="/" class="logo">{{ nombreCine }}</a>
        <nav>
          <a routerLink="/" routerLinkActive="activo" [routerLinkActiveOptions]="{ exact: true }">Cartelera</a>
          @if (auth.esAdmin()) {
            <a routerLink="/admin" routerLinkActive="activo">Administración</a>
          }
          @if (auth.logueado()) {
            <a routerLink="/perfil" routerLinkActive="activo">Mi perfil</a>
            <button type="button" class="link-nav" (click)="salir()">Salir</button>
          } @else {
            <a routerLink="/login" routerLinkActive="activo">Ingresar</a>
            <a routerLink="/registro" routerLinkActive="activo">Registrarse</a>
          }
        </nav>
      </div>
    </header>
  `,
  styles: `
    header { background: #1f1f1f; color: #fff; }
    .barra { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 24px; min-height: 56px; padding-block: 8px; }
    .logo { color: #fff; font-size: 1.2rem; font-weight: 700; text-decoration: none; }
    nav { display: flex; flex-wrap: wrap; gap: 4px 18px; }
    nav a, .link-nav { color: #ddd; text-decoration: none; font: inherit; font-size: .95rem; background: none; border: 0; padding: 0; cursor: pointer; }
    nav a:hover, .link-nav:hover, nav a.activo { color: #fff; text-decoration: underline; text-underline-offset: 4px; }
  `,
})
export class Header {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly nombreCine = NOMBRE_CINE;

  protected async salir(): Promise<void> {
    await this.auth.cerrarSesion();
    await this.router.navigateByUrl('/');
  }
}
