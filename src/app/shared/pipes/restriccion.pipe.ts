import { Pipe, PipeTransform } from '@angular/core';
import { RestriccionEdad } from '../../core/models/pelicula';

/** Restricción de edad (email 12/02): 0 -> "ATP", 13 -> "+13", 18 -> "+18" */
@Pipe({ name: 'restriccion' })
export class RestriccionPipe implements PipeTransform {
  transform(edad: RestriccionEdad): string {
    return edad ? `+${edad}` : 'ATP';
  }
}
