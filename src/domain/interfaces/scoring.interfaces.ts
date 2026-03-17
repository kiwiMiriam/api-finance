/**
 * Interfaces para el sistema de scoring financiero
 * Siguiendo los contratos definidos en el README del frontend
 */

// =================================
// INTERFACES PRINCIPALES
// =================================

export interface FinancialData {
  ticker: string;
  companyName: string;
  reportDate: string;
  fiscalYear: number;
  currency: string;

  // Estado de Resultados
  revenue: number;
  netIncome: number;
  grossProfit: number;
  operatingIncome: number;
  ebitda: number;
  interestExpense: number;
  incomeTaxExpense: number;
  costOfRevenue: number;
  researchAndDevelopmentExpenses: number;
  sellingGeneralAndAdministrativeExpenses: number;

  // Balance General - Activos
  totalAssets: number;
  currentAssets: number;
  cashAndCashEquivalents: number;
  shortTermInvestments: number;
  netReceivables: number;
  inventory: number;
  totalNonCurrentAssets: number;
  propertyPlantEquipmentNet: number;
  goodwill: number;
  intangibleAssets: number;

  // Balance General - Pasivos
  totalLiabilities: number;
  currentLiabilities: number;
  shortTermDebt: number;
  accountsPayable: number;
  longTermDebt: number;
  totalNonCurrentLiabilities: number;

  // Balance General - Patrimonio
  shareholdersEquity: number;
  retainedEarnings: number;
  commonStock: number;

  // Flujo de Efectivo
  operatingCashFlow: number;
  freeCashFlow: number;
  capitalExpenditures: number;
  investingCashFlow: number;
  financingCashFlow: number;

  // Información de acciones
  sharesOutstanding: number;
  weightedAverageShsOut: number;

  // Información de mercado
  marketCap: number;
  enterpriseValue: number;

  // Metadatos
  dataSource: string;
  lastUpdated: Date;
}

// =================================
// PIOTROSKI F-SCORE INTERFACES
// =================================

export interface PiotroskiCriterion {
  name: string;
  description: string;
  value: number;
  threshold: number;
  passed: boolean;
  points: number; // 0 o 1
  category: 'profitability' | 'leverage' | 'efficiency';
}

export interface PiotroskiScore {
  totalScore: number; // 0-9
  maxScore: number; // 9
  interpretation: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  criteria: PiotroskiCriterion[];
  summary: {
    profitability: number; // 0-4
    leverage: number; // 0-3
    efficiency: number; // 0-2
  };
}

// =================================
// ALTMAN Z-SCORE INTERFACES
// =================================

export interface AltmanComponent {
  name: string;
  description: string;
  value: number;
  coefficient: number;
  contribution: number;
}

export interface AltmanZScore {
  totalScore: number;
  interpretation: 'SAFE' | 'GREY_ZONE' | 'DISTRESS';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  companyType: 'MANUFACTURING' | 'NON_MANUFACTURING';
  components: AltmanComponent[];
  thresholds: {
    safe: number;
    greyZone: number;
    distress: number;
  };
}

// =================================
// BENEISH M-SCORE INTERFACES
// =================================

export interface BeneishVariable {
  name: string;
  description: string;
  value: number;
  threshold: number;
  flagged: boolean; // true si supera el umbral
  contribution: number;
  interpretation: string;
}

export interface BeneishMScore {
  totalScore: number;
  interpretation: 'LOW_RISK' | 'MODERATE_RISK' | 'HIGH_RISK';
  manipulationProbability: number; // 0-100%
  variables: BeneishVariable[];
  flaggedCount: number; // Cantidad de variables que superan el umbral
  threshold: number; // -1.78
}

// =================================
// ANÁLISIS CONSOLIDADO
// =================================

export interface ConsolidatedAnalysis {
  ticker: string;
  companyName: string;
  sector?: string;
  
  // Scores individuales
  piotroskiScore: PiotroskiScore;
  altmanZScore: AltmanZScore;
  beneishMScore: BeneishMScore;
  
