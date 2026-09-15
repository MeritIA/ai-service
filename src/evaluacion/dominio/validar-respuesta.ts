import type { CalificacionDeCriterio, CriterioDeRubrica } from './contrato.js';

export const LONGITUD_MINIMA_EVIDENCIA = 10;
export const LONGITUD_MAXIMA_EVIDENCIA = 2000;

export type MotivoSalidaInvalida =
  | 'no_es_json'
  | 'estructura'
  | 'criterio_desconocido'
  | 'criterio_repetido'
  | 'criterio_faltante'
  | 'puntaje_fuera_de_escala'
  | 'sin_evidencia';

/**
 * La salida del modelo no cumple el contrato.
 *
 * El mensaje nunca incluye el texto del modelo: si una entrega logro
 * manipularlo, ese texto es justamente lo que no debe viajar a los logs ni al
 * backend.
 */
export class SalidaInvalidaError extends Error {
  override readonly name = 'SalidaInvalidaError';

  constructor(
    readonly motivo: MotivoSalidaInvalida,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Convierte la respuesta del modelo en calificaciones, o la rechaza.
 *
 * Plan de Seguridad §6.1, capa 3: "validar que la salida siga el formato
 * esperado antes de almacenarla". Se rechaza si no es JSON, si falta o sobra un
 * criterio, si un puntaje sale de su escala o si falta evidencia. Solo se
 * copian los campos conocidos: cualquier otra cosa que el modelo anada se
 * descarta.
 */
export function validarRespuesta(
  texto: string,
  criterios: readonly CriterioDeRubrica[],
): CalificacionDeCriterio[] {
  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch {
    throw new SalidaInvalidaError('no_es_json', 'La respuesta del modelo no es JSON.');
  }

  if (!esObjeto(datos) || !Array.isArray(datos.criterios)) {
    throw new SalidaInvalidaError(
      'estructura',
      'La respuesta del modelo no tiene la lista de criterios.',
    );
  }

  const porNombre = new Map(criterios.map((c) => [c.nombre, c]));
  const calificaciones = new Map<string, CalificacionDeCriterio>();

  for (const item of datos.criterios as unknown[]) {
    if (
      !esObjeto(item) ||
      typeof item.criterio !== 'string' ||
      typeof item.puntaje !== 'number' ||
      typeof item.evidencia !== 'string'
    ) {
      throw new SalidaInvalidaError(
        'estructura',
        'Un criterio de la respuesta no tiene la forma esperada.',
      );
    }

    const criterio = porNombre.get(item.criterio);
    if (!criterio) {
      throw new SalidaInvalidaError(
        'criterio_desconocido',
        'La respuesta califica un criterio que no esta en la rubrica.',
      );
    }
    if (calificaciones.has(criterio.nombre)) {
      throw new SalidaInvalidaError(
        'criterio_repetido',
        `La respuesta califica dos veces "${criterio.nombre}".`,
      );
    }
    if (
      !Number.isFinite(item.puntaje) ||
      item.puntaje < 0 ||
      item.puntaje > criterio.escalaMaxima
    ) {
      throw new SalidaInvalidaError(
        'puntaje_fuera_de_escala',
        `El puntaje de "${criterio.nombre}" esta fuera de 0-${criterio.escalaMaxima}.`,
      );
    }
    const evidencia = item.evidencia.trim();
    if (evidencia.length < LONGITUD_MINIMA_EVIDENCIA) {
      throw new SalidaInvalidaError(
        'sin_evidencia',
        `El criterio "${criterio.nombre}" no tiene evidencia.`,
      );
    }

    calificaciones.set(criterio.nombre, {
      criterio: criterio.nombre,
      puntaje: item.puntaje,
      escalaMaxima: criterio.escalaMaxima,
      peso: criterio.peso,
      evidencia: evidencia.slice(0, LONGITUD_MAXIMA_EVIDENCIA),
    });
  }

  // En el orden de la rubrica, no en el que eligio el modelo.
  const resultado: CalificacionDeCriterio[] = [];
  for (const c of criterios) {
    const calificacion = calificaciones.get(c.nombre);
    if (!calificacion) {
      throw new SalidaInvalidaError('criterio_faltante', `La respuesta no califica "${c.nombre}".`);
    }
    resultado.push(calificacion);
  }
  return resultado;
}
