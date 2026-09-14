import { computed, inject, Injectable, signal } from '@angular/core';
import { User } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase.service';
import { DatosRegistro, Perfil } from '../models/perfil';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService).client;

  private readonly usuarioActual = signal<User | null>(null);
  private readonly perfilActual = signal<Perfil | null>(null);

  readonly usuario = this.usuarioActual.asReadonly();
  readonly perfil = this.perfilActual.asReadonly();
  readonly logueado = computed(() => this.usuarioActual() !== null);
  readonly esAdmin = computed(() => this.perfilActual()?.rol === 'admin');

  /** Se resuelve cuando ya se sabe si había una sesión guardada. */
  private readonly sesionInicial = this.inicializar();

  esperarSesion(): Promise<void> {
    return this.sesionInicial;
  }

  async iniciarSesion(email: string, password: string): Promise<void> {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await this.actualizarSesion(data.user);
  }

  /**
   * Registra al usuario. Los datos del perfil viajan como metadata y un trigger
   * de la base crea el perfil y el cupón de primera compra.
   */
  async registrarse(datos: DatosRegistro): Promise<{ requiereConfirmacion: boolean }> {
    const { email, password, ...perfil } = datos;
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: { data: perfil, emailRedirectTo: window.location.origin },
    });
    if (error) throw error;

    // Con la confirmación de email activada, Supabase no devuelve error si el email ya existe:
    // devuelve un usuario sin identidades.
    if (data.user?.identities?.length === 0) {
      throw new Error('Ya existe una cuenta con ese email.');
    }

    if (data.session) {
      await this.actualizarSesion(data.user);
    }
    return { requiereConfirmacion: !data.session };
  }

  async cerrarSesion(): Promise<void> {
    await this.supabase.auth.signOut();
    await this.actualizarSesion(null);
  }

  private async inicializar(): Promise<void> {
    try {
      const { data } = await this.supabase.auth.getSession();
      await this.actualizarSesion(data.session?.user ?? null);
    } catch {
      this.usuarioActual.set(null);
    }

    this.supabase.auth.onAuthStateChange(() => {
      // Supabase recomienda no llamar a la API dentro de este callback, por eso se difiere.
      // Se lee la sesión vigente (no la del evento) por si cambió mientras tanto, por ejemplo al salir.
      setTimeout(async () => {
        const { data } = await this.supabase.auth.getSession();
        await this.actualizarSesion(data.session?.user ?? null);
      });
    });
  }

  private async actualizarSesion(usuario: User | null): Promise<void> {
    this.usuarioActual.set(usuario);
    if (!usuario) {
      this.perfilActual.set(null);
      return;
    }
    if (this.perfilActual()?.id === usuario.id) return;

    const { data } = await this.supabase.from('perfiles').select('*').eq('id', usuario.id).maybeSingle();
    this.perfilActual.set(data as Perfil | null);
  }
}
