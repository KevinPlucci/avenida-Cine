import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { MINUTOS_ENTRE_FUNCIONES } from '../../core/constantes';
import { Formato, FORMATOS, FuncionAdmin, FuncionConDetalle, Idioma, IDIOMAS } from '../../core/models/funcion';
import { Pelicula } from '../../core/models/pelicula';
import { Sala } from '../../core/models/sala';
import { FuncionesService, ResultadoProgramacion } from '../../core/services/funciones.service';
import { PeliculasService } from '../../core/services/peliculas.service';
import { SalasService } from '../../core/services/salas.service';
import { mensajeError } from '../../core/utils/errores';
import { aFechaIso, proximosDias, sumarMinutos } from '../../core/utils/fechas';
import { ErrorCampo } from '../../shared/components/error-campo';
import { IdiomaPipe } from '../../shared/pipes/idioma.pipe';

interface ValoresHorario {
  dias?: string[];
  hora?: string;
  minuto?: string;
}

/** Valor de "sala" que pide asignación automática (email 06/02). */
const SALA_AUTOMATICA = 0;

function armarInicio(dia: string, hora?: string, minuto?: string): Date | null {
  if (!dia || !hora || !minuto) return null;
  const [anio, mes, numeroDia] = dia.split('-').map(Number);
  return new Date(anio, mes - 1, numeroDia, Number(hora), Number(minuto));
}

function armarInicios({ dias, hora, minuto }: ValoresHorario): Date[] {
  return (dias ?? [])
    .map((dia) => armarInicio(dia, hora, minuto))
    .filter((fecha): fecha is Date => fecha !== null)
    .sort((a, b) => a.getTime() - b.getTime());
}

const horarioFuturoValidator: ValidatorFn = (grupo) => {
  const inicios = armarInicios(grupo.value as ValoresHorario);
  return inicios.some((inicio) => inicio <= new Date()) ? { enElPasado: true } : null;
};

/** Campos que no se pueden cambiar si la función ya tiene entradas vendidas (la base aplica la misma regla). */
const CAMPOS_BLOQUEADOS_CON_VENTAS = ['pelicula_id', 'sala_id', 'dias', 'hora', 'minuto', 'formato', 'idioma'] as const;

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
  protected readonly salaAutomatica = SALA_AUTOMATICA;
  // Día y hora con botones y listas cortas en lugar de un calendario.
  protected readonly dias = proximosDias(14);
  protected readonly horas = Array.from({ length: 15 }, (_, i) => String(i + 9).padStart(2, '0'));
  protected readonly minutos = ['00', '15', '30', '45'];

  protected readonly peliculas = signal<Pelicula[]>([]);
  protected readonly salas = signal<Sala[]>([]);
  protected readonly funciones = signal<FuncionAdmin[]>([]);
  protected readonly conflictos = signal<FuncionConDetalle[]>([]);
  protected readonly resultados = signal<ResultadoProgramacion[]>([]);
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
      dias: this.fb.control<string[]>([], (control) => (control.value.length ? null : { required: true })),
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
  protected readonly iniciosElegidos = computed(() => armarInicios(this.valores()));
  protected readonly inicioElegido = computed(() => this.iniciosElegidos()[0] ?? null);
  protected readonly finElegido = computed(() => {
    const inicio = this.inicioElegido();
    const pelicula = this.peliculaElegida();
    return inicio && pelicula ? sumarMinutos(inicio, pelicula.duracion_min) : null;
  });
  protected readonly libreDesde = computed(() => {
    const fin = this.finElegido();
    return fin ? sumarMinutos(fin, MINUTOS_ENTRE_FUNCIONES) : null;
  });
  protected readonly cantidadDias = computed(() => this.iniciosElegidos().length);
  protected readonly asignacionAutomatica = computed(() => this.valores().sala_id === SALA_AUTOMATICA);

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

  protected diaElegido(valor: string): boolean {
    return this.form.controls.dias.value.includes(valor);
  }

  /** Al crear se pueden marcar varios días con el mismo horario; al editar, uno solo. */
  protected elegirDia(valor: string): void {
    const control = this.form.controls.dias;
    if (this.editando()) {
      control.setValue([valor]);
    } else {
      const actuales = control.value;
      control.setValue(
        actuales.includes(valor) ? actuales.filter((dia) => dia !== valor) : [...actuales, valor].sort(),
      );
    }
    control.markAsTouched();
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
      dias: [aFechaIso(inicio)],
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
    this.form.reset({ dias: [], minuto: '00', formato: '2D', idioma: 'castellano' });
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
        const inicios = this.iniciosElegidos();
        if (!pelicula || !inicios.length || sala_id === null) return;

        if (editando) {
          // Al editar se mantiene una sola función: se busca el choque para explicar el problema.
          const conflictos = await this.funcionesService.buscarConflictos(
            sala_id,
            inicios[0],
            pelicula.duracion_min,
            editando.id,
          );
          if (conflictos.length) {
            this.conflictos.set(conflictos);
            return;
          }
          await this.funcionesService.actualizar(editando.id, {
            pelicula_id: pelicula.id,
            sala_id,
            inicio: inicios[0].toISOString(),
            formato,
            idioma,
            precio,
          });
          this.exito.set(`Se guardaron los cambios de la función de "${pelicula.titulo}".`);
          this.cancelarEdicion();
        } else {
          // La base programa todos los horarios y avisa cuáles no pudo crear.
          const resultados = await this.funcionesService.programar(
            pelicula.id,
            sala_id === SALA_AUTOMATICA ? null : sala_id,
            inicios,
            formato,
            idioma,
            precio,
          );
          this.resultados.set(resultados);
          const creadas = resultados.filter((r) => r.creada).length;
          if (creadas) {
            this.exito.set(
              creadas === 1
                ? `Se creó la función de "${pelicula.titulo}".`
                : `Se crearon ${creadas} funciones de "${pelicula.titulo}".`,
            );
            this.form.controls.dias.setValue([]);
            this.form.controls.hora.reset();
          }
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
    this.resultados.set([]);
  }
}
