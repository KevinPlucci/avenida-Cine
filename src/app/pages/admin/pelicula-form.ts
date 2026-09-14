import { Component, inject, input, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Genero } from '../../core/models/genero';
import { GenerosService } from '../../core/services/generos.service';
import { PeliculasService } from '../../core/services/peliculas.service';
import { mensajeError } from '../../core/utils/errores';
import { ErrorCampo } from '../../shared/components/error-campo';

const TAMANIO_MAXIMO_POSTER = 2 * 1024 * 1024;

@Component({
  selector: 'app-pelicula-form',
  imports: [ReactiveFormsModule, RouterLink, ErrorCampo],
  templateUrl: './pelicula-form.html',
})
export class PeliculaForm implements OnInit {
  /** Parámetro :id de la ruta. No viene cuando se crea una película nueva. */
  readonly id = input<string>();

  private readonly peliculasService = inject(PeliculasService);
  private readonly generosService = inject(GenerosService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly generos = signal<Genero[]>([]);
  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly subiendo = signal(false);
  protected readonly error = signal('');

  protected readonly form = this.fb.group({
    titulo: ['', [Validators.required, Validators.maxLength(120)]],
    sinopsis: ['', [Validators.required, Validators.maxLength(1000)]],
    duracion_min: this.fb.control<number | null>(null, [Validators.required, Validators.min(1), Validators.max(600)]),
    imagen_url: ['', [Validators.required, Validators.pattern(/^https?:\/\/\S+$/)]],
    en_cartelera: [true],
    generos: this.fb.control<number[]>([], Validators.required),
  });

  async ngOnInit(): Promise<void> {
    try {
      this.generos.set(await this.generosService.listar());
      const id = this.id();
      if (id) {
        const pelicula = await this.peliculasService.obtener(Number(id));
        if (!pelicula) {
          this.error.set('La película no existe.');
          return;
        }
        this.form.setValue({
          titulo: pelicula.titulo,
          sinopsis: pelicula.sinopsis,
          duracion_min: pelicula.duracion_min,
          imagen_url: pelicula.imagen_url,
          en_cartelera: pelicula.en_cartelera,
          generos: pelicula.generos.map((g) => g.id),
        });
      }
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected alternarGenero(id: number): void {
    const control = this.form.controls.generos;
    control.setValue(control.value.includes(id) ? control.value.filter((g) => g !== id) : [...control.value, id]);
    control.markAsTouched();
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
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.subiendo.set(false);
      input.value = '';
    }
  }

  protected async guardar(): Promise<void> {
    this.error.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { generos, duracion_min, titulo, sinopsis, imagen_url, en_cartelera } = this.form.getRawValue();
    const id = this.id();
    this.guardando.set(true);
    try {
      await this.peliculasService.guardar(
        id ? Number(id) : null,
        { titulo: titulo.trim(), sinopsis: sinopsis.trim(), duracion_min: duracion_min ?? 0, imagen_url, en_cartelera },
        generos,
      );
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
