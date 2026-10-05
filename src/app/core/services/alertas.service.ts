import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { AlertaDisponible } from '../models/pelicula';
import { SupabaseService } from '../supabase.service';

/**
 * Alertas de estreno (email 08/03): el usuario pide que le avisen cuando se habilite la venta de una película.
 * Al ingresar y cada vez que vuelve a la pestaña se le pregunta a la base qué alertas ya se pueden avisar.
 * Se muestran en un aviso dentro de la página y, si el usuario lo permitió, como notificación del sistema.
 */
@Injectable({ providedIn: 'root' })
export class AlertasService {
  private readonly db = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);

  /** Películas con la alerta activada por el usuario logueado. */
  readonly activas = signal<ReadonlySet<number>>(new Set());
  /** Películas que se habilitaron para la venta y todavía no se cerró su aviso. */
  readonly disponibles = signal<AlertaDisponible[]>([]);

  /** Solo interesa quién es el usuario: renovar el token de la misma sesión no vuelve a cargar las alertas. */
  private readonly usuarioId = computed(() => this.auth.usuario()?.id ?? null);

  constructor() {
    // Cada vez que cambia el usuario se cargan sus alertas (o se limpian al salir).
    effect(() => {
      const usuarioId = this.usuarioId();
      untracked(() => {
        this.activas.set(new Set());
        this.disponibles.set([]);
        if (usuarioId) void this.cargar();
      });
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.auth.usuario()) void this.revisar();
    });
  }

  async alternar(peliculaId: number): Promise<void> {
    if (this.activas().has(peliculaId)) {
      const { error } = await this.db.from('alertas_estreno').delete().eq('pelicula_id', peliculaId);
      if (error) throw error;
      this.activas.update((ids) => new Set([...ids].filter((id) => id !== peliculaId)));
      return;
    }
    // Se pide permiso para las notificaciones del sistema. Si no lo da, el aviso aparece igual dentro de la página.
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    const { error } = await this.db.from('alertas_estreno').insert({ pelicula_id: peliculaId });
    if (error) throw error;
    this.activas.update((ids) => new Set([...ids, peliculaId]));
  }

  descartar(peliculaId: number): void {
    this.disponibles.update((alertas) => alertas.filter((a) => a.pelicula_id !== peliculaId));
  }

  private async cargar(): Promise<void> {
    try {
      const { data, error } = await this.db.from('alertas_estreno').select('pelicula_id');
      if (error) throw error;
      this.activas.set(new Set((data as { pelicula_id: number }[]).map((a) => a.pelicula_id)));
      await this.revisar();
    } catch {
      // Si falla, las alertas se revisan la próxima vez que se vuelva a la pestaña.
    }
  }

  /** La base devuelve las alertas que ya se pueden avisar y las marca, así cada una se avisa una sola vez. */
  private async revisar(): Promise<void> {
    const { data, error } = await this.db.rpc('avisar_alertas');
    if (error || !data?.length) return;
    const nuevas = data as AlertaDisponible[];
    this.disponibles.update((alertas) => [...alertas, ...nuevas]);
    nuevas.forEach((alerta) => void this.notificar(alerta));
  }

  private async notificar(alerta: AlertaDisponible): Promise<void> {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const titulo = `${alerta.titulo}: ya podés comprar tus entradas`;
    const opciones: NotificationOptions = {
      body: alerta.preventa ? 'Empezó la preventa en Cine Avenida.' : 'Ya están a la venta en Cine Avenida.',
      icon: '/icons/icon-192x192.png',
      tag: `estreno-${alerta.pelicula_id}`,
      // El service worker de Angular abre la película cuando se toca la notificación.
      data: {
        onActionClick: {
          default: { operation: 'navigateLastFocusedOrOpen', url: `/peliculas/${alerta.pelicula_id}` },
        },
      },
    };
    try {
      const registro = await navigator.serviceWorker?.getRegistration();
      if (registro) {
        await registro.showNotification(titulo, opciones);
      } else {
        new Notification(titulo, opciones);
      }
    } catch {
      // Sin notificación del sistema queda el aviso dentro de la página.
    }
  }
}
