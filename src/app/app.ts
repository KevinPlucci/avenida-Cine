import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';
import { NOMBRE_CINE } from './core/constantes';
import { EstadoRedService } from './core/http/estado-red.service';
import { SupabaseService } from './core/supabase.service';
import { Header } from './shared/components/header';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header],
  templateUrl: './app.html',
  styles: `
    /* El pie queda al final de la ventana aunque la pantalla tenga poco contenido */
    :host { display: flex; flex-direction: column; min-height: 100vh; min-height: 100dvh; }
    :host > .contenedor { width: 100%; }
    main { flex: 1 0 auto; }
    .barra-carga { position: fixed; inset: 0 0 auto; z-index: 100; height: 3px; overflow: hidden; }
    .barra-carga::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 35%; background: var(--color-dorado); animation: recorrer 1.1s ease-in-out infinite; }
    @keyframes recorrer { from { transform: translateX(-100%); } to { transform: translateX(300%); } }
    .aviso { padding-top: 16px; }
    .aviso .alerta { margin: 0; }
    footer { padding-block: 22px; font-size: .85rem; color: #b9b4ae; background: var(--color-oscuro); }
    footer .contenedor { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px 16px; }
    .marca { font-family: var(--fuente-titulos); letter-spacing: .12em; text-transform: uppercase; color: #fff; }
  `,
})
export class App {
  private readonly swUpdate = inject(SwUpdate);

  protected readonly estadoRed = inject(EstadoRedService);
  protected readonly nombreCine = NOMBRE_CINE;
  protected readonly supabaseConfigurado = inject(SupabaseService).configurado;
  protected readonly hayActualizacion = signal(false);

  constructor() {
    // PWA: el service worker avisa cuando descargó una versión nueva de la app.
    if (this.swUpdate.isEnabled) {
      this.swUpdate.versionUpdates
        .pipe(
          filter((evento): evento is VersionReadyEvent => evento.type === 'VERSION_READY'),
          takeUntilDestroyed(),
        )
        .subscribe(() => this.hayActualizacion.set(true));
    }
  }

  protected recargar(): void {
    document.location.reload();
  }
}
