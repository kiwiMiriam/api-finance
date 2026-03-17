import {
  Controller,
  Get,
  Post,
  Patch,
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
import { FraudAlertsService } from './fraud-alerts.service';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/user.decorator';
import { 
  AlertsFiltersDto, 
  MarkAlertsReadDto, 
  ExplanationRequestDto 
} from '../../domain/dto/fraud-alerts.dto';
import type {
  AlertsResponse,
  RadarData,
  ExplanationResponse,
} from '../../domain/interfaces/fraud-alerts.interfaces';

@ApiTags('Fraud Alerts')
@Controller('alerts')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth('JWT-auth')
export class FraudAlertsController {
  constructor(private readonly fraudAlertsService: FraudAlertsService) {}

  @Get()
  @ApiOperation({
    summary: 'Obtener feed de alertas de fraude',
    description: `
      Retorna el feed de alertas de fraude del usuario con:
      - Alertas basadas en las 8 variables del M-Score
      - Filtros por severidad, indicador, ticker, estado de lectura
      - Estadísticas agregadas de alertas
      - Paginación y ordenamiento por fecha
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Feed de alertas obtenido exitosamente',
    schema: {
      type: 'object',
      properties: {
        alerts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'alert-123' },
              ticker: { type: 'string', example: 'AAPL' },
              companyName: { type: 'string', example: 'Apple Inc.' },
              timestamp: { type: 'string', example: '2024-03-17T10:30:00.000Z' },
              severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], example: 'HIGH' },
              indicator: { type: 'string', enum: ['DSRI', 'GMI', 'AQI', 'SGI', 'DEPI', 'SGAI', 'TATA', 'LVGI', 'OVERALL_MSCORE'], example: 'DSRI' },
              value: { type: 'number', example: 1.25 },
              threshold: { type: 'number', example: 1.031 },
              message: { type: 'string', example: 'Alerta alta: DSRI (1.250) excede el umbral de 1.031' },
              isRead: { type: 'boolean', example: false },
            },
          },
        },
        stats: {
          type: 'object',
          properties: {
            totalAlerts: { type: 'number', example: 25 },
            unreadAlerts: { type: 'number', example: 8 },
            alertsBySeverity: {
              type: 'object',
              properties: {
                low: { type: 'number', example: 5 },
                medium: { type: 'number', example: 10 },
                high: { type: 'number', example: 8 },
                critical: { type: 'number', example: 2 },
              },
            },
            alertsByIndicator: {
              type: 'object',
              properties: {
                DSRI: { type: 'number', example: 3 },
                GMI: { type: 'number', example: 2 },
                AQI: { type: 'number', example: 4 },
                SGI: { type: 'number', example: 1 },
                DEPI: { type: 'number', example: 2 },
                SGAI: { type: 'number', example: 3 },
                TATA: { type: 'number', example: 5 },
                LVGI: { type: 'number', example: 2 },
                OVERALL_MSCORE: { type: 'number', example: 3 },
              },
            },
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
  async getAlerts(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filters: AlertsFiltersDto,
  ): Promise<AlertsResponse> {
    try {
      return await this.fraudAlertsService.getAlerts(user.id, filters);
    } catch (error) {
      throw new HttpException(
        'Error al obtener alertas de fraude',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('radar/:ticker')
  @ApiOperation({
    summary: 'Obtener datos del radar de 8 variables',
    description: `
      Retorna los datos del gráfico de radar para las 8 variables del M-Score:
      - DSRI: Days Sales in Receivables Index
      - GMI: Gross Margin Index
      - AQI: Asset Quality Index
      - SGI: Sales Growth Index
      - DEPI: Depreciation Index
      - SGAI: Sales General and Administrative expenses Index
      - TATA: Total Accruals to Total Assets
      - LVGI: Leverage Index
      
      Cada variable incluye valor actual, umbral, estado y interpretación.
    `,
  })
  @ApiParam({
    name: 'ticker',
    description: 'Símbolo del ticker para análisis de radar',
    example: 'AAPL',
  })
  @ApiResponse({
    status: 200,
    description: 'Datos del radar obtenidos exitosamente',
    schema: {
      type: 'object',
      properties: {
        ticker: { type: 'string', example: 'AAPL' },
        companyName: { type: 'string', example: 'Apple Inc.' },
        lastUpdated: { type: 'string', example: '2024-03-17T10:30:00.000Z' },
        overallMScore: { type: 'number', example: -2.15 },
        riskLevel: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'], example: 'MEDIUM' },
        variables: {
          type: 'object',
          properties: {
            DSRI: {
              type: 'object',
              properties: {
                name: { type: 'string', example: 'Days Sales in Receivables Index' },
                description: { type: 'string', example: 'Mide si las cuentas por cobrar han aumentado desproporcionadamente' },
                value: { type: 'number', example: 1.025 },
                normalizedValue: { type: 'number', example: 49.8 },
                threshold: { type: 'number', example: 1.031 },
                status: { type: 'string', enum: ['NORMAL', 'WARNING', 'ALERT'], example: 'NORMAL' },
                interpretation: { type: 'string', example: 'DSRI está dentro del rango normal (1.025 ≤ 1.031)' },
              },
            },
            // ... otras 7 variables con la misma estructura
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 400, description: 'Ticker inválido o datos insuficientes' })
  @ApiResponse({ status: 404, description: 'Ticker no encontrado' })
  async getRadarData(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticker') ticker: string,
  ): Promise<RadarData> {
    return await this.fraudAlertsService.getRadarData(ticker, user.id);
  }

  @Get('explanation/:ticker')
  @ApiOperation({
    summary: 'Obtener explicación de IA sobre riesgo de fraude',
    description: `
      Genera una explicación detallada usando IA sobre el riesgo de fraude de una empresa:
      - Resumen ejecutivo del análisis
      - Hallazgos clave y recomendaciones
      - Análisis detallado de fortalezas, preocupaciones y banderas rojas
      - Nivel de confianza del análisis
      - Opcionalmente incluye comparación con la industria y datos históricos
    `,
  })
  @ApiParam({
    name: 'ticker',
    description: 'Símbolo del ticker para generar explicación',
    example: 'AAPL',
  })
  @ApiQuery({
    name: 'includeIndustryComparison',
    description: 'Incluir comparación con la industria',
    required: false,
    type: Boolean,
    example: true,
  })
  @ApiQuery({
    name: 'includeHistoricalData',
    description: 'Incluir análisis de datos históricos',
    required: false,
    type: Boolean,
    example: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Explicación generada exitosamente',
    schema: {
      type: 'object',
      properties: {
        ticker: { type: 'string', example: 'AAPL' },
        companyName: { type: 'string', example: 'Apple Inc.' },
        summary: { 
          type: 'string', 
          example: 'Análisis de AAPL: La empresa presenta un M-Score de -2.15, indicando un riesgo medio de manipulación contable.' 
        },
        riskLevel: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'], example: 'MEDIUM' },
        keyFindings: {
          type: 'array',
          items: { type: 'string' },
          example: [
            'M-Score: -2.15 (riesgo medio)',
            'F-Score: 7 (buena calidad financiera)',
            'Z-Score: 3.25 (bajo riesgo de bancarrota)'
          ],
        },
        recommendations: {
          type: 'array',
          items: { type: 'string' },
          example: [
            'Monitorear de cerca los indicadores de calidad de activos',
            'Revisar las políticas de reconocimiento de ingresos'
          ],
        },
        detailedAnalysis: {
          type: 'object',
          properties: {
            strengths: {
              type: 'array',
              items: { type: 'string' },
              example: ['Ratios de liquidez estables', 'Crecimiento de ingresos consistente'],
            },
            concerns: {
              type: 'array',
              items: { type: 'string' },
              example: ['Incremento en cuentas por cobrar', 'Deterioro del margen bruto'],
            },
            redFlags: {
              type: 'array',
              items: { type: 'string' },
              example: [],
            },
          },
        },
        confidence: { type: 'number', example: 85, description: 'Nivel de confianza del análisis (0-100)' },
        lastUpdated: { type: 'string', example: '2024-03-17T10:30:00.000Z' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 400, description: 'Ticker inválido' })
  @ApiResponse({ status: 404, description: 'Ticker no encontrado' })
  async getExplanation(
    @Param('ticker') ticker: string,
    @Query('includeIndustryComparison') includeIndustryComparison?: boolean,
    @Query('includeHistoricalData') includeHistoricalData?: boolean,
  ): Promise<ExplanationResponse> {
    return await this.fraudAlertsService.getExplanation(
      ticker,
      includeIndustryComparison || false,
      includeHistoricalData || false,
    );
  }

  @Patch('mark-read')
  @ApiOperation({
    summary: 'Marcar alertas como leídas',
    description: 'Marca una o múltiples alertas como leídas para el usuario actual',
  })
  @ApiResponse({
    status: 200,
    description: 'Alertas marcadas como leídas exitosamente',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '3 alertas marcadas como leídas' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 400, description: 'IDs de alertas inválidos' })
  async markAlertsAsRead(
    @CurrentUser() user: AuthenticatedUser,
    @Body() markAlertsReadDto: MarkAlertsReadDto,
  ): Promise<{ success: boolean; message: string }> {
    return await this.fraudAlertsService.markAlertsAsRead(user.id, markAlertsReadDto.alertIds);
  }
}
