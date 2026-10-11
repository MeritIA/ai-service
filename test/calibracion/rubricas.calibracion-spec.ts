import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configurarAplicacion } from '../../src/configurar-aplicacion.js';
import { LONGITUD_MINIMA_EVIDENCIA } from '../../src/evaluacion/dominio/validar-respuesta.js';
import { ENTREGAS, ENUNCIADO, RUBRICA } from './entregas-de-referencia.js';

/**
 * Calibracion de la calificacion por rubricas (paquete 4.3) CONTRA EL MODELO
 * REAL.
 *
 * No corre con el resto de la suite: el `include` del vitest.config.ts solo
 * toma `*.e2e-spec.ts`, y esta tiene otro sufijo a proposito. Se ejecuta a
 * mano, porque gasta cuota del proveedor y porque su resultado no es
 * determinista:
 *
 *     CALIBRACION=1 npm run test:calibracion
 *
 * Sin CALIBRACION=1 y sin GEMINI_API_KEY se salta entera. Una prueba que
 * depende de un servicio de pago no puede estar en la integracion continua:
 * convertiria cada push en gasto y cada hipo del proveedor en un pipeline
 * rojo.
 *
 * Lo que se afirma aqui, y lo que no, esta explicado en
 * entregas-de-referencia.ts.
 */

const CLAVE = 'c'.repeat(64);
const RUTA = '/api/v1/evaluaciones';

const habilitada = process.env.CALIBRACION === '1' && Boolean(process.env.GEMINI_API_KEY);

interface CriterioCalificado {
  criterio: string;
  puntaje: number;
  escalaMaxima: number;
  peso: number;
  evidencia: string;
}

interface Resultado {
  notaFinal: number;
  criterios: CriterioCalificado[];
  modelo: string;
  proveedor: string;
}

/** Porcentaje logrado en un criterio, que es lo comparable entre escalas. */
const logrado = (c: CriterioCalificado): number => (c.puntaje / c.escalaMaxima) * 100;

/**
 * Estados con los que el proveedor dice "ahora no", no "tu entrega es mala".
 *
 * Gemini devuelve 503 cuando el modelo esta saturado y 429 cuando se pasa la
 * cuota; el backend los reintenta y aqui tambien hay que hacerlo. Sin esto,
 * una saturacion de dos minutos se lee como "la calibracion fallo", que es
 * justo el malentendido que hace que una suite deje de mirarse.
 */
const ESTADOS_DEL_PROVEEDOR = [429, 503];
const INTENTOS = 3;

