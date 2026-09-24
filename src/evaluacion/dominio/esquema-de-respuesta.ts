import type { CriterioDeRubrica } from './contrato.js';

export type EsquemaJson = Readonly<Record<string, unknown>>;

/**
 * Esquema JSON que se exige al modelo.
 *
 * Los nombres de criterio van como `enum`: el modelo no puede inventar uno.
 * El esquema reduce errores, pero no se confia en el: la salida se valida
 * igual, porque el proveedor puede no respetarlo y porque una entrega
 * maliciosa intentara justamente que el modelo se salga del formato.
 */
export function esquemaDeRespuesta(criterios: readonly CriterioDeRubrica[]): EsquemaJson {
  return {
    type: 'object',
    properties: {
      criterios: {
        type: 'array',
        minItems: criterios.length,
        maxItems: criterios.length,
        items: {
          type: 'object',
          properties: {
            criterio: { type: 'string', enum: criterios.map((c) => c.nombre) },
            puntaje: { type: 'number', minimum: 0 },
            evidencia: { type: 'string' },
          },
          required: ['criterio', 'puntaje', 'evidencia'],
        },
      },
    },
    required: ['criterios'],
  };
}
