import {
  ApiError,
  type GenerateContentParameters,
  type GenerateContentResponse,
} from '@google/genai';
import { describe, expect, it, vi } from 'vitest';
import { ProveedorGemini, traducirError, type ClienteGemini } from './gemini.adaptador.js';
import {
  ProveedorNoDisponibleError,
  ProveedorRechazoLaSolicitudError,
  type SolicitudAlModelo,
} from '../dominio/proveedor-de-modelo.js';

const solicitud = (): SolicitudAlModelo => ({
  instruccionDeSistema: 'Eres un evaluador imparcial.',
  contenido: 'ENTREGA...',
  esquemaDeRespuesta: { type: 'object' },
  senal: new AbortController().signal,
});

function clienteQueDevuelve(respuesta: Partial<GenerateContentResponse>) {
  const generateContent = vi.fn((_p: GenerateContentParameters) =>
    Promise.resolve(respuesta as GenerateContentResponse),
  );
  const cliente: ClienteGemini = { models: { generateContent } };
  return { cliente, generateContent };
}

function clienteQueFalla(error: Error): ClienteGemini {
  return { models: { generateContent: () => Promise.reject(error) } };
}

describe('adaptador de Gemini', () => {
  it('pide JSON con esquema, instruccion de sistema aparte, temperatura 0 y senal de cancelacion', async () => {
    const { cliente, generateContent } = clienteQueDevuelve({ text: '{"criterios":[]}' });
    const s = solicitud();

    const texto = await new ProveedorGemini(cliente, 'gemini-2.5-flash').generarJson(s);

    expect(texto).toBe('{"criterios":[]}');
    expect(generateContent).toHaveBeenCalledWith({
      model: 'gemini-2.5-flash',
      contents: s.contenido,
      config: {
        systemInstruction: s.instruccionDeSistema,
        responseMimeType: 'application/json',
        responseJsonSchema: s.esquemaDeRespuesta,
        temperature: 0,
        abortSignal: s.senal,
      },
    });
  });

  it('una respuesta vacia se devuelve vacia, para que el dominio la rechace', async () => {
    const { cliente } = clienteQueDevuelve({});
    await expect(new ProveedorGemini(cliente, 'm').generarJson(solicitud())).resolves.toBe('');
  });

  it('un bloqueo de la solicitud es un rechazo no reintentable', async () => {
    const { cliente } = clienteQueDevuelve({
      promptFeedback: { blockReason: 'PROHIBITED_CONTENT' },
    } as Partial<GenerateContentResponse>);
    await expect(new ProveedorGemini(cliente, 'm').generarJson(solicitud())).rejects.toBeInstanceOf(
      ProveedorRechazoLaSolicitudError,
    );
  });

  it('una respuesta detenida por sus filtros es un rechazo no reintentable', async () => {
    const { cliente } = clienteQueDevuelve({
      candidates: [{ finishReason: 'SAFETY' }],
    } as Partial<GenerateContentResponse>);
    await expect(new ProveedorGemini(cliente, 'm').generarJson(solicitud())).rejects.toBeInstanceOf(
      ProveedorRechazoLaSolicitudError,
    );
  });

  it('un fin normal no se confunde con un bloqueo', async () => {
    const { cliente } = clienteQueDevuelve({
      text: '{}',
      candidates: [{ finishReason: 'STOP' }],
    } as Partial<GenerateContentResponse>);
    await expect(new ProveedorGemini(cliente, 'm').generarJson(solicitud())).resolves.toBe('{}');
  });

  it.each([429, 500, 503])('HTTP %i es transitorio: reintentable', async (status) => {
    const proveedor = new ProveedorGemini(
      clienteQueFalla(new ApiError({ message: 'detalle', status })),
      'm',
    );
    await expect(proveedor.generarJson(solicitud())).rejects.toBeInstanceOf(
      ProveedorNoDisponibleError,
    );
  });

  it.each([400, 401, 403, 404])('HTTP %i es un rechazo: no reintentable', async (status) => {
    const proveedor = new ProveedorGemini(
      clienteQueFalla(new ApiError({ message: 'detalle', status })),
      'm',
    );
    await expect(proveedor.generarJson(solicitud())).rejects.toBeInstanceOf(
      ProveedorRechazoLaSolicitudError,
    );
  });

  it('un fallo de red o una cancelacion son transitorios', () => {
    expect(traducirError(new TypeError('fetch failed'))).toBeInstanceOf(ProveedorNoDisponibleError);
    const abortado = new Error('aborted');
    abortado.name = 'AbortError';
    expect(traducirError(abortado)).toBeInstanceOf(ProveedorNoDisponibleError);
  });

  it('no propaga el mensaje original del SDK', () => {
    const e = traducirError(
      new ApiError({ message: 'API key AIza-secreta no valida', status: 400 }),
    );
    expect(e.message).not.toContain('AIza-secreta');
  });

  it('un error desconocido se deja pasar tal cual para que acabe como 500', () => {
    const original = new RangeError('otra cosa');
    expect(traducirError(original)).toBe(original);
    expect(traducirError('texto')).toBeInstanceOf(Error);
  });
});
