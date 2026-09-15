export const TIPOS_SANGRE = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-'] as const;

export const COLORES_OJOS = ['Marrón', 'Negro', 'Azul', 'Verde', 'Gris', 'Avellana', 'Otro'] as const;

export type Rol = 'cliente' | 'empleado' | 'admin';

export interface Perfil {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  /** AAAA-MM-DD */
  fecha_nacimiento: string;
  tipo_sangre: string;
  color_ojos: string;
  dias_vacaciones: number;
  rol: Rol;
}

export type DatosRegistro = Omit<Perfil, 'id' | 'rol'> & { password: string };
