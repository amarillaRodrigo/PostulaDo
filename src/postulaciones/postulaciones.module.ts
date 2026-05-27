import { Module } from '@nestjs/common';
import { PostulacionesController } from './postulaciones.controller';
import { PostulacionesService } from './postulaciones.service';
import { PrismaModule } from '../prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PostulacionesController],
  providers: [PostulacionesService],
  exports: [PostulacionesService],
})
export class PostulacionesModule {}
