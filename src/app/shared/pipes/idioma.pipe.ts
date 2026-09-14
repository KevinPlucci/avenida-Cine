import { Pipe, PipeTransform } from '@angular/core';
import { Idioma } from '../../core/models/funcion';

/** "castellano" -> "Castellano", "subtitulada" -> "Subtitulada" */
@Pipe({ name: 'idioma' })
export class IdiomaPipe implements PipeTransform {
  transform(idioma: Idioma): string {
    return idioma === 'castellano' ? 'Castellano' : 'Subtitulada';
  }
}
