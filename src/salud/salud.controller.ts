import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Publico } from '../autenticacion/publico.decorator.js';

@ApiTags('salud')
@Controller({ path: 'salud', version: VERSION_NEUTRAL })
export class SaludController {
  @Get()
  @Publico()
  @ApiOperation({
    summary: 'Comprobacion de vida',
    description:
      'Publica y sin llamar al proveedor de modelo: un chequeo que gastara cuota del proveedor en cada sondeo seria un coste y una via de abuso.',
  })
  @ApiOkResponse({ schema: { example: { estado: 'ok' } } })
  salud(): { estado: 'ok' } {
    return { estado: 'ok' };
  }
}
