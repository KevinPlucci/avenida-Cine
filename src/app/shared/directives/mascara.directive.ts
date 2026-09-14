import { Directive, ElementRef, inject, input } from '@angular/core';

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

  protected aplicar(): void {
    const formateado = formatear(this.elemento.value, this.appMascara());
    if (formateado !== this.elemento.value) {
      this.elemento.value = formateado;
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
