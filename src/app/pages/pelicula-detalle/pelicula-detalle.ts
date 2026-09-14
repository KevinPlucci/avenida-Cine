import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { NOMBRE_CINE } from '../../core/constantes';
import { FuncionConDetalle } from '../../core/models/funcion';
import { Pelicula } from '../../core/models/pelicula';
import { Puntaje, Resenia } from '../../core/models/resenia';
import { FuncionesService } from '../../core/services/funciones.service';
import { PeliculasService } from '../../core/services/peliculas.service';
import { ReseniasService } from '../../core/services/resenias.service';
import { mensajeError } from '../../core/utils/errores';
import { agruparPorDia } from '../../core/utils/fechas';
import { ErrorCampo } from '../../shared/components/error-campo';
import { Estrellas } from '../../shared/components/estrellas';
import { ImagenRespaldoDirective } from '../../shared/directives/imagen-respaldo.directive';
import { DuracionPipe } from '../../shared/pipes/duracion.pipe';
import { IdiomaPipe } from '../../shared/pipes/idioma.pipe';

@Component({
  selector: 'app-pelicula-detalle',
  imports: [
    RouterLink,
    DatePipe,
    CurrencyPipe,
    ReactiveFormsModule,
    DuracionPipe,
    IdiomaPipe,
    Estrellas,
    ErrorCampo,
    ImagenRespaldoDirective,
  ],
  templateUrl: './pelicula-detalle.html',
  styleUrl: './pelicula-detalle.css',
})
export class PeliculaDetalle implements OnInit {
  /** Parámetro :id de la ruta. */
  readonly id = input.required<string>();

  private readonly peliculasService = inject(PeliculasService);
  private readonly funcionesService = inject(FuncionesService);
  private readonly reseniasService = inject(ReseniasService);
  private readonly title = inject(Title);
  protected readonly auth = inject(AuthService);

  protected readonly pelicula = signal<Pelicula | null>(null);
  protected readonly funciones = signal<FuncionConDetalle[]>([]);
  protected readonly resenias = signal<Resenia[]>([]);
  protected readonly puntaje = signal<Puntaje | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');

  protected readonly funcionesPorDia = computed(() => agruparPorDia(this.funciones()));
  protected readonly miResenia = computed(
    () => this.resenias().find((r) => r.usuario_id === this.auth.usuario()?.id) ?? null,
  );

  // Formulario de reseña
  protected readonly estrellas = signal(0);
  protected readonly formResenia = new FormGroup({
    comentario: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(280)],
    }),
  });
  protected readonly editando = signal(false);
  protected readonly guardando = signal(false);
  protected readonly errorResenia = signal('');

  async ngOnInit(): Promise<void> {
    const id = Number(this.id());
    try {
      const [pelicula, funciones, resenias, puntaje] = await Promise.all([
        this.peliculasService.obtener(id),
        this.funcionesService.proximasDePelicula(id),
        this.reseniasService.listar(id),
        this.reseniasService.obtenerPuntaje(id),
      ]);
      if (!pelicula) {
        this.error.set('La película no existe o no está en cartelera.');
        return;
      }
      this.pelicula.set(pelicula);
      this.funciones.set(funciones);
      this.resenias.set(resenias);
      this.puntaje.set(puntaje);
      this.title.setTitle(`${pelicula.titulo} | ${NOMBRE_CINE}`);
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected editarResenia(): void {
    const resenia = this.miResenia();
    if (!resenia) return;
    this.estrellas.set(resenia.estrellas);
    this.formResenia.setValue({ comentario: resenia.comentario });
    this.editando.set(true);
  }

  protected cancelarEdicion(): void {
    this.editando.set(false);
    this.estrellas.set(0);
    this.formResenia.reset();
    this.errorResenia.set('');
  }

  protected async guardarResenia(): Promise<void> {
    this.errorResenia.set('');
    const comentario = this.formResenia.getRawValue().comentario.trim();
    if (this.estrellas() === 0) {
      this.errorResenia.set('Elegí una calificación de 1 a 5 estrellas.');
      return;
    }
    if (this.formResenia.invalid || !comentario) {
      this.formResenia.markAllAsTouched();
      return;
    }

    this.guardando.set(true);
    try {
      const existente = this.miResenia();
      if (existente) {
        await this.reseniasService.actualizar(existente.id, this.estrellas(), comentario);
      } else {
        await this.reseniasService.crear(this.pelicula()!.id, this.estrellas(), comentario);
      }
      this.cancelarEdicion();
      await this.recargarResenias();
    } catch (e) {
      this.errorResenia.set(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  protected async eliminarResenia(): Promise<void> {
    const resenia = this.miResenia();
    if (!resenia || !confirm('¿Querés eliminar tu reseña?')) return;
    try {
      await this.reseniasService.eliminar(resenia.id);
      await this.recargarResenias();
    } catch (e) {
      this.errorResenia.set(mensajeError(e));
    }
  }

  private async recargarResenias(): Promise<void> {
    const id = this.pelicula()!.id;
    const [resenias, puntaje] = await Promise.all([
      this.reseniasService.listar(id),
      this.reseniasService.obtenerPuntaje(id),
    ]);
    this.resenias.set(resenias);
    this.puntaje.set(puntaje);
  }
}
