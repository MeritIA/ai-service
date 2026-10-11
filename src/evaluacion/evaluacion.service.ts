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
import { analizarEntrega } from './dominio/deteccion-de-inyeccion.js';
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
 * Antes de armar el prompt, la entrega pasa por la deteccion del paquete 4.2:
 * se quitan los caracteres invisibles y se marca lo que parezca un intento de
 * manipulacion. **No se bloquea**: se evalua igual y la marca viaja en el
 * resultado, porque un falso positivo no puede descartar a un candidato sin
 * que nadie lo revise.
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

      // Capas 1 y 2 del Plan de Seguridad §6.1, antes de que el contenido
      // llegue al modelo. Lo que sigue usa los archivos ya saneados.
      const { archivos, analisis } = analizarEntrega(solicitud.archivos);
      const saneada = { ...solicitud, archivos };
      if (analisis.riesgo !== 'ninguno') {
        this.registrar('warn', 'indicios_de_inyeccion', {
          idEvaluacion: solicitud.idEvaluacion,
          riesgo: analisis.riesgo,
          puntaje: analisis.puntaje,
          banderas: analisis.banderas,
          versionReglas: analisis.versionReglas,
          versionListaNegra: analisis.versionListaNegra,
        });
      }

      const delimitador = delimitadorPara(saneada);
      const avisar = analisis.riesgo === 'medio' || analisis.riesgo === 'alto';
      const texto = await this.llamarConLimite({
        instruccionDeSistema: instruccionDeSistema(delimitador, avisar),
        contenido: contenidoParaElModelo(saneada, delimitador),
        esquemaDeRespuesta: esquemaDeRespuesta(solicitud.criterios),
      });

      const criterios = validarRespuesta(texto, solicitud.criterios);
      const resultado: ResultadoDeEvaluacion = {
        idEvaluacion: solicitud.idEvaluacion,
        notaFinal: calcularNotaFinal(criterios),
        criterios,
        proveedor: this.proveedor.nombre,
        modelo: this.proveedor.modelo,
        seguridad: analisis,
      };

      this.registrar('log', 'evaluacion_completada', {
        idEvaluacion: solicitud.idEvaluacion,
        proveedor: this.proveedor.nombre,
        modelo: this.proveedor.modelo,
        criterios: criterios.length,
        archivos: solicitud.archivos.length,
        riesgoDeInyeccion: analisis.riesgo,
        duracionMs: Date.now() - inicio,
      });
      return resultado;
    } catch (e) {
      // Sin el contenido de la entrega ni el texto del modelo: solo el tipo de fallo.
      this.registrar('warn', 'evaluacion_fallida', {
        idEvaluacion: solicitud.idEvaluacion,
        proveedor: this.proveedor.nombre,
        tipo: e instanceof Error ? e.name : 'desconocido',
        // El mensaje de los errores del dominio: lleva el codigo HTTP del
        // proveedor y nunca su texto, que podria traer datos de la cuenta.
        // Sin esto, un rechazo del proveedor no se podia diagnosticar.
        detalle: e instanceof Error ? e.message : String(e),
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
