import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseConfigService } from '../../config/supabase.config';
import { ScoringService } from '../../domain/services/scoring.service';
import { 
  AnalysisResponse, 
  ManualAnalysisRequest,
  FinancialData 
} from '../../domain/interfaces/analysis.interfaces';
import axios from 'axios';
import * as moment from 'moment';

/**
 * Servicio de análisis financiero
 * Coordina la obtención de datos y cálculo de scores
 */
@Injectable()
export class AnalysisService {
  private readonly financialApiKey: string;
  private readonly financialApiBaseUrl: string;
  private readonly cacheService: SupabaseConfigService;
  private readonly publicRateLimitMax: number;
  private readonly publicRateLimitWindow: number;

  constructor(
    private configService: ConfigService,
    private supabaseConfig: SupabaseConfigService,
    private scoringService: ScoringService
  ) {
    this.financialApiKey = this.configService.get<string>('FINANCIAL_API_KEY');
    this.financialApiBaseUrl = this.configService.get<string>('FINANCIAL_API_BASE_URL');
    this.publicRateLimitMax = this.configService.get<number>('PUBLIC_RATE_LIMIT_MAX', 5);
    this.publicRateLimitWindow = this.configService.get<number>('PUBLIC_RATE_LIMIT_WINDOW', 3600000);
  }

