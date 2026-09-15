import { DatePipe } from '@angular/common';
import { Component, computed, ElementRef, inject, OnDestroy, signal, viewChild } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { CompraParaValidar } from '../../core/models/compra';
import { ValidacionService } from '../../core/services/validacion.service';
import { mensajeError } from '../../core/utils/errores';
import { AutoFocoDirective } from '../../shared/directives/auto-foco.directive';
import { IdiomaPipe } from '../../shared/pipes/idioma.pipe';

/** Lector de códigos del navegador (Chrome y Android). Si no está, se usa el ingreso manual. */
interface CodigoDetectado {
  rawValue: string;
}
interface DetectorCodigos {
  detect(fuente: CanvasImageSource): Promise<CodigoDetectado[]>;
}
type ConstructorDetector = new (opciones?: { formats?: string[] }) => DetectorCodigos;

const MS_ENTRE_LECTURAS = 300;

@Component({
  selector: 'app-validar',
  imports: [FormsModule, DatePipe, IdiomaPipe, AutoFocoDirective],
  templateUrl: './validar.html',
  styleUrl: './validar.css',
})
export class Validar implements OnDestroy {
  private readonly validacion = inject(ValidacionService);
  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');

  private camara: MediaStream | null = null;
  private temporizador: ReturnType<typeof setInterval> | null = null;

  protected readonly codigoManual = signal('');
  protected readonly compra = signal<CompraParaValidar | null>(null);
  protected readonly escaneando = signal(false);
  protected readonly procesando = signal(false);
  protected readonly error = signal('');
  protected readonly exito = signal('');

  /** El lector solo funciona si el navegador tiene cámara y BarcodeDetector. */
  protected readonly hayLector = signal(this.detector() !== null && !!navigator.mediaDevices?.getUserMedia);

  protected readonly tieneProductos = computed(() => (this.compra()?.productos.length ?? 0) > 0);

  ngOnDestroy(): void {
    this.detenerCamara();
  }

  protected async escanear(): Promise<void> {
    this.limpiar();
    const Detector = this.detector();
    const elemento = this.video()?.nativeElement;
    if (!Detector || !elemento) return;

    try {
      this.camara = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      elemento.srcObject = this.camara;
      await elemento.play();
      this.escaneando.set(true);

      const detector = new Detector({ formats: ['qr_code'] });
      this.temporizador = setInterval(async () => {
        try {
          const [codigo] = await detector.detect(elemento);
          if (codigo) {
            this.detenerCamara();
            await this.buscar(codigo.rawValue);
          }
        } catch {
          // Un fotograma que no se puede leer no interrumpe el escaneo.
        }
      }, MS_ENTRE_LECTURAS);
    } catch {
      this.escaneando.set(false);
      this.error.set('No se pudo abrir la cámara. Ingresá el código a mano.');
    }
  }

  protected detenerCamara(): void {
    if (this.temporizador) {
      clearInterval(this.temporizador);
      this.temporizador = null;
    }
    this.camara?.getTracks().forEach((pista) => pista.stop());
    this.camara = null;
    const elemento = this.video()?.nativeElement;
    if (elemento) elemento.srcObject = null;
    this.escaneando.set(false);
  }

  /** Ingreso manual del código, por si falla el lector (email 06/02). */
  protected async buscarManual(formulario: NgForm): Promise<void> {
    this.limpiar();
    if (!this.codigoManual().trim()) {
      formulario.control.markAllAsTouched();
      return;
    }
    await this.buscar(this.codigoManual());
    formulario.resetForm({ codigo: '' });
  }

  protected async validarEntrada(): Promise<void> {
    await this.accion(
      (codigo) => this.validacion.validarEntrada(codigo),
      'Entrada validada. Puede pasar a la sala.',
    );
  }

  protected async entregarProductos(): Promise<void> {
    await this.accion(
      (codigo) => this.validacion.entregarProductos(codigo),
      'Productos entregados.',
    );
  }

  protected nuevaBusqueda(): void {
    this.limpiar();
    this.compra.set(null);
    this.codigoManual.set('');
  }

  private async buscar(texto: string): Promise<void> {
    const codigo = this.validacion.normalizarCodigo(texto);
    if (!codigo) {
      this.error.set('Ese código no tiene el formato de una entrada.');
      return;
    }
    this.procesando.set(true);
    try {
      this.compra.set(await this.validacion.consultar(codigo));
    } catch (e) {
      this.compra.set(null);
      this.error.set(mensajeError(e));
    } finally {
      this.procesando.set(false);
    }
  }

  private async accion(
    operacion: (codigo: string) => Promise<CompraParaValidar>,
    mensaje: string,
  ): Promise<void> {
    const compra = this.compra();
    if (!compra) return;
    this.limpiar();
    this.procesando.set(true);
    try {
      this.compra.set(await operacion(compra.codigo));
      this.exito.set(mensaje);
    } catch (e) {
      this.error.set(mensajeError(e));
      // Se vuelve a leer el estado: puede haberla validado otra persona.
      try {
        this.compra.set(await this.validacion.consultar(compra.codigo));
      } catch {
        // Si tampoco se puede consultar, queda el mensaje de error anterior.
      }
    } finally {
      this.procesando.set(false);
    }
  }

  private detector(): ConstructorDetector | null {
    const api = (globalThis as unknown as { BarcodeDetector?: ConstructorDetector }).BarcodeDetector;
    return typeof api === 'function' ? api : null;
  }

  private limpiar(): void {
    this.error.set('');
    this.exito.set('');
  }
}
