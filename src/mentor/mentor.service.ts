import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import {
  PROVEEDOR_DE_MODELO,
  ProveedorNoDisponibleError,
  type ProveedorDeModelo,
} from '../evaluacion/dominio/proveedor-de-modelo.js';
import { SalidaInvalidaError } from '../evaluacion/dominio/validar-respuesta.js';
import {
  MAX_TOKENS_DE_SALIDA,
  type RespuestaDeMentor,
  type SolicitudDeMentor,
} from './dominio/contrato.js';
import {
  condensar,
  contenidoParaElMentor,
  ESQUEMA_DEL_MENTOR,
  INSTRUCCION_DEL_MENTOR,
} from './dominio/instrucciones.js';

const TIEMPO_MAXIMO_POR_OMISION_MS = 30_000;

/**
 * Mentor conversacional.
 *
 * Sin estado: recibe un resumen ya compactado por el backend, los ultimos
 * turnos y la pregunta. Gasta pocos tokens por construccion: instruccion fija
 * (cacheable) al frente, resumen en texto plano, historial acotado y salida
 * con tope duro.
 */
@Injectable()
export class MentorService {
  private readonly logger = new Logger('Mentor');
  private readonly tiempoMaximoMs: number;

  constructor(
    @Inject(PROVEEDOR_DE_MODELO) private readonly proveedor: ProveedorDeModelo,
    config: ConfigService,
  ) {
    this.tiempoMaximoMs =
      Number(config.get<number>('TIEMPO_MAXIMO_MS')) || TIEMPO_MAXIMO_POR_OMISION_MS;
  }

  async responder(solicitud: SolicitudDeMentor): Promise<RespuestaDeMentor> {
    const inicio = Date.now();
    const delimitador = `<<${randomBytes(16).toString('hex')}>>`;
    const contenido = contenidoParaElMentor(
      solicitud.contexto,
      solicitud.historial,
      solicitud.pregunta.replaceAll(delimitador, ''),
      delimitador,
    );

    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), this.tiempoMaximoMs);
    let texto: string;
    try {
      texto = await this.proveedor.generarJson({
        instruccionDeSistema: INSTRUCCION_DEL_MENTOR,
        contenido,
        esquemaDeRespuesta: ESQUEMA_DEL_MENTOR,
        maxTokensDeSalida: MAX_TOKENS_DE_SALIDA,
        temperatura: 0.4,
        senal: controlador.signal,
      });
    } catch (e) {
      if (controlador.signal.aborted) {
        throw new ProveedorNoDisponibleError(
          `El proveedor no respondio en ${this.tiempoMaximoMs} ms.`,
        );
      }
      throw e;
    } finally {
      clearTimeout(temporizador);
    }

    const { respuesta, sugerencias } = validarSalida(texto);
    this.logger.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'log',
        eventType: 'mentor_respondio',
        // Sin la pregunta ni la respuesta: son texto del candidato.
        metadata: {
          proveedor: this.proveedor.nombre,
          caracteresDeEntrada: contenido.length,
          duracionMs: Date.now() - inicio,
        },
      }),
    );
    return {
      respuesta,
      sugerencias,
      proveedor: this.proveedor.nombre,
      modelo: this.proveedor.modelo,
    };
  }
}

function validarSalida(texto: string): { respuesta: string; sugerencias: string[] } {
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    throw new SalidaInvalidaError('no_es_json', 'La respuesta del mentor no es JSON.');
  }
  const r = bruto as { respuesta?: unknown; sugerencias?: unknown } | null;
  if (typeof r?.respuesta !== 'string' || r.respuesta.trim() === '') {
    throw new SalidaInvalidaError('estructura', 'El mentor no devolvio una respuesta.');
  }
  const sugerencias = Array.isArray(r.sugerencias)
    ? r.sugerencias
        .filter((s): s is string => typeof s === 'string' && s.trim() !== '')
        .slice(0, 3)
        .map((s) => condensar(s, 80))
    : [];
  return { respuesta: r.respuesta.trim().slice(0, 1500), sugerencias };
}
