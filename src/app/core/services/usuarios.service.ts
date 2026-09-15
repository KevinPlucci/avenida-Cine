import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { Perfil, Rol } from '../models/perfil';

/** Administración de usuarios: el admin asigna el rol de empleado (email 06/02). */
@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly db = inject(SupabaseService).client;

  /** La política de la base solo deja ver todos los perfiles al administrador. */
  async listar(): Promise<Perfil[]> {
    const { data, error } = await this.db
      .from('perfiles')
      .select('id, email, nombre, apellido, fecha_nacimiento, tipo_sangre, color_ojos, dias_vacaciones, rol')
      .order('apellido')
      .order('nombre');
    if (error) throw error;
    return data as Perfil[];
  }

  /** La base valida que quien llama sea admin y que no se quite su propio rol. */
  async cambiarRol(usuarioId: string, rol: Rol): Promise<void> {
    const { error } = await this.db.rpc('cambiar_rol', { p_usuario: usuarioId, p_rol: rol });
    if (error) throw error;
  }
}
