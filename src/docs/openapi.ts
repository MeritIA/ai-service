import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';

/** Contrato del servicio, generado desde el codigo. */
export function construirDocumentoOpenApi(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('MeritIA - Servicio de evaluacion con IA')
    .setDescription(
      'Contrato entre el modulo de evaluacion del backend y el servicio de IA (paquete 4.4 de la EDT). ' +
        'Solo el backend lo invoca, con la clave de acceso compartida.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        description: 'CLAVE_DE_ACCESO compartida con el backend.',
      },
      'clave-de-acceso',
    )
    .build();
  return SwaggerModule.createDocument(app, config);
}