describe.skipIf(!habilitada)('calibracion: calificacion por rubricas contra el modelo real', () => {
  let app: NestExpressApplication;
  const notas = new Map<string, Resultado>();

  async function evaluarConReintentos(
    clave: string,
    archivos: readonly { ruta: string; contenido: string }[],
  ): Promise<Resultado> {
    let ultimoEstado = 0;
    for (let intento = 1; intento <= INTENTOS; intento++) {
      const respuesta = await request(app.getHttpServer())
        .post(RUTA)
        .set({ Authorization: `Bearer ${CLAVE}` })
        .send({
          idEvaluacion: crypto.randomUUID(),
          enunciado: ENUNCIADO,
          criterios: RUBRICA,
          archivos,
        });

      if (respuesta.status === 200) return respuesta.body as Resultado;
      ultimoEstado = respuesta.status;

      if (!ESTADOS_DEL_PROVEEDOR.includes(respuesta.status)) {
        throw new Error(
          `La entrega "${clave}" recibio ${respuesta.status}, que no es del proveedor: ` +
            'eso es un fallo del servicio y no una saturacion. Revisa el log.',
        );
      }
      // Espera creciente: 2 s, 6 s.
      if (intento < INTENTOS) await new Promise((r) => setTimeout(r, intento * 4000 - 2000));
    }

    throw new Error(
      `El proveedor respondio ${ultimoEstado} en los ${INTENTOS} intentos de la entrega ` +
        `"${clave}". NO es un fallo de la calificacion: el modelo esta saturado o se ` +
        'agoto la cuota. Vuelve a correr la calibracion mas tarde.',
    );
  }

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3000';
    process.env.CLAVE_DE_ACCESO = CLAVE;
    process.env.PROVEEDOR_IA = 'gemini';
    process.env.TIEMPO_MAXIMO_MS = process.env.TIEMPO_MAXIMO_MS ?? '120000';

    const { AppModule } = await import('../../src/app.module.js');
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modulo.createNestApplication<NestExpressApplication>({ logger: false });
    configurarAplicacion(app);
    await app.init();

    // En serie y no en paralelo: cinco peticiones simultaneas al proveedor son
    // la forma mas rapida de que una devuelva 429 y la calibracion falle por
    // la cuota en vez de por la calificacion.
    for (const entrega of ENTREGAS) {
      notas.set(entrega.clave, await evaluarConReintentos(entrega.clave, entrega.archivos));
    }

    // La tabla es el entregable para un humano: con esto se revisan las bandas.
    const filas = ENTREGAS.map((e) => {
      const r = notas.get(e.clave)!;
      const porCriterio = r.criterios.map((c) => `${c.criterio}: ${c.puntaje}/${c.escalaMaxima}`);
      return `  ${e.clave.padEnd(20)} ${String(r.notaFinal).padStart(6)}   ${porCriterio.join('  |  ')}`;
    });
    const modelo = notas.get(ENTREGAS[0].clave)!;
    console.log(
      `\nCalibracion con ${modelo.proveedor}/${modelo.modelo}\n` +
        `  ${'entrega'.padEnd(20)} ${'nota'.padStart(6)}   desglose\n` +
        filas.join('\n') +
        '\n',
    );
  }, 600_000);

  afterAll(async () => {
    await app?.close();
  });

  describe('CRITERIO: toda calificacion trae desglose y evidencia trazable a la rubrica', () => {
    it.each(ENTREGAS.map((e) => e.clave))(
      'la respuesta de "%s" califica exactamente los criterios de la rubrica, en orden',
      (clave) => {
        const r = notas.get(clave)!;
        expect(r.criterios.map((c) => c.criterio)).toEqual(RUBRICA.map((c) => c.nombre));
      },
    );

    it.each(ENTREGAS.map((e) => e.clave))('cada criterio de "%s" trae evidencia', (clave) => {
      for (const c of notas.get(clave)!.criterios) {
        expect(c.evidencia.trim().length).toBeGreaterThanOrEqual(LONGITUD_MINIMA_EVIDENCIA);
      }
    });

    it.each(ENTREGAS.map((e) => e.clave))(
      'el puntaje de cada criterio de "%s" cae dentro de su escala',
      (clave) => {
        for (const c of notas.get(clave)!.criterios) {
          const deLaRubrica = RUBRICA.find((r) => r.nombre === c.criterio)!;
          expect(c.escalaMaxima).toBe(deLaRubrica.escalaMaxima);
          expect(c.peso).toBe(deLaRubrica.peso);
          expect(c.puntaje).toBeGreaterThanOrEqual(0);
          expect(c.puntaje).toBeLessThanOrEqual(deLaRubrica.escalaMaxima);
        }
      },
    );
  });

  describe('CRITERIO: el puntaje total es la suma ponderada de los criterios', () => {
    it.each(ENTREGAS.map((e) => e.clave))(
      'la nota de "%s" se reproduce sumando sus criterios a mano',
      (clave) => {
        const r = notas.get(clave)!;
        // Se recalcula aqui, sin usar la funcion del servicio: si la nota
        // saliera de otra parte —por ejemplo del propio modelo— esto lo
        // delataria.
        const esperada = r.criterios.reduce((s, c) => s + (c.peso * c.puntaje) / c.escalaMaxima, 0);
        expect(r.notaFinal).toBeCloseTo(Math.min(100, esperada), 1);
      },
    );
  });

  describe('las bandas: una nota tiene que significar algo', () => {
    it.each(ENTREGAS.map((e) => [e.clave, e.banda.min, e.banda.max] as const))(
      '"%s" cae entre %i y %i',
      (clave, min, max) => {
        const nota = notas.get(clave)!.notaFinal;
        expect(nota).toBeGreaterThanOrEqual(min);
        expect(nota).toBeLessThanOrEqual(max);
      },
    );
  });

  describe('el orden entre entregas, que es lo que usa un reclutador', () => {
    it('la correcta queda por encima de la que incumple el enunciado', () => {
      expect(notas.get('correcta')!.notaFinal).toBeGreaterThan(notas.get('mutante')!.notaFinal);
    });

    it('la correcta queda por encima de la que falla con la lista vacia', () => {
      expect(notas.get('correcta')!.notaFinal).toBeGreaterThan(
        notas.get('falla_en_vacia')!.notaFinal,
      );
    });

    it('la entrega que no viene al caso es la mas baja de todas', () => {
      const irrelevante = notas.get('irrelevante')!.notaFinal;
      for (const e of ENTREGAS) {
        if (e.clave === 'irrelevante') continue;
        expect(irrelevante).toBeLessThan(notas.get(e.clave)!.notaFinal);
      }
    });
  });

  describe('el desglose discrimina, no es decorativo', () => {
    it('la entrega correcta pero ilegible saca mas en correccion que en claridad', () => {
      // Si el modelo pusiera el mismo puntaje a los dos criterios, el desglose
      // no estaria diciendo nada y la rubrica seria un adorno.
      const [correccion, claridad] = notas.get('correcta_ilegible')!.criterios;
      expect(logrado(correccion)).toBeGreaterThan(logrado(claridad));
    });

    it('la evidencia de la entrega que no viene al caso lo dice', () => {
      // No se exige una palabra concreta: se exige que la evidencia hable de
      // ESA entrega y no sea una frase generica reutilizable.
      const evidencias = notas
        .get('irrelevante')!
        .criterios.map((c) => c.evidencia.toLowerCase())
        .join(' ');
      expect(evidencias).toMatch(/saludar|hola|main\.py|nada que ver|no implementa|no resuelve/);
    });
  });
});
