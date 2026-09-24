import type { CalificacionDeCriterio } from './contrato.js';

type Calificacion = Pick<CalificacionDeCriterio, 'puntaje' | 'escalaMaxima' | 'peso'>;

/**
 * Nota final: suma ponderada de cada criterio normalizado a su escala.
 *
 * Con pesos que suman 100, va de 0 a 100. La calcula el servicio y no el
 * modelo: un modelo de lenguaje no suma de forma fiable, y la nota es
 * justamente lo que un candidato puede disputar.
 */
export function calcularNotaFinal(calificaciones: readonly Calificacion[]): number {
  const total = calificaciones.reduce((s, c) => s + (c.peso * c.puntaje) / c.escalaMaxima, 0);
  // La tolerancia de los pesos (0,01) podria dejarla un pelo por encima de 100.
  return Math.min(100, Math.round(total * 100) / 100);
}
