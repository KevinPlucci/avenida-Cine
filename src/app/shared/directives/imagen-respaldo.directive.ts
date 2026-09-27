import { Directive, ElementRef, inject, Renderer2 } from '@angular/core';

const IMAGEN_RESPALDO = 'poster-no-disponible.svg';

/** Si la imagen no carga (URL rota o sin conexión) muestra un póster genérico. */
@Directive({
  selector: 'img[appImagenRespaldo]',
  host: { '(error)': 'usarRespaldo()' },
})
export class ImagenRespaldoDirective {
  private readonly imagen = inject<ElementRef<HTMLImageElement>>(ElementRef).nativeElement;
  private readonly renderer = inject(Renderer2);

  protected usarRespaldo(): void {
    if (!this.imagen.src.endsWith(IMAGEN_RESPALDO)) {
      this.renderer.setAttribute(this.imagen, 'src', IMAGEN_RESPALDO);
    }
  }
}
