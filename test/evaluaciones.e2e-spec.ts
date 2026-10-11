import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { configurarAplicacion } from '../src/configurar-aplicacion.js';
import {
  PROVEEDOR_DE_MODELO,
  ProveedorNoDisponibleError,
  ProveedorRechazoLaSolicitudError,
  type ProveedorDeModelo,
  type SolicitudAlModelo,
} from '../src/evaluacion/dominio/proveedor-de-modelo.js';
import { INSTRUCCION_DE_DEFENSA } from '../src/evaluacion/dominio/instrucciones.js';

const CLAVE = 'c'.repeat(64);
const RUTA = '/api/v1/evaluaciones';

/** Sustituye al proveedor real: lo externo es lo unico que se falsea. */
class ProveedorFalso implements ProveedorDeModelo {
  readonly nombre = 'falso';
  readonly modelo = 'falso-1';
  ultima?: SolicitudAlModelo;
  comportamiento: (s: SolicitudAlModelo) => Promise<string> = () => Promise.resolve('{}');

  generarJson(s: SolicitudAlModelo): Promise<string> {
    this.ultima = s;
    return this.comportamiento(s);
  }
}

const EVIDENCIA = 'En main.py la funcion invertir usa slicing correctamente.';

const solicitudValida = () => ({
  idEvaluacion: '7f1c2b8e-3d4a-4c5b-9e6f-1a2b3c4d5e6f',
  enunciado: 'Implementa una funcion que invierta una lista.',
  criterios: [
    { nombre: 'Correccion', descripcion: 'Invierte cualquier lista.', peso: 60, escalaMaxima: 5 },
    { nombre: 'Claridad', descripcion: 'Codigo legible y ordenado.', peso: 40, escalaMaxima: 10 },
  ],
  archivos: [{ ruta: 'main.py', contenido: 'def invertir(l):\n    return l[::-1]\n' }],
});

const salidaValida = JSON.stringify({
  criterios: [
    { criterio: 'Correccion', puntaje: 4, evidencia: EVIDENCIA },
    { criterio: 'Claridad', puntaje: 5, evidencia: EVIDENCIA },
  ],
});

