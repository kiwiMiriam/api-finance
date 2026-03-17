import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get('health')
  @ApiOperation({
    summary: 'Health check de la aplicación',
    description: 'Endpoint para verificar el estado de la aplicación y sus servicios dependientes',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado de la aplicación',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'OK' },
        timestamp: { type: 'string', example: '2024-03-17T22:30:00.000Z' },
        uptime: { type: 'number', example: 3600.5 },
        version: { type: 'string', example: '1.0.0' },
        environment: { type: 'string', example: 'production' },
        services: {
          type: 'object',
          properties: {
            database: { type: 'string', example: 'connected' },
            external_api: { type: 'string', example: 'available' },
            cache: { type: 'string', example: 'active' },
          },
        },
      },
    },
  })
  getHealth() {
    return this.appService.getHealth();
  }

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Información de la API',
    description: 'Endpoint que retorna información básica sobre la API y sus características',
  })
  @ApiResponse({
    status: 200,
    description: 'Información de la API',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'API de Análisis Financiero' },
        description: { type: 'string', example: 'API completa para análisis fundamental de empresas' },
        version: { type: 'string', example: '1.0.0' },
        documentation: { type: 'string', example: '/api/docs' },
        features: {
          type: 'array',
          items: { type: 'string' },
          example: ['Piotroski F-Score', 'Altman Z-Score', 'Beneish M-Score'],
        },
      },
    },
  })
  getInfo() {
    return this.appService.getInfo();
  }
}
