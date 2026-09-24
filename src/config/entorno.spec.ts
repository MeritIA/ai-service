import { describe, expect, it } from 'vitest';
import { validarEntorno } from './entorno.js';

const BASE = {
  NODE_ENV: 'development',
  PORT: '3000',
  CLAVE_DE_ACCESO: 'a'.repeat(64),
  PROVEEDOR_IA: 'simulado',
};

describe('configuracion del servicio de IA', () => {
  it('arranca con el simulado en desarrollo', () => {
    expect(validarEntorno(BASE).PORT).toBe(3000);
  });

  it('gemini exige su API key', () => {
    expect(() => validarEntorno({ ...BASE, PROVEEDOR_IA: 'gemini' })).toThrow(/GEMINI_API_KEY/);
    expect(() =>
      validarEntorno({ ...BASE, PROVEEDOR_IA: 'gemini', GEMINI_API_KEY: 'AIza-prueba' }),
    ).not.toThrow();
  });

  it('prohibe el simulado en produccion', () => {
    expect(() => validarEntorno({ ...BASE, NODE_ENV: 'production' })).toThrow(/simulado/);
  });

  it('rechaza una clave de acceso corta', () => {
    expect(() => validarEntorno({ ...BASE, CLAVE_DE_ACCESO: 'corta' })).toThrow(/CLAVE_DE_ACCESO/);
  });

  it('rechaza un proveedor desconocido y un tiempo maximo absurdo', () => {
    expect(() => validarEntorno({ ...BASE, PROVEEDOR_IA: 'otro' })).toThrow(/PROVEEDOR_IA/);
    expect(() => validarEntorno({ ...BASE, TIEMPO_MAXIMO_MS: '5' })).toThrow(/TIEMPO_MAXIMO_MS/);
  });
});