  // Evaluación general
  overallRating: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  
  // Explicación generada por IA
  aiExplanation: string;
  
  // Metadatos
  calculatedAt: Date;
  dataSource: string;
  
  // Datos adicionales para el frontend
  sparkline7d?: number[]; // Para gráficos de tendencia
  lastAnalysis?: Date;
}

// =================================
// INTERFACES PARA ANÁLISIS MANUAL
// =================================

export interface ManualAnalysisRequest {
  ticker: string;
  companyName: string;
  
  // Datos mínimos requeridos
  revenue: number;
  netIncome: number;
  totalAssets: number;
  currentAssets: number;
  currentLiabilities: number;
  longTermDebt: number;
  shareholdersEquity: number;
  operatingCashFlow: number;
  
  // Datos opcionales (se estimarán si faltan)
  grossProfit?: number;
  operatingIncome?: number;
  ebitda?: number;
  marketCap?: number;
  sharesOutstanding?: number;
  retainedEarnings?: number;
  workingCapital?: number;
  
  // Metadatos
  reportDate?: string;
  fiscalYear?: number;
  currency?: string;
  sector?: string;
}

// =================================
// INTERFACES PARA ALERTAS
// =================================

export interface FraudAlert {
  id: string;
  ticker: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  indicator: string; // DSRI, GMI, AQI, etc.
  value: number;
  threshold: number;
  message: string;
  timestamp: Date;
}

export interface RadarData {
  ticker: string;
  companyName: string;
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
  thresholds: {
    DSRI: number;
    GMI: number;
    AQI: number;
    SGI: number;
    DEPI: number;
    SGAI: number;
    TATA: number;
    LVGI: number;
  };
  overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

// =================================
// INTERFACES PARA PORTFOLIO
// =================================

export interface PortfolioItem {
  ticker: string;
  sector: string;
  fScore: number;
  zScore: number;
  mScore: number;
  overallRating: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  addedAt: Date;
  lastAnalysis: Date;
  sparkline7d: number[];
}

export interface PortfolioSummary {
  totalAssets: number;
  avgFScore: number;
  riskExposure: number; // % de activos con Z-Score < 1.81
  manipulationAlerts: number; // Conteo de activos con M-Score > -1.78
  sectorDistribution: Record<string, number>;
  ratingDistribution: Record<string, number>;
}

// =================================
// INTERFACES PARA CACHÉ Y AUDITORÍA
// =================================

export interface CacheEntry {
  ticker: string;
  analysis: ConsolidatedAnalysis;
  createdAt: Date;
  expiresAt: Date;
  source: string;
}

export interface ApiUsageLog {
  userId?: string;
  ticker?: string;
  endpoint: string;
  apiProvider: string;
  costCredits: number;
  responseStatus: number;
  responseTimeMs: number;
  timestamp: Date;
}

// =================================
// TIPOS DE UTILIDAD
// =================================

export type CompanyType = 'MANUFACTURING' | 'NON_MANUFACTURING';
export type UserTier = 'free' | 'premium' | 'enterprise';
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type OverallRating = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// =================================
// CONSTANTES
// =================================

export const PIOTROSKI_THRESHOLDS = {
  EXCELLENT: 8, // 8-9 puntos
  GOOD: 6,      // 6-7 puntos
  FAIR: 4,      // 4-5 puntos
  POOR: 0       // 0-3 puntos
} as const;

export const ALTMAN_THRESHOLDS = {
  MANUFACTURING: {
    SAFE: 2.99,
    GREY_ZONE: 1.81,
    DISTRESS: 0
  },
  NON_MANUFACTURING: {
    SAFE: 2.6,
    GREY_ZONE: 1.1,
    DISTRESS: 0
  }
} as const;

export const BENEISH_THRESHOLD = -1.78;

export const BENEISH_VARIABLE_THRESHOLDS = {
  DSRI: 1.031,
  GMI: 1.014,
  AQI: 1.031,
  SGI: 1.134,
  DEPI: 1.077,
  SGAI: 1.054,
  TATA: 0.018,
  LVGI: 1.111
} as const;
