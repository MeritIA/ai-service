import {
  ApiError,
  type GenerateContentParameters,
  type GenerateContentResponse,
} from '@google/genai';
import {
  ProveedorNoDisponibleError,
  ProveedorRechazoLaSolicitudError,
  type ProveedorDeModelo,
  type SolicitudAlModelo,
} from '../dominio/proveedor-de-modelo.js';

/** Lo unico que el adaptador usa del SDK. Permite probarlo sin red. */
export interface ClienteGemini {
  readonly models: {
    generateContent(parametros: GenerateContentParameters): Promise<GenerateContentResponse>;
  };
}

/**
 * Motivos de fin que significan que Gemini bloqueo la respuesta. Reintentar la
 * misma entrega no cambia la decision de sus filtros.
 */
const FINES_POR_BLOQUEO = new Set([
  'SAFETY',
  'RECITATION',
  'BLOCKLIST',
  'PROHIBITED_CONTENT',
  'SPII',
  'IMAGE_SAFETY',
  'LANGUAGE',
]);

/**
 * Adaptador de Google Gemini (paquete 4.4).
 *
 * Todo lo especifico de Gemini vive aqui: el SDK, sus nombres de parametros y
 * sus codigos de error. Cambiar de proveedor es escribir otro archivo como este
 * y seleccionarlo en la configuracion.
 */
export class ProveedorGemini implements ProveedorDeModelo {
  readonly nombre = 'gemini';

  constructor(
    private readonly cliente: ClienteGemini,
    readonly modelo: string,
  ) {}

  async generarJson(solicitud: SolicitudAlModelo): Promise<string> {
    let respuesta: GenerateContentResponse;
    try {
      respuesta = await this.cliente.models.generateContent({
        model: this.modelo,
        contents: solicitud.contenido,
        config: {
          systemInstruction: solicitud.instruccionDeSistema,
          responseMimeType: 'application/json',
          responseJsonSchema: solicitud.esquemaDeRespuesta,
          // Temperatura 0: dos candidatos con la misma entrega deben sacar la
          // misma nota. Es la promesa del producto.
          temperature: 0,
          abortSignal: solicitud.senal,
        },
      });
    } catch (e) {
      throw traducirError(e);
    }

    const bloqueo = respuesta.promptFeedback?.blockReason;
    if (bloqueo) {
      throw new ProveedorRechazoLaSolicitudError(
        `Gemini bloqueo la solicitud (${String(bloqueo)}).`,
      );
    }
    const fin = respuesta.candidates?.[0]?.finishReason;
    if (fin && FINES_POR_BLOQUEO.has(String(fin))) {
      throw new ProveedorRechazoLaSolicitudError(`Gemini detuvo la respuesta (${String(fin)}).`);
    }

    // Una respuesta vacia no se maquilla: el dominio la rechazara por no ser JSON.
    return respuesta.text ?? '';
  }
}

/**
 * Traduce los errores del SDK al lenguaje del dominio.
 *
 * El mensaje original no se propaga: puede traer detalles de la cuenta o de la
 * peticion. Se conserva solo el codigo HTTP, que es lo que decide si reintentar.
 */
export function traducirError(e: unknown): Error {
  if (e instanceof ApiError) {
    if (e.status === 429 || e.status >= 500) {
      return new ProveedorNoDisponibleError(`Gemini respondio ${e.status}.`);
    }
    return new ProveedorRechazoLaSolicitudError(`Gemini rechazo la solicitud con ${e.status}.`);
  }
  if (
    e instanceof Error &&
    (e.name === 'AbortError' || e.name === 'TimeoutError' || e instanceof TypeError)
  ) {
    return new ProveedorNoDisponibleError('No se pudo completar la llamada a Gemini.');
  }
  return e instanceof Error ? e : new Error('Error desconocido al llamar a Gemini.');
}
