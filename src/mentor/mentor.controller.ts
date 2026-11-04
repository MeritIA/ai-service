import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { aExcepcionHttp } from '../evaluacion/errores-http.js';
import { ErrorDto } from '../evaluacion/dto/evaluacion.dto.js';
import { MentorService } from './mentor.service.js';
import { RespuestaDeMentorDto, SolicitudDeMentorDto } from './dto/mentor.dto.js';

@ApiTags('mentor')
@ApiBearerAuth('clave-de-acceso')
@Controller({ path: 'mentor', version: '1' })
export class MentorController {
  constructor(private readonly mentor: MentorService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Responde una pregunta del candidato usando el resumen de su historial',
    description:
      'Sin estado: el backend manda un resumen compacto, los ultimos turnos y la pregunta. Ver docs/contrato.md.',
  })
  @ApiOkResponse({ type: RespuestaDeMentorDto })
  @ApiServiceUnavailableResponse({
    type: ErrorDto,
    description: 'Proveedor no disponible. Reintentable.',
  })
  async responder(@Body() solicitud: SolicitudDeMentorDto): Promise<RespuestaDeMentorDto> {
    try {
      const r = await this.mentor.responder(solicitud);
      return { ...r, sugerencias: [...r.sugerencias] };
    } catch (e) {
      throw aExcepcionHttp(e);
    }
  }
}
