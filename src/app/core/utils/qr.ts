import { toDataURL } from 'qrcode';

/** Genera la imagen del QR (data URL en PNG) con el código de la compra. */
export function generarQr(codigo: string): Promise<string> {
  return toDataURL(codigo, { width: 300, margin: 1, errorCorrectionLevel: 'M' });
}
