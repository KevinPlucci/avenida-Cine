import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, map } from 'rxjs';
import { PeliculasService } from '../../core/services/peliculas.service';
import { PeliculaCartelera } from '../../core/models/pelicula';
import { Genero } from '../../core/models/genero';
import { mensajeError } from '../../core/utils/errores';
import { normalizar } from '../../core/utils/texto';
import { PeliculaCard } from '../../shared/components/pelicula-card';

@Component({
  selector: 'app-inicio',
  imports: [ReactiveFormsModule, DatePipe, PeliculaCard],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
})
export class Inicio implements OnInit {
  private readonly peliculasService = inject(PeliculasService);

  protected readonly hoy = new Date();
  protected readonly peliculas = signal<PeliculaCartelera[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');

  protected readonly busqueda = new FormControl('', { nonNullable: true });
  private readonly textoBuscado = toSignal(this.busqueda.valueChanges.pipe(debounceTime(200), map(normalizar)), {
    initialValue: '',
  });
  protected readonly generosElegidos = signal<number[]>([]);

  /** Las 3 películas con más entradas vendidas (email 16/01). */
  protected readonly masVendidas = computed(() =>
    this.peliculas()
      .filter((p) => p.entradas_vendidas > 0)
      .sort((a, b) => b.entradas_vendidas - a.entradas_vendidas)
      .slice(0, 3),
  );

  /** Géneros que tiene al menos una película de la cartelera. */
  protected readonly generos = computed(() => {
    const porId = new Map<number, Genero>();
    this.peliculas().forEach((p) => p.generos.forEach((g) => porId.set(g.id, g)));
    return [...porId.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  });

  /** Filtra por nombre y por géneros: la película tiene que tener todos los géneros elegidos. */
  protected readonly filtradas = computed(() => {
    const texto = this.textoBuscado();
    const elegidos = this.generosElegidos();
    return this.peliculas().filter(
      (p) => normalizar(p.titulo).includes(texto) && elegidos.every((id) => p.generos.some((g) => g.id === id)),
    );
  });

  protected readonly hayFiltros = computed(() => this.textoBuscado() !== '' || this.generosElegidos().length > 0);

  async ngOnInit(): Promise<void> {
    try {
      this.peliculas.set(await this.peliculasService.listarCartelera());
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected alternarGenero(id: number): void {
    this.generosElegidos.update((ids) => (ids.includes(id) ? ids.filter((g) => g !== id) : [...ids, id]));
  }

  protected limpiarFiltros(): void {
    this.busqueda.setValue('');
    this.generosElegidos.set([]);
  }
}
