import { describe, expect, it } from 'vitest';
import { calcularNotaFinal } from './nota.js';

describe('nota final ponderada', () => {
  it('pondera cada criterio normalizado a su escala', () => {
    // 60 * 4/5 + 40 * 5/10 = 48 + 20
    expect(
      calcularNotaFinal([
        { peso: 60, puntaje: 4, escalaMaxima: 5 },
        { peso: 40, puntaje: 5, escalaMaxima: 10 },
      ]),
    ).toBe(68);
  });

  it('va de 0 a 100', () => {
    expect(calcularNotaFinal([{ peso: 100, puntaje: 0, escalaMaxima: 5 }])).toBe(0);
    expect(calcularNotaFinal([{ peso: 100, puntaje: 5, escalaMaxima: 5 }])).toBe(100);
  });

  it('redondea a dos decimales', () => {
    expect(
      calcularNotaFinal([
        { peso: 33.33, puntaje: 1, escalaMaxima: 3 },
        { peso: 33.33, puntaje: 1, escalaMaxima: 3 },
        { peso: 33.34, puntaje: 1, escalaMaxima: 3 },
      ]),
    ).toBe(33.33);
  });

  it('no pasa de 100 por la tolerancia de los pesos', () => {
    expect(
      calcularNotaFinal([
        { peso: 50.01, puntaje: 5, escalaMaxima: 5 },
        { peso: 50, puntaje: 5, escalaMaxima: 5 },
      ]),
    ).toBe(100);
  });
});
