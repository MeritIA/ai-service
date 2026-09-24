import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import {
  TodasLasExcepcionesFilter,
  construirRespuestaError,
  esErrorDelParser,
  registrarError,
} from './errores/todas-las-excepciones.filter.js';

/** Suficiente para una entrega de texto con varios archivos; mas, se rechaza con 413. */
export const LIMITE_DEL_CUERPO = '2mb';

/**
 * Configuracion comun de main.ts, de las pruebas e2e y de la exportacion de
 * OpenAPI.
 *
 * Vive en un solo sitio para que las pruebas verifiquen la aplicacion que se
 * despliega y no una parecida: el caso tipico es olvidar el ValidationPipe en
 * las pruebas y creer que la validacion funciona.
 */
export function configurarAplicacion(app: NestExpressApplication): void {
  const logger = new Logger('Excepciones');

  app.disable('x-powered-by');
  app.useBodyParser('json', { limit: LIMITE_DEL_CUERPO });

  // Justo detras del parser, y no al final: Nest convierte el SyntaxError del
  // parser en un 400 generico con el mensaje interno del parser antes de llegar
  // a los filtros (ExpressAdapter.mapException), y registra sus manejadores de
  // error al iniciar, por delante de cualquier cosa que se anada despues.
  // Aqui se responde en el formato comun y con el codigo propio.
  app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    if (!esErrorDelParser(error)) {
      next(error);
      return;
    }
    const cuerpo = construirRespuestaError(error, req.url);
    registrarError(logger, error, cuerpo, req.method);
    res.status(cuerpo.estado).json(cuerpo);
  });

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  // Tambien cubre la ruta inexistente: Nest la convierte en NotFoundException.
  app.useGlobalFilters(new TodasLasExcepcionesFilter());
}
