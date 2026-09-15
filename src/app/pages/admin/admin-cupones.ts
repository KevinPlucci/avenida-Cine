import { Component, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CuponesService } from '../../core/services/cupones.service';
import { mensajeError } from '../../core/utils/errores';
import { ErrorCampo } from '../../shared/components/error-campo';

@Component({
  selector: 'app-admin-cupones',
  imports: [ReactiveFormsModule, ErrorCampo],
  template: `
    <div class="tarjeta">
      <h2>Descuentos</h2>
      <p class="meta">
        Los dos descuentos se aplican solo sobre las entradas, no sobre el candy bar, y no se acumulan:
        si a un usuario le corresponden los dos, se usa el más alto.
      </p>

      @if (cargando()) {
        <p class="cargando">Cargando...</p>
      } @else {
        <form [formGroup]="form" (ngSubmit)="guardar()">
          <fieldset formGroupName="primera_compra">
            <legend>Cupón de bienvenida</legend>
            <p class="meta">
              Se entrega al registrarse y se usa una sola vez. Cambiar el porcentaje afecta a los cupones nuevos:
              los ya entregados mantienen el porcentaje con el que se emitieron.
            </p>
            <div class="fila-campos">
              <label class="campo campo-corto">
                <span>Porcentaje</span>
                <input type="number" formControlName="porcentaje" min="1" max="100" />
                <app-error-campo [control]="form.controls.primera_compra.controls.porcentaje" />
              </label>
              <label class="check">
                <input type="checkbox" formControlName="activo" />
                <span>Entregar el cupón a los usuarios nuevos</span>
              </label>
            </div>
          </fieldset>

          <fieldset formGroupName="mayores">
            <legend>Descuento por edad</legend>
            <p class="meta">
              Se aplica en todas las compras de los usuarios registrados que superan la edad indicada.
              Las compras sin cuenta no tienen fecha de nacimiento, así que no acceden a este descuento.
            </p>
            <div class="fila-campos">
              <label class="campo campo-corto">
                <span>Porcentaje</span>
                <input type="number" formControlName="porcentaje" min="1" max="100" />
                <app-error-campo [control]="form.controls.mayores.controls.porcentaje" />
              </label>
              <label class="campo campo-corto">
                <span>Para mayores de</span>
                <input type="number" formControlName="edad_minima" min="0" max="120" />
                <app-error-campo [control]="form.controls.mayores.controls.edad_minima" />
              </label>
              <label class="check">
                <input type="checkbox" formControlName="activo" />
                <span>Aplicar este descuento</span>
              </label>
            </div>
          </fieldset>

          @if (error()) {
            <p class="alerta alerta-error" animate.enter="aparecer">{{ error() }}</p>
          }
          @if (exito()) {
            <p class="alerta alerta-exito" animate.enter="aparecer">{{ exito() }}</p>
          }

          <button type="submit" class="btn btn-primario" [disabled]="guardando()">
            {{ guardando() ? 'Guardando...' : 'Guardar descuentos' }}
          </button>
        </form>
      }
    </div>
  `,
})
export class AdminCupones implements OnInit {
  private readonly cuponesService = inject(CuponesService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly error = signal('');
  protected readonly exito = signal('');

  protected readonly form = this.fb.group({
    primera_compra: this.fb.group({
      porcentaje: [20, [Validators.required, Validators.min(1), Validators.max(100)]],
      activo: [true],
    }),
    mayores: this.fb.group({
      porcentaje: [15, [Validators.required, Validators.min(1), Validators.max(100)]],
      edad_minima: [50, [Validators.required, Validators.min(0), Validators.max(120)]],
      activo: [true],
    }),
  });

  async ngOnInit(): Promise<void> {
    try {
      const reglas = await this.cuponesService.listarReglas();
      for (const regla of reglas) {
        if (regla.tipo === 'primera_compra') {
          this.form.controls.primera_compra.patchValue({
            porcentaje: regla.porcentaje,
            activo: regla.activo,
          });
        } else {
          this.form.controls.mayores.patchValue({
            porcentaje: regla.porcentaje,
            edad_minima: regla.edad_minima ?? 50,
            activo: regla.activo,
          });
        }
      }
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected async guardar(): Promise<void> {
    this.error.set('');
    this.exito.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { primera_compra, mayores } = this.form.getRawValue();
    this.guardando.set(true);
    try {
      await this.cuponesService.guardarRegla('primera_compra', {
        porcentaje: Number(primera_compra.porcentaje),
        activo: primera_compra.activo,
      });
      await this.cuponesService.guardarRegla('mayores', {
        porcentaje: Number(mayores.porcentaje),
        edad_minima: Number(mayores.edad_minima),
        activo: mayores.activo,
      });
      this.exito.set('Se guardaron los descuentos.');
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }
}
