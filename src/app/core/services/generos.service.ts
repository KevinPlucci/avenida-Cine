import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { Genero } from '../models/genero';

@Injectable({ providedIn: 'root' })
export class GenerosService {
  private readonly db = inject(SupabaseService).client;

  async listar(): Promise<Genero[]> {
    const { data, error } = await this.db.from('generos').select('id, nombre').order('nombre');
    if (error) throw error;
    return data as Genero[];
  }

  async crear(nombre: string): Promise<void> {
    const { error } = await this.db.from('generos').insert({ nombre });
    if (error) throw error;
  }

  async eliminar(id: number): Promise<void> {
    const { error } = await this.db.from('generos').delete().eq('id', id);
    if (error) throw error;
  }
}
