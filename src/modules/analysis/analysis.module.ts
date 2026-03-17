import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';
import { SupabaseConfigService } from '../../config/supabase.config';
import { ScoringService } from '../../domain/services/scoring.service';

@Module({
  imports: [
    ConfigModule,
    ThrottlerModule,
  ],
  controllers: [AnalysisController],
  providers: [
    AnalysisService,
    SupabaseConfigService,
    ScoringService,
  ],
  exports: [AnalysisService],
})
export class AnalysisModule {}
