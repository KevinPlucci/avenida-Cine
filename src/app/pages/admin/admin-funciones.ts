import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { MINUTOS_ENTRE_FUNCIONES } from '../../core/constantes';
import { Formato, FORMATOS, FuncionAdmin, FuncionConDetalle, Idioma, IDIOMAS } from '../../core/models/funcion';
import { Pelicula } from '../../core/models/pelicula';
import { Sala } from '../../core/models/sala';
import { FuncionesService } from '../../core/services/funciones.service';
import { PeliculasService } from '../../core/services/peliculas.service';
import { SalasService } from '../../core/services/salas.service';
import { mensajeError } from '../../core/utils/errores';
import { aFechaIso, proximosDias, sumarMinutos } from '../../core/utils/fechas';
import { ErrorCampo } from '../../shared/components/error-campo';
import { IdiomaPipe } from '../../shared/pipes/idioma.pipe';

interface ValoresHorario {
  dia?: string;
  hora?: string;
  minuto?: string;
}

function armarInicio({ dia, hora, minuto }: ValoresHorario): Date | null {
  if (!dia || !hora || !minuto) return null;
  const [anio, mes, numeroDia] = dia.split('-').map(Number);
  return new Date(anio, mes - 1, numeroDia, Number(hora), Number(minuto));
}

const horarioFuturoValidator: ValidatorFn = (grupo) => {
  const inicio = armarInicio(grupo.value as ValoresHorario);
  return inicio && inicio <= new Date() ? { enElPasado: true } : null;
};

/** Campos que no se pueden cambiar si la función ya tiene entradas vendidas (la base aplica la misma regla). */
const CAMPOS_BLOQUEADOS_CON_VENTAS = ['pelicula_id', 'sala_id', 'dia', 'hora', 'minuto', 'formato', 'idioma'] as const;

