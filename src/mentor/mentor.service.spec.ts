import { describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { MentorService } from './mentor.service.js';
import { MAX_TOKENS_DE_SALIDA } from './dominio/contrato.js';
import type { ProveedorDeModelo } from '../evaluacion/dominio/proveedor-de-modelo.js';
import { SalidaInvalidaError } from '../evaluacion/dominio/validar-respuesta.js';

const config = { get: () => undefined } as unknown as ConfigService;
const solicitud = {
  contexto: { totalEvaluaciones: 1, promedio: 50, perfil: [], recientes: [] },
  historial: [],
  pregunta: 'Que mejoro primero?',
};

function proveedor(salida: string) {
  const generarJson = vi.fn<ProveedorDeModelo['generarJson']>().mockResolvedValue(salida);
  const p: ProveedorDeModelo = { nombre: 'doble', modelo: 'm', generarJson };
  return { p, generarJson };
}

describe('MentorService', () => {
  it('limita la salida y devuelve la respuesta validada', async () => {
    const { p, generarJson } = proveedor(
      JSON.stringify({
        respuesta: ' Empieza por la claridad. ',
        sugerencias: ['uno', '', 2, 'dos', 'tres', 'cuatro'],
      }),
    );
    const r = await new MentorService(p, config).responder(solicitud);
    expect(r.respuesta).toBe('Empieza por la claridad.');
    expect(r.sugerencias).toEqual(['uno', 'dos', 'tres']);
    expect(generarJson.mock.calls[0][0].maxTokensDeSalida).toBe(MAX_TOKENS_DE_SALIDA);
  });

  it('rechaza una salida que no es JSON o no trae respuesta', async () => {
    await expect(
      new MentorService(proveedor('hola').p, config).responder(solicitud),
    ).rejects.toBeInstanceOf(SalidaInvalidaError);
    await expect(
      new MentorService(proveedor('{"respuesta":""}').p, config).responder(solicitud),
    ).rejects.toBeInstanceOf(SalidaInvalidaError);
  });
});
