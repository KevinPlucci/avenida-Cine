import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { CompraParaValidar } from '../models/compra';

const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validación de entradas y entrega del candy bar (email 06/02). Solo para empleados y admin. */
@Injectable({ providedIn: 'root' })
export class ValidacionService {
  private readonly db = inject(SupabaseService).client;

  /** El QR guarda el código de la compra; el lector puede devolver espacios o mayúsculas. */
  normalizarCodigo(texto: string): string | null {
    const codigo = texto.trim().toLowerCase();
    return FORMATO_UUID.test(codigo) ? codigo : null;
  }

  async consultar(codigo: string): Promise<CompraParaValidar> {
    return this.llamar('compra_para_validar', codigo);
  }

  async validarEntrada(codigo: string): Promise<CompraParaValidar> {
    return this.llamar('validar_entrada', codigo);
  }

  async entregarProductos(codigo: string): Promise<CompraParaValidar> {
    return this.llamar('entregar_productos', codigo);
  }

  private async llamar(funcion: string, codigo: string): Promise<CompraParaValidar> {
    const { data, error } = await this.db.rpc(funcion, { p_codigo: codigo });
    if (error) throw error;
    return data as CompraParaValidar;
  }
}
