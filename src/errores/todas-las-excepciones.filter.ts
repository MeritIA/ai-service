import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CODIGOS, type DetalleValidacion, type RespuestaError } from './respuesta-error.js';

/**
 * Filtro global: al cliente se le dice que paso, al log por que.
 *
 * Ningun error devuelve traza, ni mensajes del proveedor de modelo: pueden
 * llevar fragmentos de la peticion o datos de la cuenta.
 */
@Catch()
export class TodasLasExcepcionesFilter implements ExceptionFilter {
  private readonly logger = new Logger('Excepciones');

  catch(excepcion: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const respuesta = ctx.getResponse<{ status: (c: number) => { json: (b: unknown) => void } }>();
    const peticion = ctx.getRequest<{ url?: string; method?: string }>();

    const cuerpo = construirRespuestaError(excepcion, peticion?.url ?? '');
    registrarError(this.logger, excepcion, cuerpo, peticion?.method ?? '');
    respuesta.status(cuerpo.estado).json(cuerpo);
  }
}

interface Interpretacion {
  estado: number;
  codigo: string;
  mensaje: string;
  reintentable: boolean;
  errores?: readonly DetalleValidacion[];
}

export function construirRespuestaError(excepcion: unknown, ruta: string): RespuestaError {
  const i = interpretar(excepcion);
  return {
    estado: i.estado,
    codigo: i.codigo,
    mensaje: i.mensaje,
    reintentable: i.reintentable,
    momento: new Date().toISOString(),
    ruta,
    referencia: randomUUID(),
    ...(i.errores ? { errores: i.errores } : {}),
  };
}

function interpretar(excepcion: unknown): Interpretacion {
  if (excepcion instanceof HttpException) {
    const estado = excepcion.getStatus();
    const r = excepcion.getResponse();

    if (typeof r === 'object' && r !== null) {
      const o = r as { message?: unknown; codigo?: unknown; reintentable?: unknown };
      if (estado === 400 && Array.isArray(o.message)) {
        return {
          estado,
          codigo: CODIGOS.VALIDACION,
          mensaje: 'La peticion tiene campos invalidos. Revisa el detalle.',
          reintentable: false,
          errores: agruparPorCampo(o.message.filter((m): m is string => typeof m === 'string')),
        };
      }
      return {
        estado,
        codigo: typeof o.codigo === 'string' ? o.codigo : codigoPorEstado(estado),
        mensaje: typeof o.message === 'string' ? o.message : excepcion.message,
        reintentable: typeof o.reintentable === 'boolean' ? o.reintentable : estado === 503,
      };
    }
    return {
      estado,
      codigo: codigoPorEstado(estado),
      mensaje: typeof r === 'string' ? r : excepcion.message,
      reintentable: estado === 503,
    };
  }

  // Errores del parser de JSON de Express: llegan antes de cualquier controlador.
  if (esErrorDelParser(excepcion)) {
    if (excepcion.type === 'entity.too.large') {
      return {
        estado: 413,
        codigo: CODIGOS.CUERPO_DEMASIADO_GRANDE,
        mensaje: 'La peticion supera el tamano maximo admitido.',
        reintentable: false,
      };
    }
    return {
      estado: 400,
      codigo: CODIGOS.JSON_MAL_FORMADO,
      mensaje: 'El cuerpo de la peticion no es JSON valido.',
      reintentable: false,
    };
  }

  return {
    estado: 500,
    codigo: CODIGOS.INTERNO,
    mensaje: 'Ha ocurrido un error interno. Si persiste, reporta la referencia de este mensaje.',
    reintentable: false,
  };
}

/** Error del parser de JSON de Express: cuerpo enorme o JSON roto. */
export function esErrorDelParser(e: unknown): e is { type: string; status: number } {
  if (typeof e !== 'object' || e === null) return false;
  const { type, status } = e as { type?: unknown; status?: unknown };
  return typeof type === 'string' && type.startsWith('entity.') && typeof status === 'number';
}

function codigoPorEstado(estado: number): string {
  if (estado === 401) return CODIGOS.NO_AUTENTICADO;
  if (estado === 404) return CODIGOS.NO_ENCONTRADO;
  if (estado === 413) return CODIGOS.CUERPO_DEMASIADO_GRANDE;
  if (estado === 503) return CODIGOS.PROVEEDOR_NO_DISPONIBLE;
  return estado >= 500 ? CODIGOS.INTERNO : CODIGOS.PETICION_INVALIDA;
}

function agruparPorCampo(mensajes: string[]): DetalleValidacion[] {
  const porCampo = new Map<string, string[]>();
  for (const mensaje of mensajes) {
    const campo = mensaje.split(' ')[0] ?? 'desconocido';
    porCampo.set(campo, [...(porCampo.get(campo) ?? []), mensaje]);
  }
  return [...porCampo].map(([campo, problemas]) => ({ campo, problemas }));
}

/** Registro estructurado. Sin cuerpo de la peticion: lleva la entrega del candidato. */
export function registrarError(
  logger: Logger,
  excepcion: unknown,
  cuerpo: RespuestaError,
  metodo: string,
): void {
  const entrada = JSON.stringify({
    timestamp: cuerpo.momento,
    level: cuerpo.estado < 500 ? 'warn' : 'error',
    eventType: cuerpo.estado < 500 ? 'request_rejected' : 'request_failed',
    referencia: cuerpo.referencia,
    estado: cuerpo.estado,
    codigo: cuerpo.codigo,
    method: metodo,
    path: cuerpo.ruta,
  });
  if (cuerpo.estado < 500) {
    logger.warn(entrada);
    return;
  }
  // La traza solo para lo no previsto; los fallos del proveedor ya vienen tipados.
  const traza =
    cuerpo.codigo === CODIGOS.INTERNO && excepcion instanceof Error ? excepcion.stack : undefined;
  logger.error(entrada, traza);
}
