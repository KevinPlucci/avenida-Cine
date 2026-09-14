import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { PORCENTAJE_CUPON_BIENVENIDA } from '../../core/constantes';
import { COLORES_OJOS, TIPOS_SANGRE } from '../../core/models/perfil';
import { mensajeError } from '../../core/utils/errores';
import { ErrorCampo } from '../../shared/components/error-campo';
import { fechaNacimientoValidator, passwordsIgualesValidator } from '../../shared/validators';

@Component({
  selector: 'app-registro',
  imports: [ReactiveFormsModule, RouterLink, ErrorCampo],
  templateUrl: './registro.html',
  styleUrl: './registro.css',
})
export class Registro {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly porcentaje = PORCENTAJE_CUPON_BIENVENIDA;
  protected readonly tiposSangre = TIPOS_SANGRE;
  protected readonly coloresOjos = COLORES_OJOS;
  // Fecha con tres selects en lugar de un calendario: se elige el año directo, sin navegar mes por mes.
  protected readonly dias = Array.from({ length: 31 }, (_, i) => i + 1);
  protected readonly meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  protected readonly anios = Array.from({ length: 101 }, (_, i) => new Date().getFullYear() - i);

  protected readonly enviando = signal(false);
  protected readonly error = signal('');
  protected readonly emailPendiente = signal('');

  protected readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    passwords: this.fb.group(
      {
        password: ['', [Validators.required, Validators.minLength(6)]],
        confirmacion: ['', Validators.required],
      },
      { validators: passwordsIgualesValidator },
    ),
    nombre: ['', [Validators.required, Validators.maxLength(50)]],
    apellido: ['', [Validators.required, Validators.maxLength(50)]],
    nacimiento: this.fb.group(
      {
        dia: ['', Validators.required],
        mes: ['', Validators.required],
        anio: ['', Validators.required],
      },
      { validators: fechaNacimientoValidator },
    ),
    tipoSangre: ['', Validators.required],
    colorOjos: ['', Validators.required],
    diasVacaciones: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(0),
      Validators.max(365),
      Validators.pattern(/^\d+$/),
    ]),
  });

  protected async registrar(): Promise<void> {
    this.error.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const valores = this.form.getRawValue();
    const { dia, mes, anio } = valores.nacimiento;
    this.enviando.set(true);
    try {
      const { requiereConfirmacion } = await this.auth.registrarse({
        email: valores.email.trim(),
        password: valores.passwords.password,
        nombre: valores.nombre.trim(),
        apellido: valores.apellido.trim(),
        fecha_nacimiento: `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`,
        tipo_sangre: valores.tipoSangre,
        color_ojos: valores.colorOjos,
        dias_vacaciones: valores.diasVacaciones ?? 0,
      });

      if (requiereConfirmacion) {
        this.emailPendiente.set(valores.email.trim());
      } else {
        await this.router.navigateByUrl('/perfil');
      }
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.enviando.set(false);
    }
  }
}
