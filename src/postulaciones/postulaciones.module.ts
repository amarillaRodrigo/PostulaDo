import { Module } from '@nestjs/common';
import { PostulacionesController } from './postulaciones.controller';
import { PostulacionesService } from './postulaciones.service';
import { JobAnalyzerService } from './job-analyzer.service';
import { PrismaModule } from '../prisma.module';
import { BullModule } from '@nestjs/bullmq';
import { JobAnalyzerProcessor } from './job-analyzer.processor';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: 'analisis-trabajo',
    }),
  ],
  controllers: [PostulacionesController],
  providers: [PostulacionesService, JobAnalyzerService, JobAnalyzerProcessor],
  exports: [PostulacionesService, JobAnalyzerService],
})
export class PostulacionesModule {}
