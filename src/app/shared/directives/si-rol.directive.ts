import { Directive, effect, inject, input, TemplateRef, ViewContainerRef } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';

export type RolVisible = 'invitado' | 'cliente' | 'admin';

/**
 * Directiva estructural: muestra el contenido solo para ciertos roles.
 * Uso: <a *appSiRol="'admin'">...</a> o <div *appSiRol="['cliente', 'admin']">...</div>
 */
@Directive({ selector: '[appSiRol]' })
export class SiRolDirective {
  readonly appSiRol = input.required<RolVisible | RolVisible[]>();

  private readonly auth = inject(AuthService);
  private readonly plantilla = inject(TemplateRef<unknown>);
  private readonly contenedor = inject(ViewContainerRef);
  private visible = false;

  constructor() {
    // Se vuelve a evaluar cada vez que cambia la sesión o el rol.
    effect(() => {
      const roles = ([] as RolVisible[]).concat(this.appSiRol());
      const rolActual: RolVisible = !this.auth.logueado() ? 'invitado' : this.auth.esAdmin() ? 'admin' : 'cliente';
      const mostrar = roles.includes(rolActual);

      if (mostrar && !this.visible) {
        this.contenedor.createEmbeddedView(this.plantilla);
      } else if (!mostrar && this.visible) {
        this.contenedor.clear();
      }
      this.visible = mostrar;
    });
  }
}
