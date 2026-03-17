import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseConfigService } from '../../config/supabase.config';
import { AnalysisService } from '../analysis/analysis.service';
import { ScoringService } from '../../domain/services/scoring.service';
import type {
  FraudAlert,
  RadarData,
  RadarVariable,
  ExplanationResponse,
  AlertsResponse,
  AlertStats,
  AlertsRequest,
  AlertSettings,
  MScoreHistory,
  IndustryComparison,
} from '../../domain/interfaces/fraud-alerts.interfaces';

@Injectable()
export class FraudAlertsService {
  constructor(
    private supabaseConfig: SupabaseConfigService,
    private analysisService: AnalysisService,
    private scoringService: ScoringService,
  ) {}

  /**
   * Obtener feed de alertas de fraude
   */
  async getAlerts(userId: string, filters?: AlertsRequest): Promise<AlertsResponse> {
    try {
      const supabase = this.supabaseConfig.getServiceClient();
      
      // Construir query base
      let query = supabase
        .from('fraud_alerts')
        .select('*', { count: 'exact' })
        .eq('user_id', userId);

      // Aplicar filtros
      if (filters?.severity) {
        query = query.eq('severity', filters.severity);
      }
      if (filters?.indicator) {
        query = query.eq('indicator', filters.indicator);
      }
      if (filters?.ticker) {
        query = query.eq('ticker', filters.ticker.toUpperCase());
      }
      if (filters?.isRead !== undefined) {
        query = query.eq('is_read', filters.isRead);
      }
      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      // Ordenamiento por fecha (más recientes primero)
      query = query.order('created_at', { ascending: false });

      // Paginación
      const limit = filters?.limit || 20;
      const offset = filters?.offset || 0;
      query = query.range(offset, offset + limit - 1);

      const { data: alertsData, error, count } = await query;

      if (error) {
        throw new HttpException(
          `Error al obtener alertas: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Procesar alertas
      const alerts = this.processAlertsData(alertsData || []);
      
      // Calcular estadísticas
      const stats = await this.calculateAlertStats(userId);

      return {
        alerts,
        stats,
        pagination: {
          total: count || 0,
          page: Math.floor(offset / limit) + 1,
          limit,
          totalPages: Math.ceil((count || 0) / limit),
        },
      };
    } catch (error) {
      console.error('Error in getAlerts:', error);
      throw new HttpException(
        'Error al obtener alertas de fraude',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Obtener datos del radar de 8 variables para un ticker
   */
  async getRadarData(ticker: string, userId?: string): Promise<RadarData> {
    try {
      // Obtener análisis completo del ticker
      const analysis = await this.analysisService.analyzeCompany(ticker, userId);
      
      if (!analysis.beneishVariables || analysis.beneishVariables.length === 0) {
        throw new HttpException(
          'No se pudieron obtener datos del M-Score para el radar',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Obtener información de la empresa
      const companyInfo = await this.getCompanyInfo(ticker);

      // Procesar variables del M-Score para el radar
      const variables = this.processRadarVariables(analysis.beneishVariables);

      return {
        ticker: ticker.toUpperCase(),
        companyName: companyInfo.name,
        lastUpdated: new Date().toISOString(),
        overallMScore: analysis.mScore,
        riskLevel: this.calculateFraudRiskLevel(analysis.mScore),
        variables,
      };
    } catch (error) {
      console.error('Error in getRadarData:', error);
      throw new HttpException(
        'Error al obtener datos del radar',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Generar explicación de IA para un ticker
   */
  async getExplanation(
    ticker: string,
    includeIndustryComparison = false,
    includeHistoricalData = false,
  ): Promise<ExplanationResponse> {
    try {
      // Obtener análisis completo
      const analysis = await this.analysisService.analyzeCompany(ticker);
      const companyInfo = await this.getCompanyInfo(ticker);

      // Generar explicación basada en los datos
      const explanation = await this.generateAIExplanation(
        ticker,
        analysis,
        companyInfo,
        includeIndustryComparison,
        includeHistoricalData,
      );

      return explanation;
    } catch (error) {
      console.error('Error in getExplanation:', error);
      throw new HttpException(
        'Error al generar explicación',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Crear alerta de fraude
   */
  async createAlert(
    userId: string,
    ticker: string,
    indicator: string,
    value: number,
    threshold: number,
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
  ): Promise<FraudAlert> {
    try {
      const supabase = this.supabaseConfig.getServiceClient();
      const companyInfo = await this.getCompanyInfo(ticker);

      const alertData = {
        user_id: userId,
        ticker: ticker.toUpperCase(),
        company_name: companyInfo.name,
        severity,
        indicator,
        value,
        threshold,
        message: this.generateAlertMessage(indicator, value, threshold, severity),
        is_read: false,
      };

      const { data: alert, error } = await supabase
        .from('fraud_alerts')
        .insert(alertData as any)
        .select()
        .single();

      if (error) {
        throw new HttpException(
          `Error al crear alerta: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return this.processAlertData(alert);
    } catch (error) {
      console.error('Error in createAlert:', error);
      throw new HttpException(
        'Error al crear alerta de fraude',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Marcar alertas como leídas
   */
  async markAlertsAsRead(userId: string, alertIds: string[]): Promise<{ success: boolean; message: string }> {
    try {
      const supabase = this.supabaseConfig.getServiceClient();

      const { error } = await (supabase
        .from('fraud_alerts') as any)
        .update({ is_read: true })
        .eq('user_id', userId)
        .in('id', alertIds);

      if (error) {
        throw new HttpException(
          `Error al marcar alertas: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return {
        success: true,
        message: `${alertIds.length} alertas marcadas como leídas`,
      };
    } catch (error) {
      console.error('Error in markAlertsAsRead:', error);
      throw new HttpException(
        'Error al marcar alertas como leídas',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Procesar datos de alertas
   */
  private processAlertsData(rawData: any[]): FraudAlert[] {
    return rawData.map(item => this.processAlertData(item));
  }

  /**
   * Procesar una alerta individual
   */
  private processAlertData(rawItem: any): FraudAlert {
    return {
      id: rawItem.id,
      ticker: rawItem.ticker,
      companyName: rawItem.company_name,
      timestamp: rawItem.created_at,
      severity: rawItem.severity,
      indicator: rawItem.indicator,
      value: rawItem.value,
      threshold: rawItem.threshold,
      message: rawItem.message,
      isRead: rawItem.is_read,
      userId: rawItem.user_id,
    };
  }

  /**
   * Calcular estadísticas de alertas
   */
  private async calculateAlertStats(userId: string): Promise<AlertStats> {
    try {
      const supabase = this.supabaseConfig.getServiceClient();

      // Obtener todas las alertas del usuario
      const { data: allAlerts } = await supabase
        .from('fraud_alerts')
        .select('*')
        .eq('user_id', userId);

      if (!allAlerts) {
        return this.getEmptyStats();
      }

      // Casting para TypeScript
      const alerts = allAlerts as any[];

      // Calcular estadísticas
      const totalAlerts = alerts.length;
      const unreadAlerts = alerts.filter(alert => !alert.is_read).length;

      const alertsBySeverity = {
        low: alerts.filter(alert => alert.severity === 'LOW').length,
        medium: alerts.filter(alert => alert.severity === 'MEDIUM').length,
        high: alerts.filter(alert => alert.severity === 'HIGH').length,
        critical: alerts.filter(alert => alert.severity === 'CRITICAL').length,
      };

      const alertsByIndicator = {
        DSRI: alerts.filter(alert => alert.indicator === 'DSRI').length,
        GMI: alerts.filter(alert => alert.indicator === 'GMI').length,
        AQI: alerts.filter(alert => alert.indicator === 'AQI').length,
        SGI: alerts.filter(alert => alert.indicator === 'SGI').length,
        DEPI: alerts.filter(alert => alert.indicator === 'DEPI').length,
        SGAI: alerts.filter(alert => alert.indicator === 'SGAI').length,
        TATA: alerts.filter(alert => alert.indicator === 'TATA').length,
        LVGI: alerts.filter(alert => alert.indicator === 'LVGI').length,
        OVERALL_MSCORE: alerts.filter(alert => alert.indicator === 'OVERALL_MSCORE').length,
      };

      // Tendencias de los últimos 30 días (mock por ahora)
      const trendsLast30Days = this.generateTrendsMock();

      return {
        totalAlerts,
        unreadAlerts,
        alertsBySeverity,
        alertsByIndicator,
        trendsLast30Days,
      };
    } catch (error) {
      console.error('Error calculating alert stats:', error);
      return this.getEmptyStats();
    }
  }

  /**
   * Procesar variables del radar
   */
  private processRadarVariables(beneishVariables: any[]): RadarData['variables'] {
    const result: any = {};

    // Convertir array de variables a objeto para fácil acceso
    const variablesMap = new Map();
    beneishVariables.forEach(variable => {
      variablesMap.set(variable.key, variable);
    });

    // Procesar cada variable
    ['DSRI', 'GMI', 'AQI', 'SGI', 'DEPI', 'SGAI', 'TATA', 'LVGI'].forEach(key => {
      const variable = variablesMap.get(key);
      
      if (variable) {
        result[key] = {
          name: variable.name,
          description: variable.description,
          value: variable.value,
          normalizedValue: this.normalizeForRadar(variable.value, parseFloat(variable.threshold)),
          threshold: parseFloat(variable.threshold),
          status: variable.flagged ? 'ALERT' : 'NORMAL',
          interpretation: this.getVariableInterpretation(key, variable.value, parseFloat(variable.threshold)),
        };
      } else {
        // Variable no encontrada, usar valores por defecto
        const defaultThreshold = this.getDefaultThreshold(key);
        result[key] = {
          name: this.getVariableName(key),
          description: this.getVariableDescription(key),
          value: 0,
          normalizedValue: 0,
          threshold: defaultThreshold,
          status: 'NORMAL',
          interpretation: `${key} no disponible`,
        };
      }
    });

    return result;
  }

  /**
   * Obtener umbral por defecto para una variable
   */
  private getDefaultThreshold(key: string): number {
    const thresholds: { [key: string]: number } = {
      DSRI: 1.031,
      GMI: 1.014,
      AQI: 1.043,
      SGI: 1.107,
      DEPI: 1.077,
      SGAI: 1.054,
      TATA: 0.031,
      LVGI: 1.041,
    };
    return thresholds[key] || 1.0;
  }

  /**
   * Obtener nombre de variable
   */
  private getVariableName(key: string): string {
    const names: { [key: string]: string } = {
      DSRI: 'Days Sales in Receivables Index',
      GMI: 'Gross Margin Index',
      AQI: 'Asset Quality Index',
      SGI: 'Sales Growth Index',
      DEPI: 'Depreciation Index',
      SGAI: 'Sales General and Administrative expenses Index',
      TATA: 'Total Accruals to Total Assets',
      LVGI: 'Leverage Index',
    };
    return names[key] || key;
  }

  /**
   * Obtener descripción de variable
   */
  private getVariableDescription(key: string): string {
    const descriptions: { [key: string]: string } = {
      DSRI: 'Mide si las cuentas por cobrar han aumentado desproporcionadamente',
      GMI: 'Evalúa el deterioro del margen bruto',
      AQI: 'Mide la calidad de los activos no corrientes',
      SGI: 'Evalúa el crecimiento de las ventas',
      DEPI: 'Mide cambios en la tasa de depreciación',
      SGAI: 'Evalúa el crecimiento de gastos administrativos',
      TATA: 'Mide la calidad de las ganancias',
      LVGI: 'Evalúa cambios en el apalancamiento',
    };
    return descriptions[key] || `Descripción de ${key}`;
  }

  /**
   * Normalizar valor para gráfico de radar (0-100)
   */
  private normalizeForRadar(value: number, threshold: number): number {
    // Normalizar basado en el umbral (threshold = 50 en el radar)
    const normalized = (value / threshold) * 50;
    return Math.min(Math.max(normalized, 0), 100);
  }

  /**
   * Obtener estado de variable
   */
  private getVariableStatus(value: number, threshold: number): 'NORMAL' | 'WARNING' | 'ALERT' {
    if (value <= threshold) return 'NORMAL';
    if (value <= threshold * 1.2) return 'WARNING';
    return 'ALERT';
  }

  /**
   * Obtener interpretación de variable
   */
  private getVariableInterpretation(variable: string, value: number, threshold: number): string {
    const status = this.getVariableStatus(value, threshold);
    
    if (status === 'NORMAL') {
      return `${variable} está dentro del rango normal (${value.toFixed(3)} ≤ ${threshold})`;
    } else if (status === 'WARNING') {
      return `${variable} muestra señales de advertencia (${value.toFixed(3)} > ${threshold})`;
    } else {
      return `${variable} indica alto riesgo de manipulación (${value.toFixed(3)} >> ${threshold})`;
    }
  }

  /**
   * Calcular nivel de riesgo de fraude
   */
  private calculateFraudRiskLevel(mScore: number): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (mScore < -2.22) return 'LOW';
    if (mScore < -1.78) return 'MEDIUM';
    return 'HIGH';
  }

  /**
   * Generar mensaje de alerta
   */
  private generateAlertMessage(
    indicator: string,
    value: number,
    threshold: number,
    severity: string,
  ): string {
    const variableNames: { [key: string]: string } = {
      DSRI: 'Índice de Días de Ventas en Cuentas por Cobrar',
      GMI: 'Índice de Margen Bruto',
      AQI: 'Índice de Calidad de Activos',
      SGI: 'Índice de Crecimiento de Ventas',
      DEPI: 'Índice de Depreciación',
      SGAI: 'Índice de Gastos Administrativos',
      TATA: 'Acumulaciones Totales sobre Activos Totales',
      LVGI: 'Índice de Apalancamiento',
      OVERALL_MSCORE: 'M-Score General',
    };

    const name = variableNames[indicator] || indicator;
    const severityText = severity === 'CRITICAL' ? 'crítica' : severity.toLowerCase();

    return `Alerta ${severityText}: ${name} (${value.toFixed(3)}) excede el umbral de ${threshold.toFixed(3)}`;
  }

  /**
   * Generar explicación de IA (mock por ahora)
   */
  private async generateAIExplanation(
    ticker: string,
    analysis: any,
    companyInfo: any,
    includeIndustryComparison: boolean,
    includeHistoricalData: boolean,
  ): Promise<ExplanationResponse> {
    // TODO: Integrar con servicio de IA real (OpenAI, Claude, etc.)
    
    const riskLevel = this.calculateFraudRiskLevel(analysis.mScore);
    
    return {
      ticker: ticker.toUpperCase(),
      companyName: companyInfo.name,
      summary: `Análisis de ${ticker}: La empresa presenta un M-Score de ${analysis.mScore.toFixed(2)}, indicando un riesgo ${riskLevel.toLowerCase()} de manipulación contable.`,
      riskLevel,
      keyFindings: [
        `M-Score: ${analysis.mScore.toFixed(2)} (${riskLevel.toLowerCase()} riesgo)`,
        `F-Score: ${analysis.fScore} (calidad financiera)`,
        `Z-Score: ${analysis.zScore.toFixed(2)} (riesgo de bancarrota)`,
      ],
      recommendations: [
        'Monitorear de cerca los indicadores de calidad de activos',
        'Revisar las políticas de reconocimiento de ingresos',
        'Analizar la evolución de los márgenes operativos',
      ],
      detailedAnalysis: {
        strengths: ['Ratios de liquidez estables', 'Crecimiento de ingresos consistente'],
        concerns: ['Incremento en cuentas por cobrar', 'Deterioro del margen bruto'],
        redFlags: analysis.mScore > -1.78 ? ['M-Score por encima del umbral de riesgo'] : [],
      },
      confidence: 85,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Obtener información de empresa (mock)
   */
  private async getCompanyInfo(ticker: string): Promise<{ name: string; sector: string; industry: string }> {
    // TODO: Integrar con API real
    return {
      name: `${ticker} Inc.`,
      sector: 'Technology',
      industry: 'Software',
    };
  }

  /**
   * Estadísticas vacías
   */
  private getEmptyStats(): AlertStats {
    return {
      totalAlerts: 0,
      unreadAlerts: 0,
      alertsBySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
      alertsByIndicator: {
        DSRI: 0, GMI: 0, AQI: 0, SGI: 0, DEPI: 0, SGAI: 0, TATA: 0, LVGI: 0, OVERALL_MSCORE: 0,
      },
      trendsLast30Days: [],
    };
  }

  /**
   * Generar tendencias mock
   */
  private generateTrendsMock(): { date: string; count: number }[] {
    const trends: { date: string; count: number }[] = [];
    const today = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      trends.push({
        date: date.toISOString().split('T')[0],
        count: Math.floor(Math.random() * 5),
      });
    }
    
    return trends;
  }
}
