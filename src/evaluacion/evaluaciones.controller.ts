import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { EvaluacionService } from './evaluacion.service.js';
import type { ResultadoDeEvaluacion } from './dominio/contrato.js';
import { aExcepcionHttp } from './errores-http.js';
import {
  ErrorDto,
  ResultadoDeEvaluacionDto,
  SolicitudDeEvaluacionDto,
} from './dto/evaluacion.dto.js';

@ApiTags('evaluaciones')
@ApiBearerAuth('clave-de-acceso')
@Controller({ path: 'evaluaciones', version: '1' })
export class EvaluacionesController {
  constructor(private readonly evaluacion: EvaluacionService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Evalua una entrega contra su rubrica',
    description:
      'Sincrono: responde cuando el modelo termina. La asincronia la pone la cola del backend (paquete 4.1), que es quien reintenta segun el campo `reintentable` de los errores.',
  })
  @ApiOkResponse({ type: ResultadoDeEvaluacionDto })
  @ApiBadRequestResponse({
    type: ErrorDto,
    description: 'Peticion o rubrica invalidas. No reintentable.',
  })
  @ApiUnauthorizedResponse({
    type: ErrorDto,
    description: 'Falta la clave de acceso o no es valida.',
  })
  @ApiPayloadTooLargeResponse({ type: ErrorDto, description: 'El cuerpo supera 2 MB.' })
  @ApiUnprocessableEntityResponse({
    type: ErrorDto,
    description:
      'El proveedor rechazo la solicitud (clave, modelo o contenido bloqueado). No reintentable.',
  })
  @ApiBadGatewayResponse({
    type: ErrorDto,
    description: 'La respuesta del modelo no cumple el contrato. Reintentable.',
  })
  @ApiServiceUnavailableResponse({
    type: ErrorDto,
    description: 'Proveedor caido, sobrecargado o sin responder a tiempo. Reintentable.',
  })
  async evaluar(@Body() solicitud: SolicitudDeEvaluacionDto): Promise<ResultadoDeEvaluacion> {
    try {
      return await this.evaluacion.evaluar(solicitud);
    } catch (e) {
      throw aExcepcionHttp(e);
    }
  }
}
