import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PortfolioService } from './portfolio.service';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/user.decorator';
import { AddPortfolioDto, PortfolioFiltersDto } from '../../domain/dto/portfolio.dto';
import type {
  PortfolioResponse,
  PortfolioSummary,
  AddPortfolioResponse,
  PortfolioItemHistory,
} from '../../domain/interfaces/portfolio.interfaces';

@ApiTags('Portfolio')
@Controller('portfolio')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth('JWT-auth')
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get()
  @ApiOperation({
    summary: 'Obtener cartera completa',
    description: `
      Retorna la lista completa de activos en la cartera del usuario con:
      - Datos financieros actualizados (F-Score, Z-Score, M-Score)
      - Información de precios y sparklines
      - Clasificación de riesgo
      - Filtros y paginación opcionales
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Cartera obtenida exitosamente',
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'uuid-123' },
              ticker: { type: 'string', example: 'AAPL' },
              companyName: { type: 'string', example: 'Apple Inc.' },
              sector: { type: 'string', example: 'Technology' },
              fScore: { type: 'number', example: 8 },
              zScore: { type: 'number', example: 3.2 },
              mScore: { type: 'number', example: -2.5 },
              sparkline7d: { type: 'array', items: { type: 'number' }, example: [145, 147, 149, 148, 150, 152, 150] },
              currentPrice: { type: 'number', example: 150.25 },
              riskLevel: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], example: 'LOW' },
              fraudRisk: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'], example: 'LOW' },
            },
          },
        },
        summary: {
          type: 'object',
          properties: {
            avgFScore: { type: 'number', example: 7.2 },
            riskExposure: { type: 'number', example: 15.5 },
            manipulationAlerts: { type: 'number', example: 2 },
            totalAssets: { type: 'number', example: 10 },
          },
        },
        pagination: {
          type: 'object',
          properties: {
            total: { type: 'number', example: 25 },
            page: { type: 'number', example: 1 },
            limit: { type: 'number', example: 20 },
            totalPages: { type: 'number', example: 2 },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 500, description: 'Error interno del servidor' })
  async getPortfolio(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filters: PortfolioFiltersDto,
  ): Promise<PortfolioResponse> {
    try {
      return await this.portfolioService.getPortfolio(user.id, filters);
    } catch (error) {
      throw new HttpException(
        'Error al obtener cartera',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Obtener resumen de cartera (KPIs)',
    description: `
      Retorna los KPIs principales de la cartera:
      - avgFScore: Promedio de F-Score de todos los activos
      - riskExposure: % de activos con Z-Score < 1.81 (riesgo de bancarrota)
      - manipulationAlerts: Conteo de activos con M-Score > -1.78 (riesgo de fraude)
      - Distribución por sectores y niveles de riesgo
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Resumen de cartera calculado exitosamente',
    schema: {
      type: 'object',
      properties: {
        avgFScore: { type: 'number', example: 7.2, description: 'Promedio de F-Score (0-9)' },
        riskExposure: { type: 'number', example: 15.5, description: '% de activos con riesgo de bancarrota' },
        manipulationAlerts: { type: 'number', example: 2, description: 'Activos con riesgo de fraude contable' },
        totalAssets: { type: 'number', example: 10, description: 'Total de activos en cartera' },
        sectorDistribution: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              sector: { type: 'string', example: 'Technology' },
              count: { type: 'number', example: 5 },
              percentage: { type: 'number', example: 50.0 },
              avgFScore: { type: 'number', example: 8.2 },
            },
          },
        },
        riskDistribution: {
          type: 'object',
          properties: {
            low: { type: 'number', example: 6 },
            medium: { type: 'number', example: 3 },
            high: { type: 'number', example: 1 },
            critical: { type: 'number', example: 0 },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async getPortfolioSummary(@CurrentUser() user: AuthenticatedUser): Promise<PortfolioSummary> {
    return await this.portfolioService.getPortfolioSummary(user.id);
  }

  @Post('add')
  @ApiOperation({
    summary: 'Agregar activo a la cartera',
    description: `
      Agrega un nuevo activo a la cartera del usuario:
      1. Valida que el ticker existe y es analizable
      2. Verifica que no esté duplicado en la cartera
      3. Ejecuta análisis financiero completo
      4. Calcula niveles de riesgo automáticamente
      5. Guarda en la base de datos con metadatos
    `,
  })
  @ApiResponse({
    status: 201,
    description: 'Activo agregado exitosamente a la cartera',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'AAPL agregado exitosamente a tu cartera' },
        item: {
          type: 'object',
          description: 'Datos completos del activo agregado',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Ticker inválido o ya existe en cartera',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'AAPL ya está en tu cartera' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 402, description: 'Límite de análisis excedido' })
  async addToPortfolio(
    @CurrentUser() user: AuthenticatedUser,
    @Body() addPortfolioDto: AddPortfolioDto,
  ): Promise<AddPortfolioResponse> {
    return await this.portfolioService.addToPortfolio(user.id, addPortfolioDto);
  }

  @Delete(':ticker')
  @ApiOperation({
    summary: 'Eliminar activo de la cartera',
    description: 'Elimina un activo específico de la cartera del usuario',
  })
  @ApiParam({
    name: 'ticker',
    description: 'Símbolo del ticker a eliminar',
    example: 'AAPL',
  })
  @ApiResponse({
    status: 200,
    description: 'Activo eliminado exitosamente',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'AAPL eliminado de tu cartera' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 404, description: 'Activo no encontrado en cartera' })
  async removeFromPortfolio(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticker') ticker: string,
  ): Promise<{ success: boolean; message: string }> {
    return await this.portfolioService.removeFromPortfolio(user.id, ticker);
  }

  @Get(':ticker/history')
  @ApiOperation({
    summary: 'Obtener historial de un activo en cartera',
    description: `
      Retorna el historial de análisis de un activo específico:
      - Evolución de F-Score, Z-Score y M-Score en el tiempo
      - Datos de precio histórico
      - Tendencias y cambios significativos
    `,
  })
  @ApiParam({
    name: 'ticker',
    description: 'Símbolo del ticker',
    example: 'AAPL',
  })
  @ApiResponse({
    status: 200,
    description: 'Historial obtenido exitosamente',
    schema: {
      type: 'object',
      properties: {
        ticker: { type: 'string', example: 'AAPL' },
        history: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              date: { type: 'string', example: '2024-03-15T00:00:00.000Z' },
              fScore: { type: 'number', example: 8 },
              zScore: { type: 'number', example: 3.2 },
              mScore: { type: 'number', example: -2.5 },
              price: { type: 'number', example: 150.25 },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 404, description: 'Activo no encontrado en cartera' })
  async getPortfolioItemHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticker') ticker: string,
  ): Promise<PortfolioItemHistory> {
    return await this.portfolioService.getPortfolioItemHistory(user.id, ticker);
  }
}
