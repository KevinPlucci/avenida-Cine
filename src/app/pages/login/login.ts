import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { PORCENTAJE_CUPON_BIENVENIDA } from '../../core/constantes';
import { mensajeError } from '../../core/utils/errores';
import { ErrorCampo } from '../../shared/components/error-campo';
import { AutoFocoDirective } from '../../shared/directives/auto-foco.directive';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, ErrorCampo, AutoFocoDirective],
  template: `
    <div class="tarjeta form-chico" animate.enter="aparecer">
      <h1>Ingresar</h1>
      <form [formGroup]="form" (ngSubmit)="ingresar()">
        <label class="campo">
          <span>Email</span>
          <input type="email" formControlName="email" autocomplete="email" appAutoFoco />
          <app-error-campo [control]="form.controls.email" />
        </label>
        <label class="campo">
          <span>Contraseña</span>
          <input type="password" formControlName="password" autocomplete="current-password" />
          <app-error-campo [control]="form.controls.password" />
        </label>
        @if (error()) {
          <p class="alerta alerta-error" animate.enter="aparecer">{{ error() }}</p>
        }
        <button type="submit" class="btn btn-primario btn-bloque" [disabled]="enviando()">
          {{ enviando() ? 'Ingresando...' : 'Ingresar' }}
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
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly porcentaje = PORCENTAJE_CUPON_BIENVENIDA;
  protected readonly enviando = signal(false);
  protected readonly error = signal('');

  protected readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected async ingresar(): Promise<void> {
    this.error.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password } = this.form.getRawValue();
    this.enviando.set(true);
    try {
      await this.auth.iniciarSesion(email.trim(), password);
      await this.router.navigateByUrl(this.destinoSeguro());
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.enviando.set(false);
    }
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
