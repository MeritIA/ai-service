import type { CriterioDeRubrica } from './contrato.js';

export const PESO_TOTAL = 100;
export const TOLERANCIA = 0.01;

export class RubricaInvalidaError extends Error {
  override readonly name = 'RubricaInvalidaError';
}

/**
 * Las mismas reglas que el backend aplica al guardar la rubrica.
 *
 * Se repiten aqui porque este servicio no confia en nada de lo que recibe: si
 * los pesos no suman 100, la nota final dejaria de ir de 0 a 100 y nadie lo
 * notaria hasta ver un ranking absurdo.
 */
export function validarRubrica(criterios: readonly CriterioDeRubrica[]): void {
  const suma = criterios.reduce((s, c) => s + c.peso, 0);
  if (Math.abs(suma - PESO_TOTAL) > TOLERANCIA) {
    throw new RubricaInvalidaError(
      `Los pesos de la rubrica suman ${suma} y deben sumar ${PESO_TOTAL}.`,
    );
  }
  const nombres = criterios.map((c) => c.nombre.trim().toLowerCase());
  if (new Set(nombres).size !== nombres.length) {
    throw new RubricaInvalidaError('Hay criterios con el mismo nombre en la rubrica.');
  }
}
