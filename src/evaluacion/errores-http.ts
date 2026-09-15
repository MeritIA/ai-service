import {
  BadGatewayException,
  BadRequestException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CODIGOS } from '../errores/respuesta-error.js';
import {
  ProveedorNoDisponibleError,
  ProveedorRechazoLaSolicitudError,
} from './dominio/proveedor-de-modelo.js';
import { RubricaInvalidaError } from './dominio/rubrica.js';
import { SalidaInvalidaError } from './dominio/validar-respuesta.js';

/**
 * Traduce los errores del dominio a HTTP, con `reintentable` explicito.
 *
 * | Error                       | HTTP | Reintentable |
 * |-----------------------------|------|--------------|
 * | Rubrica invalida            | 400  | no           |
 * | Proveedor rechazo           | 422  | no           |
 * | Salida del modelo invalida  | 502  | si           |
 * | Proveedor no disponible     | 503  | si           |
 *
 * Un error que no es del dominio se devuelve tal cual y el filtro global lo
 * convierte en un 500 generico.
 */
export function aExcepcionHttp(e: unknown): unknown {
  if (e instanceof RubricaInvalidaError) {
    return new BadRequestException({
      codigo: CODIGOS.RUBRICA_INVALIDA,
      message: e.message,
      reintentable: false,
    });
  }
  if (e instanceof ProveedorRechazoLaSolicitudError) {
    return new UnprocessableEntityException({
      codigo: CODIGOS.SOLICITUD_RECHAZADA_POR_PROVEEDOR,
      message: 'El proveedor de modelo rechazo la solicitud; repetirla no cambiaria el resultado.',
      reintentable: false,
    });
  }
  if (e instanceof SalidaInvalidaError) {
    return new BadGatewayException({
      codigo: CODIGOS.SALIDA_INVALIDA,
      message: `La respuesta del modelo no cumple el contrato (${e.motivo}).`,
      reintentable: true,
    });
  }
  if (e instanceof ProveedorNoDisponibleError) {
    return new ServiceUnavailableException({
      codigo: CODIGOS.PROVEEDOR_NO_DISPONIBLE,
      message: 'El proveedor de modelo no esta disponible. Reintenta mas tarde.',
      reintentable: true,
    });
  }
  return e;
}
