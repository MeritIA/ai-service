import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { validarEntorno } from './config/entorno.js';
import { ClaveDeAccesoGuard } from './autenticacion/clave-de-acceso.guard.js';
import { SaludController } from './salud/salud.controller.js';
import { EvaluacionModule } from './evaluacion/evaluacion.module.js';
import { MentorModule } from './mentor/mentor.module.js';

@Module({
  imports: [
    // Si la configuracion es invalida, el proceso no arranca.
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validarEntorno }),
    EvaluacionModule,
    MentorModule,
  ],
  controllers: [SaludController],
  // Global: todo endpoint exige la clave salvo que se marque @Publico().
  providers: [{ provide: APP_GUARD, useClass: ClaveDeAccesoGuard }],
})
export class AppModule {}
