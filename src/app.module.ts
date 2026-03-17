import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Configuración
import { SupabaseConfigService } from './config/supabase.config';

// Módulos existentes
import { AnalysisModule } from './modules/analysis/analysis.module';

// Módulos implementados
import { PortfolioModule } from './modules/portfolio/portfolio.module';
import { FraudAlertsModule } from './modules/fraud-alerts/fraud-alerts.module';
import { AuthModule } from './modules/auth/auth.module';

// Servicios de dominio
import { ScoringService } from './domain/services/scoring.service';

@Module({
  imports: [
    // Configuración global
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Rate limiting global
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 segundo
        limit: 3, // 3 requests por segundo
      },
      {
        name: 'medium',
        ttl: 10000, // 10 segundos
        limit: 20, // 20 requests por 10 segundos
      },
      {
        name: 'long',
        ttl: 60000, // 1 minuto
        limit: 100, // 100 requests por minuto
      },
    ]),

    // Módulos de la aplicación
    AnalysisModule,
    PortfolioModule,
    FraudAlertsModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    SupabaseConfigService,
    ScoringService,
  ],
  exports: [
    SupabaseConfigService,
    ScoringService,
  ],
})
export class AppModule {}
