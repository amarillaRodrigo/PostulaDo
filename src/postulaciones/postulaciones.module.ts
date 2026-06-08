import { Module } from '@nestjs/common';
import { PostulacionesController } from './postulaciones.controller';
import { PostulacionesService } from './postulaciones.service';
import { JobAnalyzerService } from './job-analyzer.service';
import { PrismaModule } from '../prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PostulacionesController],
  providers: [PostulacionesService, JobAnalyzerService],
  exports: [PostulacionesService, JobAnalyzerService],
})
export class PostulacionesModule {}
