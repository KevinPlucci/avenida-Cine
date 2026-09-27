import { CurrencyPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormRecord, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProductoConCategoria } from '../../core/models/producto';
import { Recompensa } from '../../core/models/puntos';
import { ProductosService } from '../../core/services/productos.service';
import { PuntosService } from '../../core/services/puntos.service';
import { mensajeError } from '../../core/utils/errores';
import { ErrorCampo } from '../../shared/components/error-campo';

@Component({
  selector: 'app-admin-puntos',
  imports: [ReactiveFormsModule, CurrencyPipe, ErrorCampo],
  template: `
    <div class="tarjeta">
      <h2>Programa de puntos</h2>
      <p class="meta">
        Los usuarios registrados suman 1 punto por cada peso que pagan y los canjean al comprar.
        Acá se define cuántos puntos cuesta cada recompensa. Los puntos no se pueden transferir entre usuarios.
      </p>

      @if (cargando()) {
        <p class="cargando">Cargando...</p>
      } @else if (errorCarga()) {
        <p class="alerta alerta-error">{{ errorCarga() }}</p>
      } @else {
        <form [formGroup]="form" (ngSubmit)="guardar()">
          <fieldset formGroupName="entrada">
            <legend>Entrada gratis</legend>
            <div class="fila-campos">
              <label class="campo campo-corto">
                <span>Puntos</span>
                <input type="number" formControlName="puntos" min="1" step="50" />
                <app-error-campo [control]="form.controls.entrada.controls.puntos" />
              </label>
              <label class="check">
                <input type="checkbox" formControlName="activa" />
                <span>Se puede canjear</span>
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Productos del candy bar</legend>
            <p class="meta">Dejá vacío el producto que no se puede canjear.</p>
            <div class="tabla-contenedor">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Precio</th>
                    <th>Puntos</th>
                  </tr>
                </thead>
                <tbody [formGroup]="form.controls.productos">
                  @for (producto of productos(); track producto.id) {
                    <tr>
                      <td>
                        {{ producto.nombre }}
                        @if (!producto.disponible) {
                          <small class="meta">(sin stock)</small>
                        }
                      </td>
                      <td>{{ producto.precio | currency }}</td>
                      <td>
                        <input
                          type="number"
                          class="puntos"
                          min="1"
                          step="10"
                          placeholder="No se canjea"
                          [formControlName]="producto.id.toString()"
                          [attr.aria-label]="'Puntos de ' + producto.nombre"
                        />
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="3" class="vacio">No hay productos cargados.</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </fieldset>

          @if (error()) {
            <p class="alerta alerta-error" animate.enter="aparecer">{{ error() }}</p>
          }
          @if (exito()) {
            <p class="alerta alerta-exito" animate.enter="aparecer">{{ exito() }}</p>
          }

          <button type="submit" class="btn btn-primario" [disabled]="guardando()">
            {{ guardando() ? 'Guardando...' : 'Guardar puntos' }}
          </button>
        </form>
      }
    </div>
  `,
  styles: `
    input.puntos { max-width: 150px; }
    input.puntos.ng-invalid { border-color: var(--color-error); }
  `,
})
export class AdminPuntos implements OnInit {
  private readonly puntosService = inject(PuntosService);
  private readonly productosService = inject(ProductosService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly productos = signal<ProductoConCategoria[]>([]);
  private recompensas: Recompensa[] = [];
  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly errorCarga = signal('');
  protected readonly error = signal('');
  protected readonly exito = signal('');

  protected readonly form = this.fb.group({
    entrada: this.fb.group({
      puntos: this.fb.control<number | null>(500, [Validators.required, Validators.min(1)]),
      activa: [true],
    }),
    // Un control por producto: los puntos que cuesta canjearlo (vacío = no se canjea).
    productos: new FormRecord<FormControl<number | null>>({}),
  });

  async ngOnInit(): Promise<void> {
    try {
      const [productos, recompensas] = await Promise.all([
        this.productosService.listar(),
        this.puntosService.recompensas(),
      ]);
      this.productos.set(productos);
      this.recompensas = recompensas;
      const entrada = recompensas.find((r) => r.tipo === 'entrada');
      if (entrada) {
        this.form.controls.entrada.setValue({ puntos: entrada.puntos, activa: entrada.activa });
      }
      for (const producto of productos) {
        const puntos = recompensas.find((r) => r.producto_id === producto.id)?.puntos ?? null;
        this.form.controls.productos.addControl(String(producto.id), new FormControl(puntos, Validators.min(1)));
      }
    } catch (e) {
      this.errorCarga.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected async guardar(): Promise<void> {
    this.error.set('');
    this.exito.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Revisá los puntos: tienen que ser números mayores a cero.');
      return;
    }
    const { entrada, productos } = this.form.getRawValue();
    this.guardando.set(true);
    try {
      await this.puntosService.guardarEntrada(Number(entrada.puntos), entrada.activa);
      // Solo se guardan los productos que cambiaron.
      for (const [id, valor] of Object.entries(productos)) {
        const puntos = valor ? Number(valor) : null;
        const anterior = this.recompensas.find((r) => r.producto_id === Number(id))?.puntos ?? null;
        if (puntos !== anterior) {
          await this.puntosService.guardarProducto(Number(id), puntos);
        }
      }
      this.recompensas = await this.puntosService.recompensas();
      this.exito.set('Se guardaron los puntos de las recompensas.');
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }
}
