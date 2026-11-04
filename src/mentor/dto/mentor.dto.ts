import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  MAX_CARACTERES_DE_PREGUNTA,
  MAX_CRITERIOS_EN_PERFIL,
  MAX_RECIENTES,
} from '../dominio/contrato.js';

export class CriterioDelPerfilDto {
  @ApiProperty() @IsString() @Length(1, 120) nombre!: string;
  @ApiProperty({ minimum: 0, maximum: 100 }) @IsNumber() @Min(0) @Max(100) porcentaje!: number;
  @ApiProperty() @IsInt() @Min(1) @Max(10_000) veces!: number;
}

export class FlojoDto {
  @ApiProperty() @IsString() @Length(1, 120) criterio!: string;
  @ApiProperty({ minimum: 0, maximum: 100 }) @IsNumber() @Min(0) @Max(100) porcentaje!: number;
  @ApiProperty() @IsString() @MaxLength(2000) evidencia!: string;
}

export class EvaluacionRecienteDto {
  @ApiProperty() @IsString() @Length(1, 200) reto!: string;
  @ApiProperty({ minimum: 0, maximum: 100 }) @IsNumber() @Min(0) @Max(100) nota!: number;
  @ApiPropertyOptional({ type: FlojoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => FlojoDto)
  flojo?: FlojoDto;
}

export class ContextoDto {
  @ApiProperty() @IsInt() @Min(0) @Max(100_000) totalEvaluaciones!: number;
  @ApiProperty({ minimum: 0, maximum: 100 }) @IsNumber() @Min(0) @Max(100) promedio!: number;

  @ApiProperty({ type: [CriterioDelPerfilDto], maxItems: MAX_CRITERIOS_EN_PERFIL })
  @IsArray()
  @ArrayMaxSize(MAX_CRITERIOS_EN_PERFIL)
  @ValidateNested({ each: true })
  @Type(() => CriterioDelPerfilDto)
  perfil!: CriterioDelPerfilDto[];

  @ApiProperty({ type: [EvaluacionRecienteDto], maxItems: MAX_RECIENTES })
  @IsArray()
  @ArrayMaxSize(MAX_RECIENTES)
  @ValidateNested({ each: true })
  @Type(() => EvaluacionRecienteDto)
  recientes!: EvaluacionRecienteDto[];
}

export class TurnoDto {
  @ApiProperty({ enum: ['candidato', 'mentor'] })
  @IsIn(['candidato', 'mentor'])
  rol!: 'candidato' | 'mentor';

  @ApiProperty() @IsString() @MaxLength(4000) texto!: string;
}

export class SolicitudDeMentorDto {
  @ApiProperty({ type: ContextoDto })
  @ValidateNested()
  @Type(() => ContextoDto)
  contexto!: ContextoDto;

  @ApiProperty({
    type: [TurnoDto],
    description: 'Conversacion previa. El servicio se queda con los ultimos turnos y los recorta.',
  })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TurnoDto)
  historial!: TurnoDto[];

  @ApiProperty({ maxLength: MAX_CARACTERES_DE_PREGUNTA })
  @IsString()
  @Length(1, MAX_CARACTERES_DE_PREGUNTA)
  pregunta!: string;
}

export class RespuestaDeMentorDto {
  @ApiProperty() respuesta!: string;
  @ApiProperty({ type: [String] }) sugerencias!: string[];
  @ApiProperty() proveedor!: string;
  @ApiProperty() modelo!: string;
}
