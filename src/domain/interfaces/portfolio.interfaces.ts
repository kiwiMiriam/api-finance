/**
 * Interfaces para el módulo de Portfolio/Cartera
 */

/**
 * Item individual de la cartera
 */
export interface PortfolioItem {
  id: string;
  ticker: string;
  companyName: string;
  sector: string;
  industry?: string;
  marketCap?: number;
  
  // Scores financieros
  fScore: number;
  zScore: number;
  mScore: number;
  
  // Datos de precio para sparkline
  sparkline7d: number[];
  currentPrice: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  
  // Metadatos
  addedAt: string;
  lastAnalyzed: string;
  
  // Clasificaciones de riesgo
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  fraudRisk: 'LOW' | 'MEDIUM' | 'HIGH';
}

/**
 * Resumen/KPIs de la cartera
 */
export interface PortfolioSummary {
  // KPIs principales
  avgFScore: number;
  riskExposure: number; // % de activos con Z-Score < 1.81
  manipulationAlerts: number; // Conteo de activos con M-Score > -1.78
  
  // Estadísticas adicionales
  totalAssets: number;
  totalValue?: number;
  
  // Distribución por sectores
  sectorDistribution: {
    sector: string;
    count: number;
    percentage: number;
    avgFScore: number;
  }[];
  
  // Distribución por riesgo
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  
  // Tendencias
  trends: {
    fScoreTrend: 'UP' | 'DOWN' | 'STABLE';
    riskTrend: 'IMPROVING' | 'WORSENING' | 'STABLE';
  };
}

/**
 * Request para agregar activo a la cartera
 */
export interface AddPortfolioRequest {
  ticker: string;
  notes?: string;
}

/**
 * Response al agregar activo
 */
export interface AddPortfolioResponse {
  success: boolean;
  message: string;
  item?: PortfolioItem;
}

/**
 * Request para actualizar activo en cartera
 */
export interface UpdatePortfolioRequest {
  notes?: string;
  alertsEnabled?: boolean;
}

/**
 * Configuración de alertas para un activo
 */
export interface PortfolioAlert {
  id: string;
  ticker: string;
  alertType: 'FSCORE_DROP' | 'ZSCORE_CRITICAL' | 'MSCORE_FRAUD' | 'PRICE_CHANGE';
  threshold: number;
  isActive: boolean;
  lastTriggered?: string;
  message: string;
}

/**
 * Datos históricos de un activo en cartera
 */
export interface PortfolioItemHistory {
  ticker: string;
  history: {
    date: string;
    fScore: number;
    zScore: number;
    mScore: number;
    price: number;
  }[];
}

/**
 * Filtros para consultar cartera
 */
export interface PortfolioFilters {
  sector?: string;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  fraudRisk?: 'LOW' | 'MEDIUM' | 'HIGH';
  minFScore?: number;
  maxFScore?: number;
  sortBy?: 'ticker' | 'fScore' | 'zScore' | 'mScore' | 'addedAt' | 'riskLevel';
  sortOrder?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

/**
 * Response paginada de cartera
 */
export interface PortfolioResponse {
  items: PortfolioItem[];
  summary: PortfolioSummary;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
