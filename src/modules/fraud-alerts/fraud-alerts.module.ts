import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FraudAlertsController } from './fraud-alerts.controller';
import { FraudAlertsService } from './fraud-alerts.service';
import { SupabaseConfigService } from '../../config/supabase.config';
import { AnalysisService } from '../analysis/analysis.service';
import { ScoringService } from '../../domain/services/scoring.service';

@Module({
  imports: [ConfigModule],
  controllers: [FraudAlertsController],
  providers: [
    FraudAlertsService,
    SupabaseConfigService,
    AnalysisService,
    ScoringService,
  ],
  exports: [FraudAlertsService],
})
export class FraudAlertsModule {}
