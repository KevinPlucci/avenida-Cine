import { computed, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BehaviorSubject, distinctUntilChanged, map, of, switchMap, timer } from 'rxjs';

/** Estado de las peticiones HTTP. Lo actualizan los interceptores y lo muestra el layout principal. */
@Injectable({ providedIn: 'root' })
export class EstadoRedService {
  /** Cantidad de peticiones en curso. El BehaviorSubject guarda el valor actual y lo emite a quien se suscriba. */
  private readonly pendientes = new BehaviorSubject(0);
  private readonly navegadorSinRed = signal(!navigator.onLine);
  private readonly ultimaPeticionFallo = signal(false);

  /** La barra de carga aparece si la carga demora más de 200 ms y se oculta apenas termina (así no parpadea). */
  readonly cargando = toSignal(
    this.pendientes.pipe(
      map((cantidad) => cantidad > 0),
      distinctUntilChanged(),
      switchMap((hayPendientes) => (hayPendientes ? timer(200).pipe(map(() => true)) : of(false))),
    ),
    { initialValue: false },
  );
  readonly sinConexion = computed(() => this.navegadorSinRed() || this.ultimaPeticionFallo());

  constructor() {
    window.addEventListener('online', () => this.navegadorSinRed.set(false));
    window.addEventListener('offline', () => this.navegadorSinRed.set(true));
  }

  inicioPeticion(): void {
    this.pendientes.next(this.pendientes.value + 1);
  }

  finPeticion(): void {
    this.pendientes.next(Math.max(0, this.pendientes.value - 1));
  }

  registrarResultado(huboConexion: boolean): void {
    this.ultimaPeticionFallo.set(!huboConexion);
  }
}
