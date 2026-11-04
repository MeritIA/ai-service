import { describe, expect, it } from 'vitest';
import {
  compactarContexto,
  condensar,
  contenidoParaElMentor,
  recortarHistorial,
} from './instrucciones.js';
import type { ContextoDelCandidato } from './contrato.js';

const contexto: ContextoDelCandidato = {
  totalEvaluaciones: 3,
  promedio: 71,
  perfil: [
    { nombre: 'Correccion', porcentaje: 82, veces: 3 },
    { nombre: 'Claridad', porcentaje: 55, veces: 3 },
  ],
  recientes: [
    {
      reto: 'API de pagos',
      nota: 68,
      flojo: {
        criterio: 'Claridad',
        porcentaje: 40,
        evidencia: 'Funciones de 80 lineas sin nombres claros.',
      },
    },
  ],
};

describe('compactarContexto', () => {
  it('es texto plano, sin JSON', () => {
    const texto = compactarContexto(contexto);
    expect(texto).toContain('Evaluaciones: 3 | promedio: 71/100');
    expect(texto).toContain('Claridad 55%(3)');
    expect(texto).not.toMatch(/[{}]/);
  });

  it('recorta la evidencia', () => {
    const largo = {
      ...contexto,
      recientes: [
        {
          reto: 'X',
          nota: 1,
          flojo: { criterio: 'C', porcentaje: 1, evidencia: 'a'.repeat(5000) },
        },
      ],
    };
    expect(compactarContexto(largo).length).toBeLessThan(400);
  });
});

describe('recortarHistorial', () => {
  it('conserva solo los ultimos turnos, recortados', () => {
    const turnos = Array.from({ length: 20 }, (_, i) => ({
      rol: 'candidato' as const,
      texto: `${i} ${'x'.repeat(2000)}`,
    }));
    const r = recortarHistorial(turnos);
    expect(r).toHaveLength(6);
    expect(r[0].texto.startsWith('14 ')).toBe(true);
    expect(r.every((t) => t.texto.length <= 400)).toBe(true);
  });
});

describe('condensar', () => {
  it('quita saltos, espacios repetidos y caracteres invisibles', () => {
    expect(condensar('a \n\n  b​c', 50)).toBe('a b c');
  });
});

describe('contenidoParaElMentor', () => {
  it('encierra la pregunta en el delimitador', () => {
    const c = contenidoParaElMentor(contexto, [], 'como mejoro?', '<<abc>>');
    expect(c).toContain('<<abc>>\ncomo mejoro?\n<<abc>>');
    expect(c).not.toContain('CONVERSACION');
  });
});
