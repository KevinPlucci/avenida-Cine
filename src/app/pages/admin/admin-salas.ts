import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Sala } from '../../core/models/sala';
import { SalasService } from '../../core/services/salas.service';
import { BLOQUES, FILAS } from '../../core/utils/butacas';
import { mensajeError } from '../../core/utils/errores';

@Component({
  selector: 'app-admin-salas',
  imports: [FormsModule],
  template: `
    <div class="tarjeta">
      <h2>Salas</h2>
      <p class="meta">
        Todas las salas tienen la misma distribución: {{ filas }} filas (A a T) con bloques de
        {{ bloques.join(', ') }} butacas ({{ totalButacas }} butacas en total).
        Las salas inactivas no se pueden usar para funciones nuevas.
      </p>

      <!-- Formulario template-driven: el campo y su validación se definen en el template con ngModel -->
      <form class="form-en-linea" #formSala="ngForm" (ngSubmit)="crear(formSala)">
        <label class="campo">
          <span>Nueva sala</span>
          <input name="nombre" [(ngModel)]="nombre" #campoNombre="ngModel" required maxlength="40" placeholder="Ej: Sala 5" />
          @if (campoNombre.touched && !nombre().trim()) {
            <small class="error-texto">Este campo es obligatorio.</small>
          }
        </label>
        <button type="submit" class="btn btn-primario" [disabled]="guardando()">Agregar</button>
      </form>

      @if (error()) {
        <p class="alerta alerta-error" animate.enter="aparecer">{{ error() }}</p>
      }

      @if (cargando()) {
        <p class="cargando">Cargando...</p>
      } @else {
        <div class="tabla-contenedor">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Activa</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (sala of salas(); track sala.id) {
                <tr>
                  <td>{{ sala.nombre }}</td>
                  <td>
                    <input
                      type="checkbox"
                      [checked]="sala.activa"
                      [attr.aria-label]="'Activa: ' + sala.nombre"
                      (change)="cambiarActiva(sala, $event)"
                    />
                  </td>
                  <td class="acciones-tabla">
                    <button type="button" class="btn btn-chico btn-peligro" (click)="eliminar(sala)">Eliminar</button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="3" class="vacio">No hay salas cargadas.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class AdminSalas implements OnInit {
  private readonly salasService = inject(SalasService);

  protected readonly filas = FILAS.length;
  protected readonly bloques = BLOQUES;
  protected readonly totalButacas = FILAS.length * BLOQUES.reduce((suma, cantidad) => suma + cantidad, 0);

  protected readonly nombre = signal('');
  protected readonly salas = signal<Sala[]>([]);
  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly error = signal('');

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  protected async crear(formulario: NgForm): Promise<void> {
    this.error.set('');
    const nombre = this.nombre().trim();
    if (formulario.invalid || !nombre) {
      formulario.control.markAllAsTouched();
      return;
    }
    this.guardando.set(true);
    try {
      await this.salasService.crear(nombre);
      formulario.resetForm({ nombre: '' });
      await this.cargar();
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  protected async cambiarActiva(sala: Sala, evento: Event): Promise<void> {
    const checkbox = evento.target as HTMLInputElement;
    this.error.set('');
    try {
      await this.salasService.cambiarActiva(sala.id, checkbox.checked);
      this.salas.update((lista) => lista.map((s) => (s.id === sala.id ? { ...s, activa: checkbox.checked } : s)));
    } catch (e) {
      checkbox.checked = !checkbox.checked;
      this.error.set(mensajeError(e));
    }
  }

  protected async eliminar(sala: Sala): Promise<void> {
    if (!confirm(`¿Eliminar "${sala.nombre}"?`)) return;
    this.error.set('');
    try {
      await this.salasService.eliminar(sala.id);
      this.salas.update((lista) => lista.filter((s) => s.id !== sala.id));
    } catch (e) {
      this.error.set(mensajeError(e));
    }
  }

  private async cargar(): Promise<void> {
    try {
      this.salas.set(await this.salasService.listar());
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }
}
