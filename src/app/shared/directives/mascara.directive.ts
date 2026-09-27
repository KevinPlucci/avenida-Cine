import { Directive, ElementRef, inject, input, Renderer2 } from '@angular/core';

export type TipoMascara = 'numeros' | 'tarjeta' | 'vencimiento';

/**
 * Da formato a un input mientras se escribe:
 * - numeros: solo dígitos
 * - tarjeta: 16 dígitos en grupos de 4 ("4111 1111 1111 1111")
 * - vencimiento: "MM/AA"
 */
@Directive({
  selector: 'input[appMascara]',
  host: { '(input)': 'aplicar()' },
})
export class MascaraDirective {
  readonly appMascara = input.required<TipoMascara>();

  private readonly elemento = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
  private readonly renderer = inject(Renderer2);

  protected aplicar(): void {
    const formateado = formatear(this.elemento.value, this.appMascara());
    if (formateado !== this.elemento.value) {
      // Renderer2 cambia el valor a través del sistema de renderizado de Angular, sin tocar el DOM a mano.
      this.renderer.setProperty(this.elemento, 'value', formateado);
      // Se vuelve a disparar el evento para que el formulario reactivo tome el valor corregido.
      this.elemento.dispatchEvent(new Event('input'));
    }
  }
}

export function formatear(valor: string, tipo: TipoMascara): string {
  const digitos = valor.replace(/\D/g, '');
  switch (tipo) {
    case 'tarjeta':
      return digitos.slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ');
    case 'vencimiento': {
      const cuatro = digitos.slice(0, 4);
      return cuatro.length > 2 ? `${cuatro.slice(0, 2)}/${cuatro.slice(2)}` : cuatro;
    }
    default:
      return digitos;
  }
}
