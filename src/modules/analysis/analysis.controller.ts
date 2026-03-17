import { 
  Controller, 
  Get, 
  Post, 
  Param, 
  Body, 
  UseGuards,
  HttpException,
  HttpStatus,
  Req
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { AnalysisService } from './analysis.service';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/user.decorator';
import { AnalysisResponse, ManualAnalysisRequest } from '../../domain/interfaces/analysis.interfaces';

/**
 * Controlador de análisis financiero
 * Implementa los endpoints exactos según el README del frontend
 */
@ApiTags('Analysis')
@Controller('api/analysis')
@UseGuards(SupabaseAuthGuard)
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  /**
   * GET /api/analysis/:ticker
   * Endpoint principal para análisis de empresas públicas
   * Permite 5 intentos sin autenticación, ilimitado con autenticación
   */
  @Get(':ticker')
  @Public()
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ 
    summary: 'Analizar empresa por ticker',
    description: 'Obtiene análisis completo de Piotroski, Altman y Beneish para una empresa pública'
  })
  @ApiParam({ 
    name: 'ticker', 
    description: 'Símbolo bursátil de la empresa (ej: AAPL, MSFT)',
    example: 'AAPL'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Análisis completado exitosamente',
    type: AnalysisResponse
  })
  @ApiResponse({ 
    status: 429, 
    description: 'Límite de intentos excedido para usuarios no autenticados'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Empresa no encontrada'
  })
  async analyzeByTicker(
    @Param('ticker') ticker: string,
    @CurrentUser() user?: AuthenticatedUser,
    @Req() request?: any
  ): Promise<AnalysisResponse> {
    try {
      // Validar ticker
      if (!ticker || ticker.length < 1 || ticker.length > 10) {
        throw new HttpException(
          'Ticker inválido. Debe tener entre 1 y 10 caracteres',
          HttpStatus.BAD_REQUEST
        );
      }

      // Normalizar ticker
      const normalizedTicker = ticker.toUpperCase().trim();

      // Verificar límites de uso si no está autenticado
      if (!user) {
        await this.analysisService.checkPublicRateLimit(request.ip);
      }

      // Realizar análisis
      const analysis = await this.analysisService.analyzeCompany(
        normalizedTicker,
        user?.id
      );

      // Registrar uso en logs
      await this.analysisService.logApiUsage({
        userId: user?.id,
        ticker: normalizedTicker,
        endpoint: `/api/analysis/${normalizedTicker}`,
        apiProvider: 'financial_modeling_prep',
        costCredits: user ? 1 : 0, // Gratis para usuarios no autenticados (limitado)
        responseStatus: 200,
        responseTimeMs: Date.now() - request.startTime
      });

      return analysis;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        'Error interno del servidor al procesar análisis',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * POST /api/analysis/manual
   * Endpoint para análisis manual con datos proporcionados por el usuario
   * Requiere autenticación
   */
  @Post('manual')
  @ApiOperation({ 
    summary: 'Análisis manual con datos financieros',
    description: 'Permite analizar empresas privadas o datos personalizados proporcionando estados financieros'
  })
  @ApiBody({ 
    type: ManualAnalysisRequest,
    description: 'Datos financieros mínimos requeridos para el análisis'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Análisis manual completado exitosamente',
    type: AnalysisResponse
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Autenticación requerida'
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Datos financieros inválidos'
  })
  async analyzeManualData(
    @Body() manualData: ManualAnalysisRequest,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: any
  ): Promise<AnalysisResponse> {
    try {
      // Validar datos requeridos
      this.validateManualData(manualData);

      // Verificar límites del usuario
      await this.analysisService.checkUserLimits(user.id);

      // Realizar análisis manual
      const analysis = await this.analysisService.analyzeManualData(
        manualData,
        user.id
      );

      // Registrar uso en logs
      await this.analysisService.logApiUsage({
        userId: user.id,
        ticker: `MANUAL_${manualData.companyName.replace(/\s+/g, '_').toUpperCase()}`,
        endpoint: '/api/analysis/manual',
        apiProvider: 'manual_input',
        costCredits: 1,
        responseStatus: 200,
        responseTimeMs: Date.now() - request.startTime
      });

      return analysis;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        'Error interno del servidor al procesar análisis manual',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * GET /api/analysis/:ticker/history
   * Obtener historial de análisis para comparación temporal
   */
  @Get(':ticker/history')
  @ApiOperation({ 
    summary: 'Historial de análisis',
    description: 'Obtiene el historial de scores para análisis de tendencias'
  })
  @ApiParam({ 
    name: 'ticker', 
    description: 'Símbolo bursátil de la empresa',
    example: 'AAPL'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Historial obtenido exitosamente'
  })
  async getAnalysisHistory(
    @Param('ticker') ticker: string,
    @CurrentUser() user?: AuthenticatedUser
  ) {
    try {
      const normalizedTicker = ticker.toUpperCase().trim();
      
      return await this.analysisService.getAnalysisHistory(
        normalizedTicker,
        user?.id
      );
    } catch (error) {
      throw new HttpException(
        'Error al obtener historial de análisis',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Validar datos manuales requeridos
   */
  private validateManualData(data: ManualAnalysisRequest): void {
    const requiredFields = [
      'companyName',
      'netIncome',
      'totalAssets',
      'totalAssetsPrior',
      'operatingCashFlow',
      'longTermDebt',
      'currentAssets',
      'currentLiabilities',
      'grossProfit',
      'totalRevenue',
      'sharesOutstanding'
    ];

    const missingFields = requiredFields.filter(field => {
      const value = data[field as keyof ManualAnalysisRequest];
      return value === undefined || value === null || 
             (typeof value === 'string' && value.trim() === '');
    });

    if (missingFields.length > 0) {
      throw new HttpException(
        `Campos requeridos faltantes: ${missingFields.join(', ')}`,
        HttpStatus.BAD_REQUEST
      );
    }

    // Validar que los números sean positivos donde corresponda
    const numericFields = [
      'totalAssets',
      'totalAssetsPrior',
      'currentAssets',
      'currentLiabilities',
      'grossProfit',
      'totalRevenue',
      'sharesOutstanding'
    ];

    for (const field of numericFields) {
      const value = data[field as keyof ManualAnalysisRequest] as number;
      if (value <= 0) {
        throw new HttpException(
          `${field} debe ser un número positivo`,
          HttpStatus.BAD_REQUEST
        );
      }
    }

    // Validar coherencia de datos
    if (data.grossProfit > data.totalRevenue) {
      throw new HttpException(
        'La utilidad bruta no puede ser mayor que los ingresos totales',
        HttpStatus.BAD_REQUEST
      );
    }

    if (data.currentAssets > data.totalAssets) {
      throw new HttpException(
        'Los activos corrientes no pueden ser mayores que los activos totales',
        HttpStatus.BAD_REQUEST
      );
    }
  }
}

