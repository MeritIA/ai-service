import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configurarAplicacion } from './configurar-aplicacion.js';
import { construirDocumentoOpenApi } from './docs/openapi.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableShutdownHooks();
  configurarAplicacion(app);

  // Sin CORS a proposito: solo llama el backend, de servidor a servidor. Ningun
  // navegador tiene nada que hacer aqui.

  if (process.env.NODE_ENV !== 'production') {
    SwaggerModule.setup('api/docs', app, construirDocumentoOpenApi(app));
  }

  await app.init();

  const puerto = Number(process.env.PORT ?? 3000);
  await app.listen(puerto);
  new Logger('Arranque').log(
    `Servicio de IA escuchando en el puerto ${puerto} (proveedor: ${process.env.PROVEEDOR_IA})`,
  );
}

await bootstrap();
