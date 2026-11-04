import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EvaluacionService } from './evaluacion.service.js';
import { EvaluacionesController } from './evaluaciones.controller.js';
import { PROVEEDOR_DE_MODELO } from './dominio/proveedor-de-modelo.js';
import { crearProveedor } from './adaptadores/crear-proveedor.js';

@Module({
  controllers: [EvaluacionesController],
  providers: [
    EvaluacionService,
    { provide: PROVEEDOR_DE_MODELO, inject: [ConfigService], useFactory: crearProveedor },
  ],
  exports: [PROVEEDOR_DE_MODELO],
})
export class EvaluacionModule {}
