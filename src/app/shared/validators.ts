import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { edadCumplida, fechaDeListas } from '../core/utils/fechas';

/** Grupo con controles "password" y "confirmacion". */
export const passwordsIgualesValidator: ValidatorFn = (grupo: AbstractControl): ValidationErrors | null => {
  const password = grupo.get('password')?.value;
  const confirmacion = grupo.get('confirmacion')?.value;
  return !confirmacion || password === confirmacion ? null : { passwordsDistintas: true };
};

/** Grupo con controles "dia", "mes" y "anio" (selects). Valida que la fecha exista y no sea futura. */
export const fechaNacimientoValidator: ValidatorFn = (grupo: AbstractControl): ValidationErrors | null => {
  const dia = Number(grupo.get('dia')?.value);
  const mes = Number(grupo.get('mes')?.value);
  const anio = Number(grupo.get('anio')?.value);
  if (!dia || !mes || !anio) return null;

  const fecha = new Date(anio, mes - 1, dia);
  // Si el día no existe en ese mes (ej. 31 de febrero) Date lo pasa al mes siguiente.
  if (fecha.getMonth() !== mes - 1) return { fechaInvalida: true };
  if (fecha > new Date()) return { fechaFutura: true };
  return null;
};

/** Grupo "dia", "mes" y "anio" opcional (fecha de estreno, email 08/03): vacío o completo con una fecha que exista. */
export const fechaOpcionalValidator: ValidatorFn = (grupo: AbstractControl): ValidationErrors | null => {
  const { dia, mes, anio } = grupo.value as { dia?: string; mes?: string; anio?: string };
  if (!dia && !mes && !anio) return null;
  if (!dia || !mes || !anio) return { fechaIncompleta: true };
  const fecha = new Date(Number(anio), Number(mes) - 1, Number(dia));
  return fecha.getMonth() === Number(mes) - 1 ? null : { fechaInvalida: true };
};

/** Grupo "dia", "mes" y "anio": la persona tiene que tener al menos esa edad (email 12/02). */
export function edadMinimaValidator(edadMinima: number): ValidatorFn {
  return (grupo: AbstractControl): ValidationErrors | null => {
    const { dia, mes, anio } = grupo.value as { dia?: string; mes?: string; anio?: string };
    if (!dia || !mes || !anio) return null;
    return edadCumplida(fechaDeListas(dia, mes, anio)) >= edadMinima ? null : { menorDeEdad: { edad: edadMinima } };
  };
}

/** Vencimiento de tarjeta en formato MM/AA que no esté vencido. */
export const vencimientoTarjetaValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const valor = String(control.value ?? '').trim();
  if (!valor) return null;

  const partes = /^(\d{2})\/(\d{2})$/.exec(valor);
  const mes = Number(partes?.[1]);
  if (!partes || mes < 1 || mes > 12) return { formatoVencimiento: true };

  const primerDiaDelMesSiguiente = new Date(2000 + Number(partes[2]), mes, 1);
  return primerDiaDelMesSiguiente > new Date() ? null : { tarjetaVencida: true };
};
