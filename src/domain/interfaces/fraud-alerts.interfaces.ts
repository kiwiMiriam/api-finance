/**
 * Interfaces para el módulo de Alertas de Fraude
 */

/**
 * Alerta de fraude individual
 */
export interface FraudAlert {
  id: string;
  ticker: string;
  companyName: string;
  timestamp: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  indicator: 'DSRI' | 'GMI' | 'AQI' | 'SGI' | 'DEPI' | 'SGAI' | 'TATA' | 'LVGI' | 'OVERALL_MSCORE';
  value: number;
  threshold: number;
  message: string;
  isRead: boolean;
  userId?: string;
}

/**
 * Datos del radar de 8 variables del M-Score
 */
export interface RadarData {
  ticker: string;
  companyName: string;
  lastUpdated: string;
  overallMScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  variables: {
    DSRI: RadarVariable;
    GMI: RadarVariable;
    AQI: RadarVariable;
    SGI: RadarVariable;
    DEPI: RadarVariable;
    SGAI: RadarVariable;
    TATA: RadarVariable;
    LVGI: RadarVariable;
  };
}

/**
 * Variable individual del radar
 */
export interface RadarVariable {
  name: string;
  description: string;
  value: number;
  normalizedValue: number; // Para el gráfico de radar (0-100)
  threshold: number;
  status: 'NORMAL' | 'WARNING' | 'ALERT';
  interpretation: string;
}

/**
 * Explicación generada por IA
 */
export interface ExplanationResponse {
  ticker: string;
  companyName: string;
  summary: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  keyFindings: string[];
  recommendations: string[];
  detailedAnalysis: {
    strengths: string[];
    concerns: string[];
    redFlags: string[];
  };
  confidence: number; // 0-100
  lastUpdated: string;
}

/**
 * Configuración de alertas del usuario
 */
export interface AlertSettings {
  id: string;
  userId: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  thresholds: {
    mScoreThreshold: number; // Default: -1.78
    dsriThreshold: number;
    gmiThreshold: number;
    aqiThreshold: number;
    sgiThreshold: number;
    depiThreshold: number;
    sgaiThreshold: number;
    tataThreshold: number;
    lvgiThreshold: number;
  };
  watchedTickers: string[];
}

/**
 * Estadísticas de alertas
 */
export interface AlertStats {
  totalAlerts: number;
  unreadAlerts: number;
  alertsBySeverity: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  alertsByIndicator: {
    DSRI: number;
    GMI: number;
    AQI: number;
    SGI: number;
    DEPI: number;
    SGAI: number;
    TATA: number;
    LVGI: number;
    OVERALL_MSCORE: number;
  };
  trendsLast30Days: {
    date: string;
    count: number;
  }[];
}

/**
 * Request para obtener alertas con filtros
 */
export interface AlertsRequest {
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  indicator?: 'DSRI' | 'GMI' | 'AQI' | 'SGI' | 'DEPI' | 'SGAI' | 'TATA' | 'LVGI' | 'OVERALL_MSCORE';
  ticker?: string;
  isRead?: boolean;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

/**
 * Response paginada de alertas
 */
export interface AlertsResponse {
  alerts: FraudAlert[];
  stats: AlertStats;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Datos históricos de M-Score para tendencias
 */
export interface MScoreHistory {
  ticker: string;
  history: {
    date: string;
    mScore: number;
    variables: {
      DSRI: number;
      GMI: number;
      AQI: number;
      SGI: number;
      DEPI: number;
      SGAI: number;
      TATA: number;
      LVGI: number;
    };
  }[];
}

/**
 * Análisis comparativo de industria
 */
export interface IndustryComparison {
  ticker: string;
  sector: string;
  industry: string;
  companyMScore: number;
  industryStats: {
    averageMScore: number;
    medianMScore: number;
    percentile: number; // Percentil de la empresa en la industria
    totalCompanies: number;
  };
  peerComparison: {
    ticker: string;
    companyName: string;
    mScore: number;
  }[];
}
