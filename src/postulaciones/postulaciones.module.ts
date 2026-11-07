import { Module } from '@nestjs/common';
import { PostulacionesController } from './postulaciones.controller';
import { PostulacionesService } from './postulaciones.service';
import { JobAnalyzerService } from './job-analyzer.service';
import { PrismaModule } from '../prisma.module';
import { BullModule } from '@nestjs/bullmq';
import { JobAnalyzerProcessor } from './job-analyzer.processor';
import {
  COLA_ANALISIS,
  ColaMantenimientoService,
} from './cola-mantenimiento.service';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: COLA_ANALISIS,
    }),
  ],
  controllers: [PostulacionesController],
  providers: [
    PostulacionesService,
    JobAnalyzerService,
    JobAnalyzerProcessor,
    ColaMantenimientoService,
  ],
  exports: [PostulacionesService, JobAnalyzerService],
})
export class PostulacionesModule {}
