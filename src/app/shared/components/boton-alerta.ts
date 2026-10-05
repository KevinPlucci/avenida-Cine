import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AlertasService } from '../../core/services/alertas.service';
import { mensajeError } from '../../core/utils/errores';

/** Activa o desactiva la alerta de estreno de una película (email 08/03). Sin sesión lleva a ingresar. */
@Component({
  selector: 'app-boton-alerta',
  imports: [RouterLink],
  template: `
    @if (auth.logueado()) {
      <button
        type="button"
        class="btn btn-chico"
        [class.activa]="activa()"
        [attr.aria-pressed]="activa()"
        [disabled]="procesando()"
        (click)="alternar()"
      >
        {{ activa() ? 'Alerta activada' : 'Avisarme cuando salga a la venta' }}
      </button>
      @if (activa()) {
        <small class="meta">Te avisamos cuando se habilite la venta. Tocá de nuevo para desactivarla.</small>
      }
    } @else {
      <a class="btn btn-chico" routerLink="/login" [queryParams]="{ volver: '/peliculas/' + peliculaId() }">
        Avisarme cuando salga a la venta
      </a>
    }
    @if (error()) {
      <small class="error-texto">{{ error() }}</small>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
    .activa { color: var(--color-exito); border-color: var(--color-exito); }
  `,
})
export class BotonAlerta {
  protected readonly auth = inject(AuthService);
  private readonly alertas = inject(AlertasService);

  readonly peliculaId = input.required<number>();

  protected readonly activa = computed(() => this.alertas.activas().has(this.peliculaId()));
  protected readonly procesando = signal(false);
  protected readonly error = signal('');

  protected async alternar(): Promise<void> {
    this.error.set('');
    this.procesando.set(true);
    try {
      await this.alertas.alternar(this.peliculaId());
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.procesando.set(false);
    }
  }
}
