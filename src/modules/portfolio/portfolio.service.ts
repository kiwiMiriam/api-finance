import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseConfigService } from '../../config/supabase.config';
import { AnalysisService } from '../analysis/analysis.service';
import type {
  PortfolioItem,
  PortfolioSummary,
  PortfolioResponse,
  AddPortfolioRequest,
  AddPortfolioResponse,
  PortfolioFilters,
  PortfolioAlert,
  PortfolioItemHistory,
} from '../../domain/interfaces/portfolio.interfaces';

@Injectable()
export class PortfolioService {
  constructor(
    private supabaseConfig: SupabaseConfigService,
    private analysisService: AnalysisService,
  ) {}

  /**
   * Obtener cartera completa del usuario
   */
  async getPortfolio(
    userId: string,
    filters?: PortfolioFilters,
  ): Promise<PortfolioResponse> {
    try {
      const supabase = this.supabaseConfig.getServiceClient();
      
      // Construir query base
      let query = supabase
        .from('portfolio')
        .select(`
          *,
          analysis_cache(analysis_data, created_at)
        `)
        .eq('user_id', userId);

      // Aplicar filtros
      if (filters?.sector) {
        query = query.eq('sector', filters.sector);
      }
      if (filters?.riskLevel) {
        query = query.eq('risk_level', filters.riskLevel);
      }
      if (filters?.fraudRisk) {
        query = query.eq('fraud_risk', filters.fraudRisk);
      }

      // Ordenamiento
      const sortBy = filters?.sortBy || 'addedAt';
      const sortOrder = filters?.sortOrder || 'DESC';
      query = query.order(sortBy === 'addedAt' ? 'created_at' : sortBy, { ascending: sortOrder === 'ASC' });

      // Paginación
      const limit = filters?.limit || 20;
      const offset = filters?.offset || 0;
      query = query.range(offset, offset + limit - 1);

      const { data: portfolioData, error, count } = await query;

      if (error) {
        throw new HttpException(
          `Error al obtener cartera: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Procesar datos y calcular métricas
      const items = await this.processPortfolioItems(portfolioData || []);
      const summary = await this.calculatePortfolioSummary(items);

      return {
        items,
        summary,
        pagination: {
          total: count || 0,
          page: Math.floor(offset / limit) + 1,
          limit,
          totalPages: Math.ceil((count || 0) / limit),
        },
      };
    } catch (error) {
      console.error('Error in getPortfolio:', error);
      throw new HttpException(
        'Error interno del servidor',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Obtener resumen/KPIs de la cartera
   */
  async getPortfolioSummary(userId: string): Promise<PortfolioSummary> {
    try {
      const portfolio = await this.getPortfolio(userId);
      return portfolio.summary;
    } catch (error) {
      console.error('Error in getPortfolioSummary:', error);
      throw new HttpException(
        'Error al calcular resumen de cartera',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Agregar activo a la cartera
   */
  async addToPortfolio(
    userId: string,
    request: AddPortfolioRequest,
  ): Promise<AddPortfolioResponse> {
    try {
      const supabase = this.supabaseConfig.getServiceClient();
      
      // Verificar si el ticker ya existe en la cartera
      const { data: existing } = await supabase
        .from('portfolio')
        .select('id')
        .eq('user_id', userId)
        .eq('ticker', request.ticker.toUpperCase())
        .single();

      if (existing) {
        return {
          success: false,
          message: `${request.ticker} ya está en tu cartera`,
        };
      }

      // Obtener análisis del ticker para validar que existe
      let analysisData;
      try {
        analysisData = await this.analysisService.analyzeCompany(request.ticker, userId);
      } catch (error) {
        return {
          success: false,
          message: `No se pudo analizar ${request.ticker}. Verifica que el ticker sea válido.`,
        };
      }

      // Obtener información adicional de la empresa
      const companyInfo = await this.getCompanyInfo(request.ticker);

      // Calcular nivel de riesgo
      const riskLevel = this.calculateRiskLevel(analysisData.zScore);
      const fraudRisk = this.calculateFraudRisk(analysisData.mScore);

      // Insertar en la cartera
      const { data: portfolioItem, error } = await supabase
        .from('portfolio')
        .insert({
          user_id: userId,
          ticker: request.ticker.toUpperCase(),
          company_name: companyInfo.name,
          sector: companyInfo.sector,
          industry: companyInfo.industry,
          market_cap: companyInfo.marketCap,
          f_score: analysisData.fScore,
          z_score: analysisData.zScore,
          m_score: analysisData.mScore,
          risk_level: riskLevel,
          fraud_risk: fraudRisk,
          notes: request.notes,
          current_price: companyInfo.currentPrice,
          sparkline_7d: companyInfo.sparkline7d,
        } as any)
        .select()
        .single();

      if (error) {
        throw new HttpException(
          `Error al agregar a cartera: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      const item = await this.processPortfolioItem(portfolioItem);

      return {
        success: true,
        message: `${request.ticker} agregado exitosamente a tu cartera`,
        item,
      };
    } catch (error) {
      console.error('Error in addToPortfolio:', error);
      throw new HttpException(
        'Error al agregar activo a la cartera',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Eliminar activo de la cartera
   */
  async removeFromPortfolio(userId: string, ticker: string): Promise<{ success: boolean; message: string }> {
    try {
      const supabase = this.supabaseConfig.getServiceClient();
      
      const { error } = await supabase
        .from('portfolio')
        .delete()
        .eq('user_id', userId)
        .eq('ticker', ticker.toUpperCase());

      if (error) {
        throw new HttpException(
          `Error al eliminar de cartera: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return {
        success: true,
        message: `${ticker} eliminado de tu cartera`,
      };
    } catch (error) {
      console.error('Error in removeFromPortfolio:', error);
      throw new HttpException(
        'Error al eliminar activo de la cartera',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Obtener historial de un activo en cartera
   */
  async getPortfolioItemHistory(userId: string, ticker: string): Promise<PortfolioItemHistory> {
    try {
      // Verificar que el activo esté en la cartera del usuario
      const supabase = this.supabaseConfig.getServiceClient();
      
      const { data: portfolioItem } = await supabase
        .from('portfolio')
        .select('id')
        .eq('user_id', userId)
        .eq('ticker', ticker.toUpperCase())
        .single();

      if (!portfolioItem) {
        throw new HttpException(
          `${ticker} no está en tu cartera`,
          HttpStatus.NOT_FOUND,
        );
      }

      // Obtener historial de análisis
      const history = await this.analysisService.getAnalysisHistory(ticker, userId);

      return {
        ticker: ticker.toUpperCase(),
        history: history.map((item: any) => ({
          date: item.date,
          fScore: item.fScore,
          zScore: item.zScore,
          mScore: item.mScore,
          price: item.price || 0, // TODO: Agregar datos de precio histórico
        })),
      };
    } catch (error) {
      console.error('Error in getPortfolioItemHistory:', error);
      throw new HttpException(
        'Error al obtener historial del activo',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Procesar items de cartera para agregar datos calculados
   */
  private async processPortfolioItems(rawData: any[]): Promise<PortfolioItem[]> {
    return Promise.all(rawData.map(item => this.processPortfolioItem(item)));
  }

  /**
   * Procesar un item individual de cartera
   */
  private async processPortfolioItem(rawItem: any): Promise<PortfolioItem> {
    // Obtener datos de precio actuales (mock por ahora)
    const priceData = await this.getCurrentPriceData(rawItem.ticker);

    return {
      id: rawItem.id,
      ticker: rawItem.ticker,
      companyName: rawItem.company_name,
      sector: rawItem.sector,
      industry: rawItem.industry,
      marketCap: rawItem.market_cap,
      fScore: rawItem.f_score,
      zScore: rawItem.z_score,
      mScore: rawItem.m_score,
      sparkline7d: rawItem.sparkline_7d || priceData.sparkline7d,
      currentPrice: priceData.currentPrice,
      priceChange24h: priceData.priceChange24h,
      priceChangePercent24h: priceData.priceChangePercent24h,
      addedAt: rawItem.created_at,
      lastAnalyzed: rawItem.updated_at,
      riskLevel: rawItem.risk_level,
      fraudRisk: rawItem.fraud_risk,
    };
  }

  /**
   * Calcular resumen de cartera
   */
  private async calculatePortfolioSummary(items: PortfolioItem[]): Promise<PortfolioSummary> {
    if (items.length === 0) {
      return {
        avgFScore: 0,
        riskExposure: 0,
        manipulationAlerts: 0,
        totalAssets: 0,
        sectorDistribution: [],
        riskDistribution: { low: 0, medium: 0, high: 0, critical: 0 },
        trends: { fScoreTrend: 'STABLE', riskTrend: 'STABLE' },
      };
    }

    // Calcular KPIs principales
    const avgFScore = items.reduce((sum, item) => sum + item.fScore, 0) / items.length;
    const riskExposure = (items.filter(item => item.zScore < 1.81).length / items.length) * 100;
    const manipulationAlerts = items.filter(item => item.mScore > -1.78).length;

    // Distribución por sectores
    const sectorMap = new Map<string, { count: number; totalFScore: number }>();
    items.forEach(item => {
      const sector = item.sector || 'Unknown';
      const current = sectorMap.get(sector) || { count: 0, totalFScore: 0 };
      sectorMap.set(sector, {
        count: current.count + 1,
        totalFScore: current.totalFScore + item.fScore,
      });
    });

    const sectorDistribution = Array.from(sectorMap.entries()).map(([sector, data]) => ({
      sector,
      count: data.count,
      percentage: (data.count / items.length) * 100,
      avgFScore: data.totalFScore / data.count,
    }));

    // Distribución por riesgo
    const riskDistribution = {
      low: items.filter(item => item.riskLevel === 'LOW').length,
      medium: items.filter(item => item.riskLevel === 'MEDIUM').length,
      high: items.filter(item => item.riskLevel === 'HIGH').length,
      critical: items.filter(item => item.riskLevel === 'CRITICAL').length,
    };

    return {
      avgFScore: Math.round(avgFScore * 100) / 100,
      riskExposure: Math.round(riskExposure * 100) / 100,
      manipulationAlerts,
      totalAssets: items.length,
      sectorDistribution,
      riskDistribution,
      trends: {
        fScoreTrend: 'STABLE', // TODO: Calcular tendencia real
        riskTrend: 'STABLE', // TODO: Calcular tendencia real
      },
    };
  }

  /**
   * Calcular nivel de riesgo basado en Z-Score
   */
  private calculateRiskLevel(zScore: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (zScore > 2.99) return 'LOW';
    if (zScore > 1.81) return 'MEDIUM';
    if (zScore > 1.23) return 'HIGH';
    return 'CRITICAL';
  }

  /**
   * Calcular riesgo de fraude basado en M-Score
   */
  private calculateFraudRisk(mScore: number): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (mScore < -2.22) return 'LOW';
    if (mScore < -1.78) return 'MEDIUM';
    return 'HIGH';
  }

  /**
   * Obtener información de la empresa (mock por ahora)
   */
  private async getCompanyInfo(ticker: string): Promise<{
    name: string;
    sector: string;
    industry: string;
    marketCap: number;
    currentPrice: number;
    sparkline7d: number[];
  }> {
    // TODO: Integrar con API real para obtener datos de empresa
    return {
      name: `${ticker} Inc.`,
      sector: 'Technology',
      industry: 'Software',
      marketCap: 1000000000,
      currentPrice: 150.0,
      sparkline7d: [145, 147, 149, 148, 150, 152, 150],
    };
  }

  /**
   * Obtener datos de precio actuales (mock por ahora)
   */
  private async getCurrentPriceData(ticker: string): Promise<{
    currentPrice: number;
    priceChange24h: number;
    priceChangePercent24h: number;
    sparkline7d: number[];
  }> {
    // TODO: Integrar con API real para obtener datos de precio
    return {
      currentPrice: 150.0,
      priceChange24h: 2.5,
      priceChangePercent24h: 1.69,
      sparkline7d: [145, 147, 149, 148, 150, 152, 150],
    };
  }
}