  /**
   * Analizar empresa por ticker
   */
  async analyzeCompany(ticker: string, userId?: string): Promise<AnalysisResponse> {
    try {
      // 1. Verificar cache primero
      const cachedAnalysis = await this.getCachedAnalysis(ticker);
      if (cachedAnalysis) {
        return cachedAnalysis;
      }

      // 2. Obtener datos financieros de la API externa
      const financialData = await this.fetchFinancialData(ticker);
      const priorYearData = await this.fetchPriorYearData(ticker);

      // 3. Calcular scores usando el ScoringService
      const analysis = await this.scoringService.analyzeCompany(financialData, priorYearData);

      // 4. Guardar en cache
      await this.cacheAnalysis(ticker, analysis);

      // 5. Incrementar contador de búsquedas si hay usuario
      if (userId) {
        await this.incrementUserSearchCount(userId);
      }

      return analysis;
    } catch (error) {
      console.error('Error en analyzeCompany:', error);
      
      // Fallback a datos mock si está habilitado
      if (this.configService.get<boolean>('FALLBACK_TO_MOCKS', true)) {
        return this.generateMockAnalysis(ticker);
      }
      
      throw new HttpException(
        'Error al obtener datos financieros de la empresa',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  /**
   * Analizar datos manuales
   */
  async analyzeManualData(request: ManualAnalysisRequest, userId: string): Promise<AnalysisResponse> {
    try {
      // Usar el ScoringService para analizar datos manuales
      const analysis = await this.scoringService.analyzeManualData(request);

      // Incrementar contador de búsquedas
      await this.incrementUserSearchCount(userId);

      return analysis;
    } catch (error) {
      console.error('Error en analyzeManualData:', error);
      throw new HttpException(
        'Error al procesar análisis manual',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Verificar límites de rate limiting público
   */
  async checkPublicRateLimit(clientIp: string): Promise<void> {
    const supabase = this.supabaseConfig.getServiceClient();
    
    const windowStart = moment().subtract(this.publicRateLimitWindow, 'milliseconds').toISOString();
    
    // Contar requests desde esta IP en la ventana de tiempo
    const { data: logs, error } = await supabase
      .from('api_usage_log')
      .select('id')
      .is('user_id', null) // Solo requests no autenticados
      .gte('created_at', windowStart)
      .eq('endpoint', 'public_analysis'); // Marcador especial para requests públicos

    if (error) {
      console.error('Error checking rate limit:', error);
      return; // En caso de error, permitir el request
    }

    if (logs && logs.length >= this.publicRateLimitMax) {
      throw new HttpException(
        `Límite de ${this.publicRateLimitMax} análisis por hora excedido. Regístrate para acceso ilimitado.`,
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    // Registrar este intento
    await supabase
      .from('api_usage_log')
      .insert({
        endpoint: 'public_analysis',
        api_provider: 'rate_limit_check',
        cost_credits: 0
      });
  }

  /**
   * Verificar límites del usuario autenticado
   */
  async checkUserLimits(userId: string): Promise<void> {
    const supabase = this.supabaseConfig.getServiceClient();
    
    // Obtener perfil del usuario
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('search_count, tier_plan')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      throw new HttpException(
        'Usuario no encontrado',
        HttpStatus.NOT_FOUND
      );
    }

    // Verificar límites según tier
    const limits = {
      free: 5,
      pro: 100,
      enterprise: 999999
    };

    const userLimit = limits[profile.tier_plan] || limits.free;

    if (profile.search_count >= userLimit) {
      throw new HttpException(
        `Límite de ${userLimit} análisis mensuales excedido para el plan ${profile.tier_plan}`,
        HttpStatus.PAYMENT_REQUIRED
      );
    }
  }

  /**
   * Obtener análisis desde cache
   */
  private async getCachedAnalysis(ticker: string): Promise<AnalysisResponse | null> {
    try {
      const supabase = this.supabaseConfig.getServiceClient();
      
      const { data, error } = await supabase
        .from('analysis_cache')
        .select('analysis_data, expires_at')
        .eq('ticker', ticker)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !data) {
        return null;
      }

      return data.analysis_data as AnalysisResponse;
    } catch (error) {
      console.error('Error getting cached analysis:', error);
      return null;
    }
  }

  /**
   * Guardar análisis en cache
   */
  private async cacheAnalysis(ticker: string, analysis: AnalysisResponse): Promise<void> {
    try {
      const supabase = this.supabaseConfig.getServiceClient();
      const cacheHours = this.configService.get<number>('CACHE_TTL_HOURS', 24);
      const expiresAt = moment().add(cacheHours, 'hours').toISOString();

      await supabase
        .from('analysis_cache')
        .upsert({
          ticker,
          analysis_data: analysis,
          expires_at: expiresAt,
          source: 'financial_modeling_prep'
        });
    } catch (error) {
      console.error('Error caching analysis:', error);
      // No lanzar error, el cache es opcional
    }
  }

  /**
   * Obtener datos financieros de API externa
   */
  private async fetchFinancialData(ticker: string): Promise<FinancialData> {
    try {
      const url = `${this.financialApiBaseUrl}/income-statement/${ticker}`;
      const response = await axios.get(url, {
        params: {
          apikey: this.financialApiKey,
          limit: 1
        },
        timeout: 10000
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('No financial data found');
      }

      const data = response.data[0];
      
      // Obtener también balance sheet y cash flow
      const [balanceSheet, cashFlow] = await Promise.all([
        this.fetchBalanceSheet(ticker),
        this.fetchCashFlow(ticker)
      ]);

      return this.mapToFinancialData(ticker, data, balanceSheet, cashFlow);
    } catch (error) {
      console.error('Error fetching financial data:', error);
      throw error;
    }
  }

  /**
   * Obtener balance sheet
   */
  private async fetchBalanceSheet(ticker: string): Promise<any> {
    try {
      const url = `${this.financialApiBaseUrl}/balance-sheet-statement/${ticker}`;
      const response = await axios.get(url, {
        params: {
          apikey: this.financialApiKey,
          limit: 1
        },
        timeout: 10000
      });

      return response.data?.[0] || {};
    } catch (error) {
      console.error('Error fetching balance sheet:', error);
      return {};
    }
  }

  /**
   * Obtener cash flow
   */
  private async fetchCashFlow(ticker: string): Promise<any> {
    try {
      const url = `${this.financialApiBaseUrl}/cash-flow-statement/${ticker}`;
      const response = await axios.get(url, {
        params: {
          apikey: this.financialApiKey,
          limit: 1
        },
        timeout: 10000
      });

      return response.data?.[0] || {};
    } catch (error) {
      console.error('Error fetching cash flow:', error);
      return {};
    }
  }

  /**
   * Obtener datos del año anterior
   */
  private async fetchPriorYearData(ticker: string): Promise<FinancialData | undefined> {
    try {
      const url = `${this.financialApiBaseUrl}/income-statement/${ticker}`;
      const response = await axios.get(url, {
        params: {
          apikey: this.financialApiKey,
          limit: 2 // Obtener 2 años
        },
        timeout: 10000
      });

      if (!response.data || response.data.length < 2) {
        return undefined;
      }

      const priorData = response.data[1]; // Segundo elemento es el año anterior
      
      // Obtener también balance sheet y cash flow del año anterior
      const [balanceSheet, cashFlow] = await Promise.all([
        this.fetchPriorBalanceSheet(ticker),
        this.fetchPriorCashFlow(ticker)
      ]);

      return this.mapToFinancialData(ticker, priorData, balanceSheet, cashFlow);
    } catch (error) {
      console.error('Error fetching prior year data:', error);
      return undefined;
    }
  }

  /**
   * Obtener balance sheet del año anterior
   */
  private async fetchPriorBalanceSheet(ticker: string): Promise<any> {
    try {
      const url = `${this.financialApiBaseUrl}/balance-sheet-statement/${ticker}`;
      const response = await axios.get(url, {
        params: {
          apikey: this.financialApiKey,
          limit: 2
        },
        timeout: 10000
      });

      return response.data?.[1] || {};
    } catch (error) {
      return {};
    }
  }

  /**
   * Obtener cash flow del año anterior
   */
  private async fetchPriorCashFlow(ticker: string): Promise<any> {
    try {
      const url = `${this.financialApiBaseUrl}/cash-flow-statement/${ticker}`;
      const response = await axios.get(url, {
        params: {
          apikey: this.financialApiKey,
          limit: 2
        },
        timeout: 10000
      });

      return response.data?.[1] || {};
    } catch (error) {
      return {};
    }
  }

  /**
   * Mapear datos de API a FinancialData
   */
  private mapToFinancialData(
    ticker: string, 
    incomeStatement: any, 
    balanceSheet: any, 
    cashFlow: any
  ): FinancialData {
    return {
      ticker,
      companyName: incomeStatement.symbol || ticker,
      reportDate: incomeStatement.date || new Date().toISOString(),
      fiscalYear: new Date(incomeStatement.date || Date.now()).getFullYear(),
      currency: incomeStatement.reportedCurrency || 'USD',

      // Estado de Resultados
      revenue: incomeStatement.revenue || 0,
      netIncome: incomeStatement.netIncome || 0,
      grossProfit: incomeStatement.grossProfit || 0,
      operatingIncome: incomeStatement.operatingIncome || 0,
      ebitda: incomeStatement.ebitda || 0,
      interestExpense: incomeStatement.interestExpense || 0,
      incomeTaxExpense: incomeStatement.incomeTaxExpense || 0,
      costOfRevenue: incomeStatement.costOfRevenue || 0,

      // Balance General
      totalAssets: balanceSheet.totalAssets || 0,
      currentAssets: balanceSheet.totalCurrentAssets || 0,
      cashAndCashEquivalents: balanceSheet.cashAndCashEquivalents || 0,
      netReceivables: balanceSheet.netReceivables || 0,
      inventory: balanceSheet.inventory || 0,
      propertyPlantEquipmentNet: balanceSheet.propertyPlantEquipmentNet || 0,

      totalLiabilities: balanceSheet.totalLiabilities || 0,
      currentLiabilities: balanceSheet.totalCurrentLiabilities || 0,
      shortTermDebt: balanceSheet.shortTermDebt || 0,
      accountsPayable: balanceSheet.accountPayables || 0,
      longTermDebt: balanceSheet.longTermDebt || 0,

      shareholdersEquity: balanceSheet.totalStockholdersEquity || 0,
      retainedEarnings: balanceSheet.retainedEarnings || 0,

      // Flujo de Efectivo
      operatingCashFlow: cashFlow.operatingCashFlow || 0,
      freeCashFlow: cashFlow.freeCashFlow || 0,
      capitalExpenditures: Math.abs(cashFlow.capitalExpenditure || 0),

      // Información de acciones
      sharesOutstanding: incomeStatement.weightedAverageShsOut || 0,
      weightedAverageShsOut: incomeStatement.weightedAverageShsOut || 0,

      // Información de mercado (se obtendría de otra API)
      marketCap: 0, // Se calcularía con precio actual * acciones

      // Metadatos
      dataSource: 'financial_modeling_prep',
      lastUpdated: new Date()
    };
  }

  /**
   * Incrementar contador de búsquedas del usuario
   */
  private async incrementUserSearchCount(userId: string): Promise<void> {
    try {
      const supabase = this.supabaseConfig.getServiceClient();
      
      await supabase.rpc('increment_search_count', {
        user_id: userId
      });
    } catch (error) {
      console.error('Error incrementing search count:', error);
      // No lanzar error, es solo para tracking
    }
  }

  /**
   * Registrar uso de API para auditoría
   */
  async logApiUsage(logData: {
    userId?: string;
    ticker?: string;
    endpoint: string;
    apiProvider: string;
    costCredits: number;
    responseStatus: number;
    responseTimeMs: number;
  }): Promise<void> {
    try {
      const supabase = this.supabaseConfig.getServiceClient();
      
      await supabase
        .from('api_usage_log')
        .insert({
          user_id: logData.userId,
          ticker: logData.ticker,
          endpoint: logData.endpoint,
          api_provider: logData.apiProvider,
          cost_credits: logData.costCredits,
          response_status: logData.responseStatus,
          response_time_ms: logData.responseTimeMs
        });
    } catch (error) {
      console.error('Error logging API usage:', error);
      // No lanzar error, es solo para auditoría
    }
  }

  /**
   * Obtener historial de análisis
   */
  async getAnalysisHistory(ticker: string, userId?: string) {
    try {
      const supabase = this.supabaseConfig.getServiceClient();
      
      const { data, error } = await supabase
        .from('analysis_cache')
        .select('analysis_data, created_at')
        .eq('ticker', ticker)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        throw error;
      }

      return data?.map(item => ({
        date: item.created_at,
        fScore: item.analysis_data.fScore,
        zScore: item.analysis_data.zScore,
        mScore: item.analysis_data.mScore
      })) || [];
    } catch (error) {
      console.error('Error getting analysis history:', error);
      return [];
    }
  }

  /**
   * Generar análisis mock para desarrollo/fallback
   */
  private generateMockAnalysis(ticker: string): AnalysisResponse {
    return {
      symbol: ticker,
      name: `${ticker} Corporation`,
      market: ticker.length <= 4 ? 'US' : 'GLOBAL',
      sector: 'Technology',
      fScore: Math.floor(Math.random() * 10),
      zScore: Math.random() * 5,
      mScore: -2 - Math.random() * 2,
      piotroskiCriteria: [],
      historicalScores: [],
      quarterlyScores: [],
      beneishVariables: [],
      sparkline7d: Array.from({ length: 7 }, () => Math.random() * 100),
      aiExplanation: 'Análisis generado con datos simulados para desarrollo.'
    };
  }
}

