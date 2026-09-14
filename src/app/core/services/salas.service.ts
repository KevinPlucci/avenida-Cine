import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { Sala } from '../models/sala';

@Injectable({ providedIn: 'root' })
export class SalasService {
  private readonly db = inject(SupabaseService).client;

  async listar(): Promise<Sala[]> {
    const { data, error } = await this.db.from('salas').select('id, nombre, activa').order('nombre');
    if (error) throw error;
    return data as Sala[];
  }

  async crear(nombre: string): Promise<void> {
    const { error } = await this.db.from('salas').insert({ nombre });
    if (error) throw error;
  }

  async cambiarActiva(id: number, activa: boolean): Promise<void> {
    const { error } = await this.db.from('salas').update({ activa }).eq('id', id);
    if (error) throw error;
  }

  async eliminar(id: number): Promise<void> {
    const { error } = await this.db.from('salas').delete().eq('id', id);
    if (error) throw error;
  }
}
