import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  /**
   * Health check básico de la aplicación
   */
  getHealth(): {
    status: string;
    timestamp: string;
    uptime: number;
    version: string;
    environment: string;
    services: {
      database: string;
      external_api: string;
      cache: string;
    };
  } {
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: 'connected', // TODO: Implementar check real de Supabase
        external_api: 'available', // TODO: Implementar check de Financial Modeling Prep
        cache: 'active', // TODO: Implementar check de sistema de caché
      },
    };
  }

  /**
   * Información básica de la API
   */
  getInfo(): {
    name: string;
    description: string;
    version: string;
    documentation: string;
    features: string[];
  } {
    return {
      name: 'API de Análisis Financiero',
      description: 'API completa para análisis fundamental de empresas públicas y privadas',
      version: '1.0.0',
      documentation: '/api/docs',
      features: [
        'Cálculo de Piotroski F-Score (9 criterios)',
        'Cálculo de Altman Z-Score (predicción de bancarrota)',
        'Cálculo de Beneish M-Score (detección de fraude contable)',
        'Gestión de cartera de inversiones',
        'Sistema de alertas de fraude en tiempo real',
        'Rate limiting inteligente por plan de usuario',
        'Caché de 24h para optimización de costos',
        'Autenticación con Supabase JWT',
        'Análisis de empresas públicas y privadas',
        'Integración con Financial Modeling Prep API',
      ],
    };
  }
}
