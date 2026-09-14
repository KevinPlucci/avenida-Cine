import { computed, Injectable, signal } from '@angular/core';

/** Estado de las peticiones HTTP. Lo actualizan los interceptores y lo muestra el layout principal. */
@Injectable({ providedIn: 'root' })
export class EstadoRedService {
  private readonly pendientes = signal(0);
  private readonly navegadorSinRed = signal(!navigator.onLine);
  private readonly ultimaPeticionFallo = signal(false);

  readonly cargando = computed(() => this.pendientes() > 0);
  readonly sinConexion = computed(() => this.navegadorSinRed() || this.ultimaPeticionFallo());

  constructor() {
    window.addEventListener('online', () => this.navegadorSinRed.set(false));
    window.addEventListener('offline', () => this.navegadorSinRed.set(true));
  }

  inicioPeticion(): void {
    this.pendientes.update((cantidad) => cantidad + 1);
  }

  finPeticion(): void {
    this.pendientes.update((cantidad) => Math.max(0, cantidad - 1));
  }

  registrarResultado(huboConexion: boolean): void {
    this.ultimaPeticionFallo.set(!huboConexion);
  }
}
