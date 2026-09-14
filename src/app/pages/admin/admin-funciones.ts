import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { MINUTOS_ENTRE_FUNCIONES } from '../../core/constantes';
import { Formato, FORMATOS, FuncionConDetalle, Idioma, IDIOMAS } from '../../core/models/funcion';
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
  protected readonly funciones = signal<FuncionConDetalle[]>([]);
  protected readonly conflictos = signal<FuncionConDetalle[]>([]);
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

  protected async crear(): Promise<void> {
    this.error.set('');
    this.exito.set('');
    this.conflictos.set([]);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const pelicula = this.peliculaElegida();
    const inicio = this.inicioElegido();
    const { sala_id, formato, idioma, precio } = this.form.getRawValue();
    if (!pelicula || !inicio || sala_id === null || precio === null) return;

    this.guardando.set(true);
    try {
      // Primero se buscan choques para explicar el problema; la base igual lo valida al insertar.
      const conflictos = await this.funcionesService.buscarConflictos(sala_id, inicio, pelicula.duracion_min);
      if (conflictos.length) {
        this.conflictos.set(conflictos);
        return;
      }
      await this.funcionesService.crear({
        pelicula_id: pelicula.id,
        sala_id,
        inicio: inicio.toISOString(),
        formato,
        idioma,
        precio,
      });
      this.exito.set(`Se creó la función de "${pelicula.titulo}".`);
      this.form.controls.hora.reset('');
      this.funciones.set(await this.funcionesService.listarProximas());
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  protected async eliminar(funcion: FuncionConDetalle): Promise<void> {
    if (!confirm(`¿Eliminar la función de "${funcion.pelicula?.titulo}"?`)) return;
    this.error.set('');
    try {
      await this.funcionesService.eliminar(funcion.id);
      this.funciones.update((lista) => lista.filter((f) => f.id !== funcion.id));
    } catch (e) {
      this.error.set(mensajeError(e));
    }
  }
}
