import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configuración de seguridad
  app.use(helmet());

  // Configuración de CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Configuración de validación global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Configuración de Swagger
  const config = new DocumentBuilder()
    .setTitle('API de Análisis Financiero')
    .setDescription(`
      API completa para análisis fundamental de empresas con:
      - Cálculo de Piotroski F-Score (0-9)
      - Cálculo de Altman Z-Score (riesgo de bancarrota)
      - Cálculo de Beneish M-Score (detección de fraude)
      - Gestión de cartera de inversiones
      - Sistema de alertas de fraude
      - Rate limiting inteligente por plan de usuario
    `)
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Token JWT de Supabase',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Analysis', 'Endpoints de análisis financiero')
    .addTag('Portfolio', 'Gestión de cartera de inversiones')
    .addTag('Fraud Alerts', 'Sistema de alertas de fraude')
    .addTag('Auth', 'Autenticación y perfil de usuario')
    .addTag('Health', 'Estado de la aplicación')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  // Configuración de prefijo global
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`🚀 API de Análisis Financiero ejecutándose en puerto ${port}`);
  console.log(`📚 Documentación Swagger disponible en: http://localhost:${port}/api/docs`);
  console.log(`🔍 Health check disponible en: http://localhost:${port}/api/health`);
}

bootstrap();
