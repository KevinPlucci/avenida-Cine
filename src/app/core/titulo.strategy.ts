import { inject, Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { NOMBRE_CINE } from './constantes';

/** Arma el título de la pestaña como "Cartelera | Cine Avenida" a partir del title de cada ruta. */
@Injectable({ providedIn: 'root' })
export class TituloStrategy extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const titulo = this.buildTitle(snapshot);
    this.title.setTitle(titulo ? `${titulo} | ${NOMBRE_CINE}` : NOMBRE_CINE);
  }
}
