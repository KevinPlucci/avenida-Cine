import { afterNextRender, Directive, ElementRef, inject } from '@angular/core';

/** Pone el foco en el elemento apenas se muestra (primer campo de un formulario). */
@Directive({ selector: '[appAutoFoco]' })
export class AutoFocoDirective {
  constructor() {
    const elemento = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    afterNextRender(() => {
      // No le saca el foco a otro campo si el usuario ya empezó a escribir.
      if (document.activeElement === document.body) {
        elemento.focus();
      }
    });
  }
}
