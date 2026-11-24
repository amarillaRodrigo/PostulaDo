import { Module } from '@nestjs/common';
import { LotesController } from './lotes.controller';
import { LotesService } from './lotes.service';
import { VerifiedEmailGuard } from '../auth/guards/verified-email.guard';

@Module({
  controllers: [LotesController],
  providers: [LotesService, VerifiedEmailGuard],
  exports: [LotesService],
})
export class LotesModule {}
