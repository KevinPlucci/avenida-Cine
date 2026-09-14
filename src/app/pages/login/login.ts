import { Component, inject, signal } from '@angular/core';
import { email, form, FormField, required, submit } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { PORCENTAJE_CUPON_BIENVENIDA } from '../../core/constantes';
import { mensajeError } from '../../core/utils/errores';
import { AutoFocoDirective } from '../../shared/directives/auto-foco.directive';

@Component({
  selector: 'app-login',
  imports: [FormField, RouterLink, AutoFocoDirective],
  template: `
    <div class="tarjeta form-chico" animate.enter="aparecer">
      <h1>Ingresar</h1>
      <form novalidate (submit)="ingresar($event)">
        <label class="campo">
          <span>Email</span>
          <input type="email" [formField]="loginForm.email" autocomplete="email" appAutoFoco />
          @if (loginForm.email().touched() && loginForm.email().invalid()) {
            <small class="error-texto">{{ loginForm.email().errors()[0]?.message }}</small>
          }
        </label>
        <label class="campo">
          <span>Contraseña</span>
          <input type="password" [formField]="loginForm.password" autocomplete="current-password" />
          @if (loginForm.password().touched() && loginForm.password().invalid()) {
            <small class="error-texto">{{ loginForm.password().errors()[0]?.message }}</small>
          }
        </label>
        @if (error()) {
          <p class="alerta alerta-error" animate.enter="aparecer">{{ error() }}</p>
        }
        <button type="submit" class="btn btn-primario btn-bloque" [disabled]="loginForm().submitting()">
          {{ loginForm().submitting() ? 'Ingresando...' : 'Ingresar' }}
        </button>
      </form>
      <p class="meta pie">
        ¿No tenés cuenta? <a routerLink="/registro">Registrate</a> y obtené {{ porcentaje }}% de descuento en tu
        primera compra.
      </p>
    </div>
  `,
  styles: `
    .pie { margin-top: 16px; }
  `,
})
export class Login {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly porcentaje = PORCENTAJE_CUPON_BIENVENIDA;
  protected readonly error = signal('');

  // Signal Forms: el modelo del formulario es un signal y form() le agrega las validaciones.
  private readonly credenciales = signal({ email: '', password: '' });
  protected readonly loginForm = form(this.credenciales, (campo) => {
    required(campo.email, { message: 'Este campo es obligatorio.' });
    email(campo.email, { message: 'Ingresá un email válido.' });
    required(campo.password, { message: 'Este campo es obligatorio.' });
  });

  protected async ingresar(evento: Event): Promise<void> {
    evento.preventDefault();
    this.error.set('');
    // submit() ejecuta la acción solo si el formulario es válido.
    await submit(this.loginForm, async () => {
      const { email: correo, password } = this.credenciales();
      try {
        await this.auth.iniciarSesion(correo.trim(), password);
        await this.router.navigateByUrl(this.destinoSeguro());
      } catch (e) {
        this.error.set(mensajeError(e));
      }
    });
  }

  /**
   * Query param ?volver=/ruta: a dónde regresar después de ingresar (lo agregan los guards y los links "Ingresá").
   * Solo se aceptan rutas internas, para no redirigir a otro sitio.
   */
  private destinoSeguro(): string {
    const destino = this.route.snapshot.queryParamMap.get('volver');
    return destino?.startsWith('/') && !destino.startsWith('//') ? destino : '/';
  }
}
