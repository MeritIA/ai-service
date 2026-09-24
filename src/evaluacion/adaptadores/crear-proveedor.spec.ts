import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { MODELO_GEMINI_POR_OMISION, crearProveedor } from './crear-proveedor.js';
import { ProveedorGemini } from './gemini.adaptador.js';
import { ProveedorSimulado } from './simulado.adaptador.js';
import { validarRespuesta } from '../dominio/validar-respuesta.js';
import { esquemaDeRespuesta } from '../dominio/esquema-de-respuesta.js';

function config(valores: Record<string, string>): ConfigService {
  return {
    get: (clave: string) => valores[clave],
    getOrThrow: (clave: string) => {
      if (!(clave in valores)) throw new Error(`falta ${clave}`);
      return valores[clave];
    },
  } as unknown as ConfigService;
}

describe('seleccion del proveedor por configuracion', () => {
  it('simulado', () => {
    expect(crearProveedor(config({ PROVEEDOR_IA: 'simulado' }))).toBeInstanceOf(ProveedorSimulado);
  });

  it('gemini con el modelo por omision', () => {
    const p = crearProveedor(config({ PROVEEDOR_IA: 'gemini', GEMINI_API_KEY: 'clave' }));
    expect(p).toBeInstanceOf(ProveedorGemini);
    expect(p.modelo).toBe(MODELO_GEMINI_POR_OMISION);
  });

  it('gemini con el modelo configurado', () => {
    const p = crearProveedor(
      config({ PROVEEDOR_IA: 'gemini', GEMINI_API_KEY: 'clave', GEMINI_MODELO: 'gemini-x' }),
    );
    expect(p.modelo).toBe('gemini-x');
  });
});

describe('proveedor simulado', () => {
  it('produce una salida que cumple el contrato, con puntaje 0 y evidencia que lo dice', async () => {
    const criterios = [
      { nombre: 'A', descripcion: 'Descripcion A.', peso: 50, escalaMaxima: 5 },
      { nombre: 'B', descripcion: 'Descripcion B.', peso: 50, escalaMaxima: 10 },
    ];
    const texto = await new ProveedorSimulado().generarJson({
      instruccionDeSistema: '',
      contenido: '',
      esquemaDeRespuesta: esquemaDeRespuesta(criterios),
      senal: new AbortController().signal,
    });
    const r = validarRespuesta(texto, criterios);
    expect(r.map((c) => c.puntaje)).toEqual([0, 0]);
    expect(r[0].evidencia).toMatch(/simulada/);
  });

  it('con un esquema inesperado no inventa criterios', async () => {
    const texto = await new ProveedorSimulado().generarJson({
      instruccionDeSistema: '',
      contenido: '',
      esquemaDeRespuesta: {},
      senal: new AbortController().signal,
    });
    expect(JSON.parse(texto)).toEqual({ criterios: [] });
  });
});