@Component({
  selector: 'app-admin-funciones',
  imports: [ReactiveFormsModule, DatePipe, CurrencyPipe, IdiomaPipe, ErrorCampo],
  templateUrl: './admin-funciones.html',
})
export class AdminFunciones implements OnInit {
  private readonly peliculasService = inject(PeliculasService);
  private readonly salasService = inject(SalasService);
  private readonly funcionesService = inject(FuncionesService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly formatos = FORMATOS;
  protected readonly idiomas = IDIOMAS;
  protected readonly minutosEntreFunciones = MINUTOS_ENTRE_FUNCIONES;
  // Día y hora con botones y listas cortas en lugar de un calendario.
  protected readonly dias = proximosDias(14);
  protected readonly horas = Array.from({ length: 15 }, (_, i) => String(i + 9).padStart(2, '0'));
  protected readonly minutos = ['00', '15', '30', '45'];

  protected readonly peliculas = signal<Pelicula[]>([]);
  protected readonly salas = signal<Sala[]>([]);
  protected readonly funciones = signal<FuncionAdmin[]>([]);
  protected readonly conflictos = signal<FuncionConDetalle[]>([]);
  protected readonly editando = signal<FuncionAdmin | null>(null);
  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly error = signal('');
  protected readonly exito = signal('');
  protected readonly filtroDia = signal('');

  protected readonly form = this.fb.group(
    {
      pelicula_id: this.fb.control<number | null>(null, Validators.required),
      sala_id: this.fb.control<number | null>(null, Validators.required),
      dia: ['', Validators.required],
      hora: ['', Validators.required],
      minuto: ['00', Validators.required],
      formato: this.fb.control<Formato>('2D'),
      idioma: this.fb.control<Idioma>('castellano'),
      precio: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    },
    { validators: horarioFuturoValidator },
  );

  protected readonly valores = toSignal(this.form.valueChanges, { initialValue: this.form.value });

  protected readonly salasActivas = computed(() => this.salas().filter((s) => s.activa));
  protected readonly peliculaElegida = computed(
    () => this.peliculas().find((p) => p.id === this.valores().pelicula_id) ?? null,
  );
  protected readonly inicioElegido = computed(() => armarInicio(this.valores()));
  protected readonly finElegido = computed(() => {
    const inicio = this.inicioElegido();
    const pelicula = this.peliculaElegida();
    return inicio && pelicula ? sumarMinutos(inicio, pelicula.duracion_min) : null;
  });
  protected readonly libreDesde = computed(() => {
    const fin = this.finElegido();
    return fin ? sumarMinutos(fin, MINUTOS_ENTRE_FUNCIONES) : null;
  });

  protected readonly funcionesFiltradas = computed(() => {
    const dia = this.filtroDia();
    return dia ? this.funciones().filter((f) => aFechaIso(new Date(f.inicio)) === dia) : this.funciones();
  });

  async ngOnInit(): Promise<void> {
    try {
      const [peliculas, salas, funciones] = await Promise.all([
        this.peliculasService.listarTodas(),
        this.salasService.listar(),
        this.funcionesService.listarProximas(),
      ]);
      this.peliculas.set(peliculas);
      this.salas.set(salas);
      this.funciones.set(funciones);
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected elegirDia(valor: string): void {
    this.form.controls.dia.setValue(valor);
    this.form.controls.dia.markAsTouched();
  }

  protected empezo(funcion: FuncionAdmin): boolean {
    return new Date(funcion.inicio) <= new Date();
  }

  protected editar(funcion: FuncionAdmin): void {
    this.limpiarMensajes();
    this.editando.set(funcion);
    this.form.enable();

    const inicio = new Date(funcion.inicio);
    const minuto = String(inicio.getMinutes()).padStart(2, '0');
    this.form.setValue({
      pelicula_id: funcion.pelicula_id,
      sala_id: funcion.sala_id,
      dia: aFechaIso(inicio),
      hora: String(inicio.getHours()).padStart(2, '0'),
      minuto: this.minutos.includes(minuto) ? minuto : '00',
      formato: funcion.formato,
      idioma: funcion.idioma,
      precio: funcion.precio,
    });

    if (funcion.vendidas > 0) {
      CAMPOS_BLOQUEADOS_CON_VENTAS.forEach((campo) => this.form.controls[campo].disable());
    }
    document.getElementById('form-funcion')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected cancelarEdicion(): void {
    this.editando.set(null);
    this.conflictos.set([]);
    this.form.enable();
    this.form.reset();
  }

  protected async guardar(): Promise<void> {
    this.limpiarMensajes();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const editando = this.editando();
    const { sala_id, formato, idioma, precio } = this.form.getRawValue();
    if (precio === null) return;

    this.guardando.set(true);
    try {
      if (editando && editando.vendidas > 0) {
        await this.funcionesService.actualizar(editando.id, { precio });
        this.exito.set(`Se actualizó el precio de la función de "${editando.pelicula?.titulo}".`);
        this.cancelarEdicion();
      } else {
        const pelicula = this.peliculaElegida();
        const inicio = this.inicioElegido();
        if (!pelicula || !inicio || sala_id === null) return;

        // Primero se buscan choques para explicar el problema; la base igual lo valida al guardar.
        const conflictos = await this.funcionesService.buscarConflictos(
          sala_id,
          inicio,
          pelicula.duracion_min,
          editando?.id,
        );
        if (conflictos.length) {
          this.conflictos.set(conflictos);
          return;
        }

        const datos = { pelicula_id: pelicula.id, sala_id, inicio: inicio.toISOString(), formato, idioma, precio };
        if (editando) {
          await this.funcionesService.actualizar(editando.id, datos);
          this.exito.set(`Se guardaron los cambios de la función de "${pelicula.titulo}".`);
          this.cancelarEdicion();
        } else {
          await this.funcionesService.crear(datos);
          this.exito.set(`Se creó la función de "${pelicula.titulo}".`);
          this.form.controls.hora.reset();
        }
      }
      this.funciones.set(await this.funcionesService.listarProximas());
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  protected async eliminar(funcion: FuncionAdmin): Promise<void> {
    if (!confirm(`¿Eliminar la función de "${funcion.pelicula?.titulo}"?`)) return;
    this.limpiarMensajes();
    try {
      await this.funcionesService.eliminar(funcion.id);
      if (this.editando()?.id === funcion.id) {
        this.cancelarEdicion();
      }
      this.funciones.update((lista) => lista.filter((f) => f.id !== funcion.id));
    } catch (e) {
      this.error.set(mensajeError(e));
    }
  }

  private limpiarMensajes(): void {
    this.error.set('');
    this.exito.set('');
    this.conflictos.set([]);
  }
}
