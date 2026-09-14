import { Component, input } from '@angular/core';
import { AbstractControl } from '@angular/forms';

const MENSAJES: Record<string, (detalle: { requiredLength?: number; min?: number; max?: number }) => string> = {
  required: () => 'Este campo es obligatorio.',
  email: () => 'Ingresá un email válido.',
  minlength: (d) => `Tiene que tener al menos ${d.requiredLength} caracteres.`,
  maxlength: (d) => `Puede tener como máximo ${d.requiredLength} caracteres.`,
  min: (d) => `El valor mínimo es ${d.min}.`,
  max: (d) => `El valor máximo es ${d.max}.`,
  passwordsDistintas: () => 'Las contraseñas no coinciden.',
  fechaInvalida: () => 'Esa fecha no existe.',
  fechaFutura: () => 'La fecha no puede ser futura.',
  formatoVencimiento: () => 'Usá el formato MM/AA.',
  tarjetaVencida: () => 'La tarjeta está vencida.',
  enElPasado: () => 'El horario ya pasó.',
};

/** Muestra el primer error de un control una vez que el usuario lo tocó. */
@Component({
  selector: 'app-error-campo',
  template: `
    @if (mensaje(); as texto) {
      <small class="error-texto">{{ texto }}</small>
    }
  `,
})
export class ErrorCampo {
  readonly control = input.required<AbstractControl>();
  /** Mensaje para el error "pattern", que depende de cada campo. */
  readonly mensajePatron = input('El formato no es válido.');

  protected mensaje(): string | null {
    const control = this.control();
    if (!control.touched || !control.errors) return null;

    const [clave, detalle] = Object.entries(control.errors)[0];
    if (clave === 'pattern') return this.mensajePatron();
    return MENSAJES[clave]?.(detalle) ?? 'El valor no es válido.';
  }
}
