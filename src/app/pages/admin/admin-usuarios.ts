import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { Perfil, Rol } from '../../core/models/perfil';
import { UsuariosService } from '../../core/services/usuarios.service';
import { mensajeError } from '../../core/utils/errores';

const ROLES: { valor: Rol; etiqueta: string; descripcion: string }[] = [
  { valor: 'cliente', etiqueta: 'Cliente', descripcion: 'Compra entradas y deja reseñas.' },
  { valor: 'empleado', etiqueta: 'Empleado', descripcion: 'Valida los QR del ingreso y del candy bar.' },
  { valor: 'admin', etiqueta: 'Administrador', descripcion: 'Gestiona todo el cine.' },
];

@Component({
  selector: 'app-admin-usuarios',
  imports: [DatePipe],
  template: `
    <div class="tarjeta">
      <h2>Usuarios</h2>
      <p class="meta">Qué puede hacer cada rol:</p>
      <ul class="meta">
        @for (rol of roles; track rol.valor) {
          <li><strong>{{ rol.etiqueta }}:</strong> {{ rol.descripcion }}</li>
        }
      </ul>

      <div class="form-en-linea">
        <label class="campo">
          <span>Buscar por nombre o email</span>
          <input [value]="busqueda()" (input)="buscar($event)" placeholder="Ej: lopez" />
        </label>
      </div>

      @if (error()) {
        <p class="alerta alerta-error" animate.enter="aparecer">{{ error() }}</p>
      }
      @if (exito()) {
        <p class="alerta alerta-exito" animate.enter="aparecer">{{ exito() }}</p>
      }

      @if (cargando()) {
        <p class="cargando">Cargando...</p>
      } @else {
        <div class="tabla-contenedor">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Nacimiento</th>
                <th>Rol</th>
              </tr>
            </thead>
            <tbody>
              @for (usuario of filtrados(); track usuario.id) {
                <tr>
                  <td>{{ usuario.apellido }}, {{ usuario.nombre }}</td>
                  <td>{{ usuario.email }}</td>
                  <td>{{ usuario.fecha_nacimiento | date: 'dd/MM/yyyy' }}</td>
                  <td>
                    @if (usuario.id === auth.perfil()?.id) {
                      <span class="meta">Administrador (vos)</span>
                    } @else {
                      <select
                        [value]="usuario.rol"
                        [attr.aria-label]="'Rol de ' + usuario.email"
                        (change)="cambiarRol(usuario, $event)"
                      >
                        @for (rol of roles; track rol.valor) {
                          <option [value]="rol.valor">{{ rol.etiqueta }}</option>
                        }
                      </select>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4" class="vacio">No hay usuarios para mostrar.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class AdminUsuarios implements OnInit {
  private readonly usuariosService = inject(UsuariosService);
  protected readonly auth = inject(AuthService);

  protected readonly roles = ROLES;
  protected readonly usuarios = signal<Perfil[]>([]);
  protected readonly busqueda = signal('');
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly exito = signal('');

  protected readonly filtrados = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    if (!texto) return this.usuarios();
    return this.usuarios().filter((u) =>
      `${u.nombre} ${u.apellido} ${u.email}`.toLowerCase().includes(texto),
    );
  });

  async ngOnInit(): Promise<void> {
    try {
      this.usuarios.set(await this.usuariosService.listar());
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected buscar(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }

  protected async cambiarRol(usuario: Perfil, evento: Event): Promise<void> {
    const select = evento.target as HTMLSelectElement;
    const rol = select.value as Rol;
    const anterior = usuario.rol;
    this.error.set('');
    this.exito.set('');
    try {
      await this.usuariosService.cambiarRol(usuario.id, rol);
      this.usuarios.update((lista) => lista.map((u) => (u.id === usuario.id ? { ...u, rol } : u)));
      this.exito.set(`${usuario.email} ahora es ${this.etiqueta(rol)}.`);
    } catch (e) {
      select.value = anterior;
      this.error.set(mensajeError(e));
    }
  }

  private etiqueta(rol: Rol): string {
    return ROLES.find((r) => r.valor === rol)?.etiqueta.toLowerCase() ?? rol;
  }
}
