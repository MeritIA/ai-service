import { plainToInstance, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateIf,
  validateSync,
} from 'class-validator';

export enum Entorno {
  Desarrollo = 'development',
  Pruebas = 'test',
  Produccion = 'production',
}

export enum ProveedorIa {
  Gemini = 'gemini',
  Simulado = 'simulado',
}

/**
 * Variables de entorno del servicio de IA.
 *
 * Deliberadamente NO hay credenciales de base de datos, de almacenamiento de
 * objetos ni claves del backend: el servicio no las necesita, y lo que no tiene
 * no lo puede filtrar. Es la base del criterio del paquete 4.4 "un ataque
 * exitoso contra el servicio de IA no compromete el backend principal".
 */
export class VariablesDeEntorno {
  @IsEnum(Entorno)
  NODE_ENV!: Entorno;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT!: number;

  /** Secreto compartido con el backend, que alli se llama AI_SERVICE_API_KEY. */
  @IsString()
  @MinLength(32, {
    message:
      'CLAVE_DE_ACCESO debe tener al menos 32 caracteres: usa 32 bytes aleatorios en hexadecimal',
  })
  CLAVE_DE_ACCESO!: string;

  @IsEnum(ProveedorIa)
  PROVEEDOR_IA!: ProveedorIa;

  @ValidateIf((v: VariablesDeEntorno) => v.PROVEEDOR_IA === ProveedorIa.Gemini)
  @IsString()
  @IsNotEmpty({ message: 'GEMINI_API_KEY es obligatoria con PROVEEDOR_IA=gemini' })
  GEMINI_API_KEY?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9.-]*$/, {
    message: 'GEMINI_MODELO no parece un identificador de modelo',
  })
  GEMINI_MODELO?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(600_000)
  TIEMPO_MAXIMO_MS?: number;
}

export function validarEntorno(configuracion: Record<string, unknown>): VariablesDeEntorno {
  const validada = plainToInstance(VariablesDeEntorno, configuracion, {
    enableImplicitConversion: true,
  });

  const detalle = validateSync(validada, { skipMissingProperties: false }).map(
    (e) => `  - ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`,
  );

  // Una nota que ningun modelo calculo no puede llegar nunca a un candidato real.
  if (validada.NODE_ENV === Entorno.Produccion && validada.PROVEEDOR_IA === ProveedorIa.Simulado) {
    detalle.push('  - PROVEEDOR_IA: el proveedor simulado no esta permitido en produccion');
  }

  if (detalle.length > 0) {
    throw new Error(
      'Configuracion de entorno invalida. Revisa tu .env (hay una plantilla en .env.example):\n' +
        detalle.join('\n'),
    );
  }
  return validada;
}
