import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Combo, contenidoCombo, ProductoConCategoria } from '../../core/models/producto';
import { CombosService } from '../../core/services/combos.service';
import { ProductosService } from '../../core/services/productos.service';
import { mensajeError } from '../../core/utils/errores';
import { ErrorCampo } from '../../shared/components/error-campo';

const MAX_POR_PRODUCTO = 10;

@Component({
  selector: 'app-admin-combos',
  imports: [ReactiveFormsModule, CurrencyPipe, ErrorCampo],
  template: `
    <div class="tarjeta" id="form-combo">
      <div class="cabecera">
        <h2>{{ editando() ? 'Editar combo' : 'Nuevo combo' }}</h2>
        @if (editando()) {
          <button type="button" class="btn btn-chico" (click)="cancelarEdicion()">Cancelar edición</button>
        }
      </div>
      <p class="meta">
        Cada combo incluye una entrada más los productos que elijas, a un precio fijo. Se muestran destacados en la
        pantalla de compra y valen para cualquier función.
      </p>

      @if (cargando()) {
        <p class="cargando">Cargando...</p>
      } @else if (errorCarga()) {
        <p class="alerta alerta-error">{{ errorCarga() }}</p>
      } @else {
        <form [formGroup]="form" (ngSubmit)="guardar()">
          <div class="fila-campos">
            <label class="campo">
              <span>Nombre</span>
              <input formControlName="nombre" maxlength="60" placeholder="Ej: Combo clásico" />
              <app-error-campo [control]="form.controls.nombre" />
            </label>
            <label class="campo">
              <span>Precio fijo</span>
              <input type="number" formControlName="precio" min="0" step="100" />
              <app-error-campo [control]="form.controls.precio" />
            </label>
          </div>

          <label class="campo">
            <span>Descripción</span>
            <input formControlName="descripcion" maxlength="120" placeholder="Ej: Tu entrada con pochoclos y gaseosa" />
          </label>

          <div class="campo">
            <span>Productos del combo (además de la entrada)</span>
            <ul class="productos-combo">
              @for (producto of productos(); track producto.id) {
                <li [class.elegido]="cantidad(producto.id) > 0">
                  <span>
                    {{ producto.nombre }}
                    <small class="meta">{{ producto.precio | currency }}{{ producto.disponible ? '' : ' · sin stock' }}</small>
                  </span>
                  <span class="contador">
                    <button type="button" class="btn btn-chico" [disabled]="!cantidad(producto.id)" [attr.aria-label]="'Quitar ' + producto.nombre" (click)="sumar(producto.id, -1)">−</button>
                    <span class="cantidad">{{ cantidad(producto.id) }}</span>
                    <button type="button" class="btn btn-chico" [disabled]="cantidad(producto.id) >= maxPorProducto" [attr.aria-label]="'Agregar ' + producto.nombre" (click)="sumar(producto.id, 1)">+</button>
                  </span>
                </li>
              } @empty {
                <li class="meta">Primero cargá productos en la pestaña Candy bar.</li>
              }
            </ul>
            @if (sumaProductos()) {
              <small class="meta">Por separado, estos productos cuestan {{ sumaProductos() | currency }} más la entrada.</small>
            }
          </div>

          <label class="check">
            <input type="checkbox" formControlName="activo" />
            <span>Mostrar en la pantalla de compra</span>
          </label>

          @if (error()) {
            <p class="alerta alerta-error" animate.enter="aparecer">{{ error() }}</p>
          }
          @if (exito()) {
            <p class="alerta alerta-exito" animate.enter="aparecer">{{ exito() }}</p>
          }

          <button type="submit" class="btn btn-primario" [disabled]="guardando()">
            {{ guardando() ? 'Guardando...' : editando() ? 'Guardar cambios' : 'Crear combo' }}
          </button>
        </form>
      }
    </div>

    <section class="tarjeta">
      <h2>Combos</h2>
      <div class="tabla-contenedor">
        <table>
          <thead>
            <tr>
              <th>Combo</th>
              <th>Precio</th>
              <th>Activo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (combo of combos(); track combo.id) {
              <tr [class.fila-editando]="editando()?.id === combo.id">
                <td>
                  {{ combo.nombre }}
                  <small class="meta contenido">{{ contenido(combo) }}</small>
                </td>
                <td>{{ combo.precio | currency }}</td>
                <td>
                  <input
                    type="checkbox"
                    [checked]="combo.activo"
                    [attr.aria-label]="'Activo: ' + combo.nombre"
                    (change)="cambiarActivo(combo, $event)"
                  />
                </td>
                <td class="acciones-tabla">
                  <button type="button" class="btn btn-chico" (click)="editar(combo)">Editar</button>
                  <button type="button" class="btn btn-chico btn-peligro" (click)="eliminar(combo)">Eliminar</button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="4" class="vacio">Todavía no hay combos.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
  styles: `
    .productos-combo { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 6px 16px; margin: 4px 0 6px; padding: 0; list-style: none; }
    .productos-combo li { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 6px 10px; border: 1px solid var(--color-borde); border-radius: var(--radio); }
    .productos-combo li.elegido { border-color: var(--color-primario); background: var(--color-primario-suave); }
    .productos-combo small, .contenido { display: block; }
    .contador { display: flex; align-items: center; gap: 8px; }
    .cantidad { min-width: 2ch; text-align: center; font-variant-numeric: tabular-nums; }
  `,
})
export class AdminCombos implements OnInit {
  private readonly combosService = inject(CombosService);
  private readonly productosService = inject(ProductosService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly maxPorProducto = MAX_POR_PRODUCTO;
  protected readonly contenido = contenidoCombo;
  protected readonly combos = signal<Combo[]>([]);
  protected readonly productos = signal<ProductoConCategoria[]>([]);
  protected readonly editando = signal<Combo | null>(null);
  /** Cantidad de cada producto en el combo que se está armando. */
  protected readonly cantidades = signal<Record<number, number>>({});
  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly errorCarga = signal('');
  protected readonly error = signal('');
  protected readonly exito = signal('');

  protected readonly sumaProductos = computed(() =>
    this.productos().reduce((total, producto) => total + producto.precio * this.cantidad(producto.id), 0),
  );

  protected readonly form = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(60)]],
    descripcion: ['', Validators.maxLength(120)],
    precio: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    activo: [true],
  });

  async ngOnInit(): Promise<void> {
    try {
      const [combos, productos] = await Promise.all([this.combosService.listar(), this.productosService.listar()]);
      this.combos.set(combos);
      this.productos.set(productos);
    } catch (e) {
      this.errorCarga.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected cantidad(productoId: number): number {
    return this.cantidades()[productoId] ?? 0;
  }

  protected sumar(productoId: number, paso: number): void {
    const cantidad = Math.min(Math.max(this.cantidad(productoId) + paso, 0), MAX_POR_PRODUCTO);
    this.cantidades.update((actual) => ({ ...actual, [productoId]: cantidad }));
  }

  protected editar(combo: Combo): void {
    this.limpiarMensajes();
    this.editando.set(combo);
    this.form.setValue({ nombre: combo.nombre, descripcion: combo.descripcion, precio: combo.precio, activo: combo.activo });
    this.cantidades.set(Object.fromEntries(combo.productos.map((item) => [item.producto_id, item.cantidad])));
    document.getElementById('form-combo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected cancelarEdicion(): void {
    this.editando.set(null);
    this.form.reset({ descripcion: '', activo: true });
    this.cantidades.set({});
  }

  protected async guardar(): Promise<void> {
    this.limpiarMensajes();
    const productos = Object.entries(this.cantidades())
      .filter(([, cantidad]) => cantidad > 0)
      .map(([id, cantidad]) => ({ producto_id: Number(id), cantidad }));
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (!productos.length) {
      this.error.set('Elegí al menos un producto del candy bar.');
      return;
    }
    const { nombre, descripcion, precio, activo } = this.form.getRawValue();
    const datos = { nombre: nombre.trim(), descripcion: descripcion.trim(), precio: precio ?? 0, activo };
    this.guardando.set(true);
    try {
      await this.combosService.guardar(this.editando()?.id ?? null, datos, productos);
      this.exito.set(this.editando() ? `Se guardaron los cambios de "${datos.nombre}".` : `Se creó el combo "${datos.nombre}".`);
      this.cancelarEdicion();
      this.combos.set(await this.combosService.listar());
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  protected async cambiarActivo(combo: Combo, evento: Event): Promise<void> {
    const checkbox = evento.target as HTMLInputElement;
    this.limpiarMensajes();
    try {
      await this.combosService.cambiarActivo(combo.id, checkbox.checked);
      this.combos.update((lista) => lista.map((c) => (c.id === combo.id ? { ...c, activo: checkbox.checked } : c)));
    } catch (e) {
      checkbox.checked = !checkbox.checked;
      this.error.set(mensajeError(e));
    }
  }

  protected async eliminar(combo: Combo): Promise<void> {
    if (!confirm(`¿Eliminar "${combo.nombre}"?`)) return;
    this.limpiarMensajes();
    try {
      await this.combosService.eliminar(combo.id);
      if (this.editando()?.id === combo.id) this.cancelarEdicion();
      this.combos.update((lista) => lista.filter((c) => c.id !== combo.id));
    } catch (e) {
      const codigo = (e as { code?: string }).code;
      this.error.set(codigo === '23503' ? 'El combo ya se vendió: desactivalo para que no se muestre más.' : mensajeError(e));
    }
  }

  private limpiarMensajes(): void {
    this.error.set('');
    this.exito.set('');
  }
}
