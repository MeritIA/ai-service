import {
  Injectable,
  Logger,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';
import { ES_PUBLICO } from './publico.decorator.js';

/**
 * Compara la clave recibida con la esperada en tiempo constante.
 *
 * Se comparan los resumenes SHA-256 y no las cadenas: timingSafeEqual exige la
 * misma longitud, y rechazar antes por longitud distinta filtraria cuanto mide
 * la clave a quien mida los tiempos de respuesta.
 */
export function claveCoincide(recibida: string | undefined, esperada: string): boolean {
  if (!recibida) return false;
  const a = createHash('sha256').update(recibida).digest();
  const b = createHash('sha256').update(esperada).digest();
  return timingSafeEqual(a, b);
}

/** Extrae la clave de `Authorization: Bearer <clave>`, o nada si el formato no es ese. */
export function claveDeCabecera(autorizacion: string | string[] | undefined): string | undefined {
  if (typeof autorizacion !== 'string') return undefined;
  const partes = autorizacion.trim().split(/\s+/);
  if (partes.length !== 2 || partes[0].toLowerCase() !== 'bearer') return undefined;
  return partes[1];
}

/**
 * Solo el backend puede pedir evaluaciones.
 *
 * Es un secreto compartido y no PASETO: aqui no hay usuarios, hay un unico
 * cliente de confianza. La clave vive en la configuracion de los dos servicios
 * y se rota a la vez en ambos.
 */
@Injectable()
export class ClaveDeAccesoGuard implements CanActivate {
  private readonly logger = new Logger('Autenticacion');
  private readonly clave: string;

  constructor(
    private readonly reflector: Reflector,
    config: ConfigService,
  ) {
    this.clave = config.getOrThrow<string>('CLAVE_DE_ACCESO');
  }

  canActivate(contexto: ExecutionContext): boolean {
    const publico = this.reflector.getAllAndOverride<boolean | undefined>(ES_PUBLICO, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (publico) return true;

    const peticion = contexto.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      ip?: string;
      url?: string;
      method?: string;
    }>();

    if (claveCoincide(claveDeCabecera(peticion.headers.authorization), this.clave)) return true;

    // Nunca se registra la clave recibida: podria ser la buena con un error de tecleo.
    this.logger.warn(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'security',
        eventType: 'autenticacion_rechazada',
        ip: peticion.ip ?? '',
        path: peticion.url ?? '',
        method: peticion.method ?? '',
      }),
    );
    throw new UnauthorizedException('Falta la clave de acceso o no es valida.');
  }
}
