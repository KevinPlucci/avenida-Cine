import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';
import { NOMBRE_CINE } from './core/constantes';
import { SupabaseService } from './core/supabase.service';
import { Header } from './shared/components/header';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header],
  templateUrl: './app.html',
  styles: `
    .aviso { padding-top: 16px; }
    .aviso .alerta { margin: 0; }
    footer { padding-block: 16px; border-top: 1px solid var(--color-borde); color: var(--color-texto-suave); font-size: .85rem; }
  `,
})
export class App {
  private readonly swUpdate = inject(SwUpdate);

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
