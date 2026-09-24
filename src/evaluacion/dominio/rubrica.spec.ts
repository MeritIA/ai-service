import { describe, expect, it } from 'vitest';
import { RubricaInvalidaError, validarRubrica } from './rubrica.js';

const criterio = (nombre: string, peso: number) => ({
  nombre,
  descripcion: 'Descripcion del criterio.',
  peso,
  escalaMaxima: 5,
});

describe('validacion de la rubrica recibida', () => {
  it('acepta pesos que suman 100, con la tolerancia de los decimales', () => {
    expect(() =>
      validarRubrica([criterio('a', 33.33), criterio('b', 33.33), criterio('c', 33.34)]),
    ).not.toThrow();
  });

  it('rechaza pesos que no suman 100', () => {
    expect(() => validarRubrica([criterio('a', 50), criterio('b', 40)])).toThrow(
      RubricaInvalidaError,
    );
  });

  it('rechaza nombres repetidos aunque cambien mayusculas o espacios', () => {
    expect(() => validarRubrica([criterio('Claridad', 50), criterio(' claridad ', 50)])).toThrow(
      RubricaInvalidaError,
    );
  });
});
