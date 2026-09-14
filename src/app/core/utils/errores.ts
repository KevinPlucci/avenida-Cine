import { HttpErrorResponse } from '@angular/common/http';

const MENSAJES_POR_CODIGO: Record<string, string> = {
  // PostgreSQL
  '23505': 'Ya existe un registro con esos datos.',
  '23503': 'No se puede eliminar porque tiene datos asociados (por ejemplo, funciones o entradas vendidas).',
  '23P01': 'La sala ya tiene una función en ese horario. Tiene que haber 30 minutos entre funciones.',
  '42501': 'No tenés permisos para realizar esta acción.',
  // Supabase Auth
  invalid_credentials: 'Email o contraseña incorrectos.',
  email_not_confirmed: 'Tenés que confirmar tu email antes de ingresar.',
  user_already_exists: 'Ya existe una cuenta con ese email.',
  weak_password: 'La contraseña debe tener al menos 6 caracteres.',
  over_email_send_rate_limit: 'Se enviaron demasiados emails. Probá de nuevo en unos minutos.',
};

/** Convierte un error de Supabase, de HttpClient o de cualquier otro tipo en un mensaje para el usuario. */
export function mensajeError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    // Sin respuesta (status 0) es un problema de conexión; si no, el cuerpo trae el { code, message } de la API.
    return error.status === 0 ? 'No se pudo conectar con el servidor.' : mensajeError(error.error);
  }
  if (typeof error !== 'object' || error === null) {
    return 'Ocurrió un error inesperado.';
  }
  const { code, message } = error as { code?: string; message?: string };

  // P0001 = "raise exception" de nuestras funciones SQL: el mensaje ya está pensado para el usuario.
  if (code === 'P0001' && message) return message;
  if (code && MENSAJES_POR_CODIGO[code]) return MENSAJES_POR_CODIGO[code];
  if (message?.includes('Failed to fetch')) return 'No se pudo conectar con el servidor.';

  return message || 'Ocurrió un error inesperado.';
}