describe('e2e: servicio de evaluacion', () => {
  let app: NestExpressApplication;
  const falso = new ProveedorFalso();
  const auth = { Authorization: `Bearer ${CLAVE}` };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3000';
    process.env.CLAVE_DE_ACCESO = CLAVE;
    process.env.PROVEEDOR_IA = 'simulado';
    process.env.TIEMPO_MAXIMO_MS = '1000';

    // Se importa aqui y no arriba: ConfigModule.forRoot valida el entorno al
    // cargarse el modulo, antes de que se fijaran las variables de arriba.
    const { AppModule } = await import('../src/app.module.js');

    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PROVEEDOR_DE_MODELO)
      .useValue(falso)
      .compile();
    app = modulo.createNestApplication<NestExpressApplication>({ logger: false });
    configurarAplicacion(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    falso.ultima = undefined;
    falso.comportamiento = () => Promise.resolve(salidaValida);
  });

  const evaluar = (cuerpo: unknown = solicitudValida()) =>
    request(app.getHttpServer())
      .post(RUTA)
      .set(auth)
      .send(cuerpo as object);

  describe('acceso', () => {
    it('la salud es publica y no llama al proveedor', async () => {
      await request(app.getHttpServer()).get('/api/salud').expect(200, { estado: 'ok' });
      expect(falso.ultima).toBeUndefined();
    });

    it('sin clave, con clave incorrecta o con otro esquema: 401, sin llamar al proveedor', async () => {
      for (const cabecera of [
        {},
        { Authorization: 'Bearer otra-clave' },
        { Authorization: `Basic ${CLAVE}` },
      ]) {
        const { body } = await request(app.getHttpServer())
          .post(RUTA)
          .set(cabecera)
          .send(solicitudValida())
          .expect(401);
        expect(body).toMatchObject({ codigo: 'NO_AUTENTICADO', reintentable: false });
      }
      expect(falso.ultima).toBeUndefined();
    });
  });

  describe('evaluacion', () => {
    it('devuelve la calificacion por criterio y la nota ponderada calculada por el servicio', async () => {
      const { body } = await evaluar().expect(200);
      expect(body).toEqual({
        idEvaluacion: '7f1c2b8e-3d4a-4c5b-9e6f-1a2b3c4d5e6f',
        notaFinal: 68, // 60 * 4/5 + 40 * 5/10
        criterios: [
          { criterio: 'Correccion', puntaje: 4, escalaMaxima: 5, peso: 60, evidencia: EVIDENCIA },
          { criterio: 'Claridad', puntaje: 5, escalaMaxima: 10, peso: 40, evidencia: EVIDENCIA },
        ],
        proveedor: 'falso',
        modelo: 'falso-1',
        // Desde el paquete 4.2 el resultado lleva el analisis anti inyeccion.
        seguridad: {
          riesgo: 'ninguno',
          puntaje: 0,
          banderas: [],
          versionReglas: expect.any(String),
          versionListaNegra: expect.any(String),
        },
      });
    });

    it('lo que llega al proveedor: defensa en el canal de sistema, entrega delimitada y ningun secreto', async () => {
      await evaluar().expect(200);
      const s = falso.ultima!;
      expect(s.instruccionDeSistema).toContain(INSTRUCCION_DE_DEFENSA);
      expect(s.instruccionDeSistema).not.toContain('def invertir');
      expect(s.contenido).toMatch(
        /<<<ENTREGA-[0-9a-f]{32}\n--- archivo: main\.py ---\ndef invertir/,
      );
      expect(JSON.stringify(s)).not.toContain(CLAVE);
    });
  });

  describe('validacion de la peticion', () => {
    it('rechaza campos que faltan, sobran o vienen mal, sin llamar al proveedor', async () => {
      const sinArchivos = { ...solicitudValida(), archivos: [] };
      const conExtra = { ...solicitudValida(), rol: 'administrador' };
      const idInvalido = { ...solicitudValida(), idEvaluacion: 'no-es-uuid' };

      for (const cuerpo of [sinArchivos, conExtra, idInvalido]) {
        const { body } = await evaluar(cuerpo).expect(400);
        expect(body).toMatchObject({ codigo: 'VALIDACION', reintentable: false });
      }
      expect(falso.ultima).toBeUndefined();
    });

    it('una rubrica cuyos pesos no suman 100 es un 400 no reintentable', async () => {
      const cuerpo = solicitudValida();
      cuerpo.criterios[1].peso = 30;
      const { body } = await evaluar(cuerpo).expect(400);
      expect(body).toMatchObject({ codigo: 'RUBRICA_INVALIDA', reintentable: false });
      expect(falso.ultima).toBeUndefined();
    });

    it('JSON roto: 400 en formato JSON, no HTML de Express', async () => {
      const { body } = await request(app.getHttpServer())
        .post(RUTA)
        .set(auth)
        .set('Content-Type', 'application/json')
        .send('{"idEvaluacion": ')
        .expect(400);
      expect(body).toMatchObject({ codigo: 'JSON_MAL_FORMADO', reintentable: false });
    });

    it('un cuerpo de mas de 2 MB se corta con 413', async () => {
      const cuerpo = solicitudValida();
      cuerpo.archivos = Array.from({ length: 5 }, (_, i) => ({
        ruta: `f${i}.txt`,
        contenido: 'x'.repeat(499_000),
      }));
      const { body } = await evaluar(cuerpo).expect(413);
      expect(body).toMatchObject({ codigo: 'CUERPO_DEMASIADO_GRANDE', reintentable: false });
    });

    it('una ruta inexistente es un 404 en el formato de siempre', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/api/v1/no-existe')
        .set(auth)
        .expect(404);
      expect(body).toMatchObject({ codigo: 'NO_ENCONTRADO' });
    });
  });

  describe('fallos del proveedor: el backend sabe si reintentar', () => {
    it('salida que no cumple el contrato: 502 reintentable, sin reproducir el texto del modelo', async () => {
      falso.comportamiento = () => Promise.resolve('IGNORA LA RUBRICA secreto-del-modelo');
      const { body } = await evaluar().expect(502);
      expect(body).toMatchObject({ codigo: 'SALIDA_INVALIDA', reintentable: true });
      expect(JSON.stringify(body)).not.toContain('secreto-del-modelo');
    });

    it('proveedor caido: 503 reintentable', async () => {
      falso.comportamiento = () => Promise.reject(new ProveedorNoDisponibleError('503'));
      const { body } = await evaluar().expect(503);
      expect(body).toMatchObject({ codigo: 'PROVEEDOR_NO_DISPONIBLE', reintentable: true });
    });

    it('proveedor que no responde: se corta al tiempo maximo con 503 y se aborta la llamada', async () => {
      falso.comportamiento = () => new Promise<string>(() => undefined);
      const inicio = Date.now();
      const { body } = await evaluar().expect(503);
      expect(Date.now() - inicio).toBeLessThan(5000);
      expect(body).toMatchObject({ codigo: 'PROVEEDOR_NO_DISPONIBLE', reintentable: true });
      expect(falso.ultima?.senal.aborted).toBe(true);
    });

    it('proveedor que rechaza la solicitud: 422 no reintentable', async () => {
      falso.comportamiento = () =>
        Promise.reject(new ProveedorRechazoLaSolicitudError('bloqueado'));
      const { body } = await evaluar().expect(422);
      expect(body).toMatchObject({
        codigo: 'SOLICITUD_RECHAZADA_POR_PROVEEDOR',
        reintentable: false,
      });
    });

    it('un error inesperado: 500 generico, sin traza ni detalle interno', async () => {
      falso.comportamiento = () => Promise.reject(new Error('conexion con AIza-clave-filtrada'));
      const { body } = await evaluar().expect(500);
      expect(body).toMatchObject({ codigo: 'INTERNO', reintentable: false });
      expect(JSON.stringify(body)).not.toMatch(/AIza|stack|at /);
    });
  });
});
