import { Module } from '@nestjs/common';
import { EvaluacionModule } from '../evaluacion/evaluacion.module.js';
import { MentorController } from './mentor.controller.js';
import { MentorService } from './mentor.service.js';

@Module({
  imports: [EvaluacionModule],
  controllers: [MentorController],
  providers: [MentorService],
})
export class MentorModule {}
