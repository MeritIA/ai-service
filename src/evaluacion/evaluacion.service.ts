import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ResultadoDeEvaluacion, SolicitudDeEvaluacion } from './dominio/contrato.js';
import { esquemaDeRespuesta } from './dominio/esquema-de-respuesta.js';
import {
  contenidoParaElModelo,
  delimitadorPara,
  instruccionDeSistema,
} from './dominio/instrucciones.js';
import { calcularNotaFinal } from './dominio/nota.js';
import {
  PROVEEDOR_DE_MODELO,
  ProveedorNoDisponibleError,
  type ProveedorDeModelo,
  type SolicitudAlModelo,
} from './dominio/proveedor-de-modelo.js';
import { validarRubrica } from './dominio/rubrica.js';
import { SalidaInvalidaError, validarRespuesta } from './dominio/validar-respuesta.js';

export const TIEMPO_MAXIMO_POR_OMISION_MS = 90_000;

/**
 * Evalua una entrega contra su rubrica.
 *
 * Orden de las defensas: valida la rubrica, separa instrucciones y entrega por
 * canales distintos con un delimitador impredecible, exige un esquema JSON, y
 * valida la salida sin confiar en que el proveedor lo respeto. La nota final la
 * calcula este codigo, no el modelo.
 *
 * Las capas de deteccion de inyeccion sobre la entrada (lista negra, puntaje de
 * riesgo) y el registro forense son del paquete 4.2 y se anaden antes de la
 * llamada al proveedor.
 */
@Injectable()
export class EvaluacionService {
  private readonly logger = new Logger('Evaluacion');
  private readonly tiempoMaximoMs: number;

  constructor(
    @Inject(PROVEEDOR_DE_MODELO) private readonly proveedor: ProveedorDeModelo,
    config: ConfigService,
  ) {
    this.tiempoMaximoMs =
      Number(config.get<number>('TIEMPO_MAXIMO_MS')) || TIEMPO_MAXIMO_POR_OMISION_MS;
  }

  async evaluar(solicitud: SolicitudDeEvaluacion): Promise<ResultadoDeEvaluacion> {
    const inicio = Date.now();
    try {
      validarRubrica(solicitud.criterios);

      const delimitador = delimitadorPara(solicitud);
      const texto = await this.llamarConLimite({
        instruccionDeSistema: instruccionDeSistema(delimitador),
        contenido: contenidoParaElModelo(solicitud, delimitador),
        esquemaDeRespuesta: esquemaDeRespuesta(solicitud.criterios),
      });

      const criterios = validarRespuesta(texto, solicitud.criterios);
      const resultado: ResultadoDeEvaluacion = {
        idEvaluacion: solicitud.idEvaluacion,
        notaFinal: calcularNotaFinal(criterios),
        criterios,
        proveedor: this.proveedor.nombre,
        modelo: this.proveedor.modelo,
      };

      this.registrar('log', 'evaluacion_completada', {
        idEvaluacion: solicitud.idEvaluacion,
        proveedor: this.proveedor.nombre,
        modelo: this.proveedor.modelo,
        criterios: criterios.length,
        archivos: solicitud.archivos.length,
        duracionMs: Date.now() - inicio,
      });
      return resultado;
    } catch (e) {
      // Sin el contenido de la entrega ni el texto del modelo: solo el tipo de fallo.
      this.registrar('warn', 'evaluacion_fallida', {
        idEvaluacion: solicitud.idEvaluacion,
        proveedor: this.proveedor.nombre,
        tipo: e instanceof Error ? e.name : 'desconocido',
        ...(e instanceof SalidaInvalidaError ? { motivo: e.motivo } : {}),
        duracionMs: Date.now() - inicio,
      });
      throw e;
    }
  }

  /**
   * Llama al proveedor con tiempo maximo.
   *
   * Aborta la senal para que el adaptador cancele la llamada de red, y ademas
   * corta por su cuenta: un adaptador que ignore la senal no puede dejar la
   * peticion colgada.
   */
  private async llamarConLimite(solicitud: Omit<SolicitudAlModelo, 'senal'>): Promise<string> {
    const controlador = new AbortController();
    let temporizador: NodeJS.Timeout | undefined;

    const limite = new Promise<never>((_, rechazar) => {
      temporizador = setTimeout(() => {
        controlador.abort();
        rechazar(
          new ProveedorNoDisponibleError(`El proveedor no respondio en ${this.tiempoMaximoMs} ms.`),
        );
      }, this.tiempoMaximoMs);
    });

    const llamada = this.proveedor.generarJson({ ...solicitud, senal: controlador.signal });
    // Si gana el limite, la llamada puede rechazar despues: sin esto seria un
    // rechazo no manejado que tumba el proceso.
    llamada.catch(() => undefined);

    try {
      return await Promise.race([llamada, limite]);
    } finally {
      clearTimeout(temporizador);
    }
  }

  private registrar(nivel: 'log' | 'warn', eventType: string, metadata: object): void {
    this.logger[nivel](
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: nivel === 'log' ? 'info' : 'warn',
        eventType,
        metadata,
      }),
    );
  }
}
