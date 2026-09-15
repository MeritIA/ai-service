import { describe, expect, it } from 'vitest';
import { claveCoincide, claveDeCabecera } from './clave-de-acceso.guard.js';

const CLAVE = 'k'.repeat(64);

describe('clave de acceso', () => {
  it('coincide solo con la clave exacta', () => {
    expect(claveCoincide(CLAVE, CLAVE)).toBe(true);
    expect(claveCoincide(`${CLAVE}x`, CLAVE)).toBe(false);
    expect(claveCoincide(CLAVE.slice(1), CLAVE)).toBe(false);
    expect(claveCoincide('', CLAVE)).toBe(false);
    expect(claveCoincide(undefined, CLAVE)).toBe(false);
  });

  it('se lee solo de "Bearer <clave>"', () => {
    expect(claveDeCabecera(`Bearer ${CLAVE}`)).toBe(CLAVE);
    expect(claveDeCabecera(`bearer   ${CLAVE}`)).toBe(CLAVE);
    expect(claveDeCabecera(`Basic ${CLAVE}`)).toBeUndefined();
    expect(claveDeCabecera(CLAVE)).toBeUndefined();
    expect(claveDeCabecera(`Bearer ${CLAVE} extra`)).toBeUndefined();
    expect(claveDeCabecera(undefined)).toBeUndefined();
    expect(claveDeCabecera(['Bearer a', 'Bearer b'])).toBeUndefined();
  });
});
