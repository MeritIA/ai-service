import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CODIGOS } from '../../errores/respuesta-error.js';

export class CriterioDto {
  @ApiProperty({ maxLength: 120, example: 'Correccion funcional' })
  @IsString()
  @Length(1, 120)
  nombre!: string;

  @ApiProperty({ maxLength: 2000, description: 'Que significa cada nivel de la escala.' })
  @IsString()
  @Length(10, 2000)
  descripcion!: string;

  @ApiProperty({ minimum: 0.01, maximum: 100, description: 'Los pesos de la rubrica suman 100.' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  peso!: number;

  @ApiProperty({ minimum: 1, maximum: 1000, example: 5 })
  @IsNumber()
  @Min(1)
  @Max(1000)
  escalaMaxima!: number;
}

export class ArchivoDto {
  @ApiProperty({ maxLength: 500, example: 'src/main.py' })
  @IsString()
  @Length(1, 500)
  ruta!: string;

  @ApiProperty({ maxLength: 500_000, description: 'Contenido del archivo como texto.' })
  @IsString()
  @MaxLength(500_000)
  contenido!: string;
}

export class SolicitudDeEvaluacionDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Lo asigna el backend; se devuelve tal cual para correlacionar.',
  })
  @IsUUID()
  idEvaluacion!: string;

  @ApiProperty({ maxLength: 20_000 })
  @IsString()
  @Length(10, 20_000)
  enunciado!: string;

  @ApiProperty({ type: [CriterioDto], minItems: 1, maxItems: 20 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CriterioDto)
  criterios!: CriterioDto[];

  @ApiProperty({ type: [ArchivoDto], minItems: 1, maxItems: 200 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ArchivoDto)
  archivos!: ArchivoDto[];
}

export class CalificacionDto {
  @ApiProperty() criterio!: string;
  @ApiProperty() puntaje!: number;
  @ApiProperty() escalaMaxima!: number;
  @ApiProperty() peso!: number;
  @ApiProperty({ description: 'Por que ese puntaje, con referencia a la entrega.' })
  evidencia!: string;
}

export class ResultadoDeEvaluacionDto {
  @ApiProperty({ format: 'uuid' }) idEvaluacion!: string;
  @ApiProperty({ minimum: 0, maximum: 100, description: 'Suma ponderada, dos decimales.' })
  notaFinal!: number;
  @ApiProperty({ type: [CalificacionDto], description: 'En el orden de la rubrica.' })
  criterios!: CalificacionDto[];
  @ApiProperty({ example: 'gemini' }) proveedor!: string;
  @ApiProperty({ example: 'gemini-3.5-flash' }) modelo!: string;
}

export class DetalleValidacionDto {
  @ApiProperty() campo!: string;
  @ApiProperty({ type: [String] }) problemas!: string[];
}

export class ErrorDto {
  @ApiProperty() estado!: number;
  @ApiProperty({ enum: Object.values(CODIGOS) }) codigo!: string;
  @ApiProperty() mensaje!: string;
  @ApiProperty({ description: 'Si tiene sentido volver a intentarlo.' }) reintentable!: boolean;
  @ApiProperty() momento!: string;
  @ApiProperty() ruta!: string;
  @ApiProperty({ format: 'uuid' }) referencia!: string;
  @ApiPropertyOptional({ type: [DetalleValidacionDto] }) errores?: DetalleValidacionDto[];
}
