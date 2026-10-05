import { Component, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ConCambiosSinGuardar } from '../../core/auth/auth.guards';
import { Genero } from '../../core/models/genero';
import { RESTRICCIONES_EDAD, RestriccionEdad } from '../../core/models/pelicula';
import { GenerosService } from '../../core/services/generos.service';
import { PeliculasService } from '../../core/services/peliculas.service';
import { mensajeError } from '../../core/utils/errores';
import { DIAS_DE_PREVENTA } from '../../core/utils/estreno';
import { DIAS_DEL_MES, fechaDeListas, MESES } from '../../core/utils/fechas';
import { ErrorCampo } from '../../shared/components/error-campo';
import { fechaOpcionalValidator } from '../../shared/validators';

const TAMANIO_MAXIMO_POSTER = 2 * 1024 * 1024;
/** Años para la fecha de estreno: el anterior, el actual y los dos siguientes. */
const ANIOS_ESTRENO = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - 1 + i);

@Component({
  selector: 'app-pelicula-form',
  imports: [ReactiveFormsModule, RouterLink, ErrorCampo],
  templateUrl: './pelicula-form.html',
  styles: `
    .fecha { display: grid; grid-template-columns: 1fr 2fr 1.4fr; gap: 8px; max-width: 360px; }
    fieldset > .meta { margin-bottom: 12px; }
  `,
})
export class PeliculaForm implements OnInit, ConCambiosSinGuardar {
  private readonly peliculasService = inject(PeliculasService);
  private readonly generosService = inject(GenerosService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  /** Parámetro :id de la ruta /admin/peliculas/:id. Es null en /admin/peliculas/nueva. */
  protected readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id');

  protected readonly restricciones = RESTRICCIONES_EDAD;
  protected readonly dias = DIAS_DEL_MES;
  protected readonly meses = MESES;
  protected readonly anios = ANIOS_ESTRENO;
  protected readonly diasPreventa = DIAS_DE_PREVENTA;
  protected readonly generos = signal<Genero[]>([]);
  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly subiendo = signal(false);
  protected readonly error = signal('');
  /** Se pone en true al guardar, para poder salir sin pedir confirmación. */
  private guardado = false;

  protected readonly form = this.fb.group({
    titulo: ['', [Validators.required, Validators.maxLength(120)]],
    sinopsis: ['', [Validators.required, Validators.maxLength(1000)]],
    duracion_min: this.fb.control<number | null>(null, [Validators.required, Validators.min(1), Validators.max(600)]),
    imagen_url: ['', [Validators.required, Validators.pattern(/^https?:\/\/\S+$/)]],
    en_cartelera: [true],
    restriccion_edad: this.fb.control<RestriccionEdad>(0),
    // Estreno y preventa (email 08/03): la fecha con tres listas, sin calendario (email 28/02).
    estreno: this.fb.group({ dia: [''], mes: [''], anio: [''] }, { validators: fechaOpcionalValidator }),
    preventa: [false],
    precio_preventa: this.fb.control<number | null>({ value: null, disabled: true }, [
      Validators.required,
      Validators.min(0),
    ]),
    generos: this.fb.control<number[]>([], Validators.required),
  });

  constructor() {
    // El precio de preventa se pide solo si la película tiene preventa.
    this.form.controls.preventa.valueChanges.pipe(takeUntilDestroyed()).subscribe((preventa) => {
      const precio = this.form.controls.precio_preventa;
      if (preventa) {
        precio.enable();
      } else {
        precio.disable();
      }
    });
  }

  /** La preventa necesita una fecha de estreno. */
  protected sinFechaParaPreventa(): boolean {
    return this.form.controls.preventa.value && !this.form.controls.estreno.controls.dia.value;
  }

  async ngOnInit(): Promise<void> {
    try {
      this.generos.set(await this.generosService.listar());
      if (this.id) {
        const pelicula = await this.peliculasService.obtener(Number(this.id));
        if (!pelicula) {
          this.error.set('La película no existe.');
          return;
        }
        const [anio, mes, dia] = pelicula.fecha_estreno?.split('-').map(Number) ?? [];
        this.form.setValue({
          titulo: pelicula.titulo,
          sinopsis: pelicula.sinopsis,
          duracion_min: pelicula.duracion_min,
          imagen_url: pelicula.imagen_url,
          en_cartelera: pelicula.en_cartelera,
          restriccion_edad: pelicula.restriccion_edad,
          estreno: { dia: dia ? String(dia) : '', mes: mes ? String(mes) : '', anio: anio ? String(anio) : '' },
          preventa: pelicula.precio_preventa !== null,
          precio_preventa: pelicula.precio_preventa,
          generos: pelicula.generos.map((g) => g.id),
        });
      }
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  /** Lo consulta cambiosSinGuardarGuard (canDeactivate) antes de salir de la pantalla. */
  tieneCambiosSinGuardar(): boolean {
    return this.form.dirty && !this.guardado;
  }

  protected alternarGenero(id: number): void {
    const control = this.form.controls.generos;
    control.setValue(control.value.includes(id) ? control.value.filter((g) => g !== id) : [...control.value, id]);
    control.markAsTouched();
    control.markAsDirty();
  }

  protected async subirPoster(evento: Event): Promise<void> {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (!archivo) return;

    if (!archivo.type.startsWith('image/')) {
      this.error.set('El archivo tiene que ser una imagen.');
      return;
    }
    if (archivo.size > TAMANIO_MAXIMO_POSTER) {
      this.error.set('La imagen puede pesar como máximo 2 MB.');
      return;
    }

    this.error.set('');
    this.subiendo.set(true);
    try {
      const url = await this.peliculasService.subirPoster(archivo);
      this.form.controls.imagen_url.setValue(url);
      this.form.controls.imagen_url.markAsTouched();
      this.form.controls.imagen_url.markAsDirty();
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.subiendo.set(false);
      input.value = '';
    }
  }

  protected async guardar(): Promise<void> {
    this.error.set('');
    if (this.form.invalid || this.sinFechaParaPreventa()) {
      this.form.markAllAsTouched();
      return;
    }

    const { generos, duracion_min, titulo, sinopsis, imagen_url, en_cartelera, restriccion_edad, estreno, preventa } =
      this.form.getRawValue();
    this.guardando.set(true);
    try {
      await this.peliculasService.guardar(
        this.id ? Number(this.id) : null,
        {
          titulo: titulo.trim(),
          sinopsis: sinopsis.trim(),
          duracion_min: duracion_min ?? 0,
          imagen_url,
          en_cartelera,
          restriccion_edad,
          fecha_estreno: estreno.dia ? fechaDeListas(estreno.dia, estreno.mes, estreno.anio) : null,
          precio_preventa: preventa ? this.form.controls.precio_preventa.value : null,
        },
        generos,
      );
      this.guardado = true;
      await this.router.navigateByUrl('/admin/peliculas');
    } catch (e) {
      const codigo = (e as { code?: string }).code;
      this.error.set(
        codigo === '23P01'
          ? 'No se puede cambiar la duración: alguna función de esta película quedaría superpuesta con la siguiente de su sala.'
          : mensajeError(e),
      );
    } finally {
      this.guardando.set(false);
    }
  }
}
