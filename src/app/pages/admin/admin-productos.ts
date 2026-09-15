import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NgForm, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CategoriaProducto, ProductoConCategoria } from '../../core/models/producto';
import { ProductosService } from '../../core/services/productos.service';
import { mensajeError } from '../../core/utils/errores';
import { ErrorCampo } from '../../shared/components/error-campo';

@Component({
  selector: 'app-admin-productos',
  imports: [ReactiveFormsModule, FormsModule, CurrencyPipe, ErrorCampo],
  template: `
    <div class="tarjeta" id="form-producto">
      <div class="cabecera">
        <h2>{{ editando() ? 'Editar producto' : 'Nuevo producto' }}</h2>
        @if (editando()) {
          <button type="button" class="btn btn-chico" (click)="cancelarEdicion()">Cancelar edición</button>
        }
      </div>
      <p class="meta">
        Los productos del candy bar se venden junto con las entradas y se retiran con el mismo código QR.
        Un producto no disponible deja de aparecer en la compra, pero las compras ya hechas no cambian.
      </p>

      @if (cargando()) {
        <p class="cargando">Cargando...</p>
      } @else if (!categorias().length) {
        <p class="alerta">Primero creá una categoría para poder cargar productos.</p>
      } @else {
        <form [formGroup]="form" (ngSubmit)="guardar()">
          <div class="fila-campos">
            <label class="campo">
              <span>Nombre</span>
              <input formControlName="nombre" maxlength="60" placeholder="Ej: Pochoclos grandes" />
              <app-error-campo [control]="form.controls.nombre" />
            </label>
            <label class="campo">
              <span>Categoría</span>
              <select formControlName="categoria_id">
                <option [ngValue]="null" disabled>Elegí una categoría</option>
                @for (categoria of categorias(); track categoria.id) {
                  <option [ngValue]="categoria.id">{{ categoria.nombre }}</option>
                }
              </select>
              <app-error-campo [control]="form.controls.categoria_id" />
            </label>
          </div>

          <label class="campo">
            <span>Descripción</span>
            <input formControlName="descripcion" maxlength="120" placeholder="Ej: Balde de 120 gramos" />
            <app-error-campo [control]="form.controls.descripcion" />
          </label>

          <div class="fila-campos">
            <label class="campo">
              <span>Precio</span>
              <input type="number" formControlName="precio" min="0" step="100" />
              <app-error-campo [control]="form.controls.precio" />
            </label>
            <label class="campo check">
              <input type="checkbox" formControlName="disponible" />
              <span>Disponible para la venta</span>
            </label>
          </div>

          @if (error()) {
            <p class="alerta alerta-error" animate.enter="aparecer">{{ error() }}</p>
          }
          @if (exito()) {
            <p class="alerta alerta-exito" animate.enter="aparecer">{{ exito() }}</p>
          }

          <button type="submit" class="btn btn-primario" [disabled]="guardando()">
            {{ guardando() ? 'Guardando...' : editando() ? 'Guardar cambios' : 'Crear producto' }}
          </button>
        </form>
      }
    </div>

    <section class="tarjeta">
      <h2>Productos</h2>
      <div class="tabla-contenedor">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Categoría</th>
              <th>Precio</th>
              <th>Disponible</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (producto of productos(); track producto.id) {
              <tr [class.fila-editando]="editando()?.id === producto.id">
                <td>
                  {{ producto.nombre }}
                  @if (producto.descripcion) {
                    <small class="meta">{{ producto.descripcion }}</small>
                  }
                </td>
                <td>{{ producto.categoria?.nombre }}</td>
                <td>{{ producto.precio | currency }}</td>
                <td>
                  <input
                    type="checkbox"
                    [checked]="producto.disponible"
                    [attr.aria-label]="'Disponible: ' + producto.nombre"
                    (change)="cambiarDisponible(producto, $event)"
                  />
                </td>
                <td class="acciones-tabla">
                  <button type="button" class="btn btn-chico" (click)="editar(producto)">Editar</button>
                  <button type="button" class="btn btn-chico btn-peligro" (click)="eliminar(producto)">Eliminar</button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5" class="vacio">Todavía no hay productos cargados.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>

    <section class="tarjeta">
      <h2>Categorías</h2>
      <p class="meta">El número de orden define en qué posición aparece la categoría en la pantalla de compra.</p>

      <!-- Formulario template-driven: campos simples con su validación en el template -->
      <form class="form-en-linea" #formCategoria="ngForm" (ngSubmit)="crearCategoria(formCategoria)">
        <label class="campo">
          <span>Nueva categoría</span>
          <input name="nombre" [(ngModel)]="nombreCategoria" #campoNombre="ngModel" required maxlength="40" placeholder="Ej: Helados" />
          @if (campoNombre.touched && !nombreCategoria().trim()) {
            <small class="error-texto">Este campo es obligatorio.</small>
          }
        </label>
        <label class="campo campo-corto">
          <span>Orden</span>
          <input type="number" name="orden" [(ngModel)]="ordenCategoria" min="0" max="99" />
        </label>
        <button type="submit" class="btn btn-primario" [disabled]="guardando()">Agregar</button>
      </form>

      <div class="tabla-contenedor">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Orden</th>
              <th>Productos</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (categoria of categorias(); track categoria.id) {
              <tr>
                <td>{{ categoria.nombre }}</td>
                <td>{{ categoria.orden }}</td>
                <td>{{ cantidadPorCategoria().get(categoria.id) ?? 0 }}</td>
                <td class="acciones-tabla">
                  <button type="button" class="btn btn-chico btn-peligro" (click)="eliminarCategoria(categoria)">
                    Eliminar
                  </button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="4" class="vacio">No hay categorías cargadas.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class AdminProductos implements OnInit {
  private readonly productosService = inject(ProductosService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly productos = signal<ProductoConCategoria[]>([]);
  protected readonly categorias = signal<CategoriaProducto[]>([]);
  protected readonly editando = signal<ProductoConCategoria | null>(null);
  protected readonly nombreCategoria = signal('');
  protected readonly ordenCategoria = signal(0);
  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly error = signal('');
  protected readonly exito = signal('');

  protected readonly cantidadPorCategoria = computed(() => {
    const conteo = new Map<number, number>();
    for (const producto of this.productos()) {
      conteo.set(producto.categoria_id, (conteo.get(producto.categoria_id) ?? 0) + 1);
    }
    return conteo;
  });

  protected readonly form = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(60)]],
    categoria_id: this.fb.control<number | null>(null, Validators.required),
    descripcion: ['', Validators.maxLength(120)],
    precio: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    disponible: [true],
  });

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  protected editar(producto: ProductoConCategoria): void {
    this.limpiarMensajes();
    this.editando.set(producto);
    this.form.setValue({
      nombre: producto.nombre,
      categoria_id: producto.categoria_id,
      descripcion: producto.descripcion,
      precio: producto.precio,
      disponible: producto.disponible,
    });
    document.getElementById('form-producto')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected cancelarEdicion(): void {
    this.editando.set(null);
    this.form.reset({ disponible: true, descripcion: '' });
  }

  protected async guardar(): Promise<void> {
    this.limpiarMensajes();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { nombre, categoria_id, descripcion, precio, disponible } = this.form.getRawValue();
    if (categoria_id === null || precio === null) return;

    const datos = { nombre: nombre.trim(), categoria_id, descripcion: descripcion.trim(), precio, disponible };
    const editando = this.editando();
    this.guardando.set(true);
    try {
      if (editando) {
        await this.productosService.actualizar(editando.id, datos);
        this.exito.set(`Se guardaron los cambios de "${datos.nombre}".`);
        this.cancelarEdicion();
      } else {
        await this.productosService.crear(datos);
        this.exito.set(`Se creó el producto "${datos.nombre}".`);
        this.form.reset({ disponible: true, descripcion: '' });
      }
      await this.cargar();
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  protected async cambiarDisponible(producto: ProductoConCategoria, evento: Event): Promise<void> {
    const checkbox = evento.target as HTMLInputElement;
    this.limpiarMensajes();
    try {
      await this.productosService.actualizar(producto.id, { disponible: checkbox.checked });
      this.productos.update((lista) =>
        lista.map((p) => (p.id === producto.id ? { ...p, disponible: checkbox.checked } : p)),
      );
    } catch (e) {
      checkbox.checked = !checkbox.checked;
      this.error.set(mensajeError(e));
    }
  }

  protected async eliminar(producto: ProductoConCategoria): Promise<void> {
    if (!confirm(`¿Eliminar "${producto.nombre}"?`)) return;
    this.limpiarMensajes();
    try {
      await this.productosService.eliminar(producto.id);
      if (this.editando()?.id === producto.id) this.cancelarEdicion();
      this.productos.update((lista) => lista.filter((p) => p.id !== producto.id));
    } catch (e) {
      this.error.set(mensajeError(e));
    }
  }

  protected async crearCategoria(formulario: NgForm): Promise<void> {
    this.limpiarMensajes();
    const nombre = this.nombreCategoria().trim();
    if (formulario.invalid || !nombre) {
      formulario.control.markAllAsTouched();
      return;
    }
    this.guardando.set(true);
    try {
      await this.productosService.crearCategoria(nombre, Number(this.ordenCategoria()) || 0);
      formulario.resetForm({ nombre: '', orden: 0 });
      await this.cargar();
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  protected async eliminarCategoria(categoria: CategoriaProducto): Promise<void> {
    if (!confirm(`¿Eliminar la categoría "${categoria.nombre}"?`)) return;
    this.limpiarMensajes();
    try {
      await this.productosService.eliminarCategoria(categoria.id);
      this.categorias.update((lista) => lista.filter((c) => c.id !== categoria.id));
    } catch (e) {
      this.error.set(mensajeError(e));
    }
  }

  private async cargar(): Promise<void> {
    try {
      const [productos, categorias] = await Promise.all([
        this.productosService.listar(),
        this.productosService.listarCategorias(),
      ]);
      this.productos.set(productos);
      this.categorias.set(categorias);
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  private limpiarMensajes(): void {
    this.error.set('');
    this.exito.set('');
  }
}
