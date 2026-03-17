/**
 * Interfaces para análisis financiero
 * Siguiendo exactamente los contratos del README del frontend
 */

// =================================
// CONTRATOS EXACTOS DEL FRONTEND
// =================================

export interface AnalysisResponse {
  symbol: string;
  name: string;
  market: "US" | "PE" | "GLOBAL";
  sector: string;
  fScore: number;              // 0-9
  zScore: number;              // float
  mScore: number;              // float (negative = safe)
  piotroskiCriteria: {
    id: number;
    category: "Rentabilidad" | "Apalancamiento" | "Eficiencia";
    name: string;
    passed: boolean;
    description: string;
    formula: string;
    value: string;
  }[];
  historicalScores: { year: number; fScore: number; zScore: number; mScore: number }[];
  quarterlyScores: { quarter: string; fScore: number; zScore: number; mScore: number }[];
  beneishVariables: {
    key: string;               // DSRI, GMI, AQI, SGI, DEPI, SGAI, TATA, LVGI
    name: string;
    value: number;
    description: string;
    flagged: boolean;
    threshold: string;
  }[];
  sparkline7d: number[];
  aiExplanation: string;
}

export interface ManualAnalysisRequest {
  companyName: string;
  netIncome: number;
  totalAssets: number;
  totalAssetsPrior: number;
  operatingCashFlow: number;
  longTermDebt: number;
  longTermDebtPrior: number;
  currentAssets: number;
  currentLiabilities: number;
  currentAssetsPrior: number;
  currentLiabilitiesPrior: number;
  grossProfit: number;
  grossProfitPrior: number;
  totalRevenue: number;
  totalRevenuePrior: number;
  sharesOutstanding: number;
  sharesOutstandingPrior: number;
}

// =================================
// INTERFACES INTERNAS PARA CÁLCULOS
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

  // Balance General - Activos
  totalAssets: number;
  currentAssets: number;
  cashAndCashEquivalents: number;
  netReceivables: number;
  inventory: number;
  propertyPlantEquipmentNet: number;

  // Balance General - Pasivos
  totalLiabilities: number;
  currentLiabilities: number;
  shortTermDebt: number;
  accountsPayable: number;
  longTermDebt: number;

  // Balance General - Patrimonio
  shareholdersEquity: number;
  retainedEarnings: number;

  // Flujo de Efectivo
  operatingCashFlow: number;
  freeCashFlow: number;
  capitalExpenditures: number;

  // Información de acciones
  sharesOutstanding: number;
  weightedAverageShsOut: number;

  // Información de mercado
  marketCap: number;

  // Datos del año anterior (para cálculos de Beneish)
  totalAssetsPrior?: number;
  longTermDebtPrior?: number;
  currentAssetsPrior?: number;
  currentLiabilitiesPrior?: number;
  grossProfitPrior?: number;
  totalRevenuePrior?: number;
  sharesOutstandingPrior?: number;

  // Metadatos
  dataSource: string;
  lastUpdated: Date;
}

// =================================
// PIOTROSKI F-SCORE
// =================================

export interface PiotroskiCriterion {
  id: number;
  category: "Rentabilidad" | "Apalancamiento" | "Eficiencia";
  name: string;
  passed: boolean;
  description: string;
  formula: string;
  value: string;
}

export interface PiotroskiScore {
  totalScore: number; // 0-9
  criteria: PiotroskiCriterion[];
}

// =================================
// ALTMAN Z-SCORE
// =================================

export interface AltmanComponent {
  name: string;
  value: number;
  coefficient: number;
  contribution: number;
}

export interface AltmanZScore {
  totalScore: number;
  interpretation: 'SAFE' | 'GREY_ZONE' | 'DISTRESS';
  components: AltmanComponent[];
}

// =================================
// BENEISH M-SCORE
// =================================

export interface BeneishVariable {
  key: string; // DSRI, GMI, AQI, SGI, DEPI, SGAI, TATA, LVGI
  name: string;
  value: number;
  description: string;
  flagged: boolean;
  threshold: string;
}

export interface BeneishMScore {
  totalScore: number;
  variables: BeneishVariable[];
}

// =================================
// TIPOS DE UTILIDAD
// =================================

export type MarketType = "US" | "PE" | "GLOBAL";
export type TierPlan = 'free' | 'pro' | 'enterprise';
export type AppRole = 'admin' | 'moderator' | 'user';

// =================================
// CONSTANTES
// =================================

export const PIOTROSKI_CRITERIA = [
  // Rentabilidad (4 criterios)
  {
    id: 1,
    category: "Rentabilidad" as const,
    name: "Utilidad Neta Positiva",
    description: "La empresa debe tener utilidades positivas en el último año fiscal",
    formula: "Utilidad Neta > 0"
  },
  {
    id: 2,
    category: "Rentabilidad" as const,
    name: "ROA Positivo",
    description: "El retorno sobre activos debe ser positivo",
    formula: "ROA = Utilidad Neta / Activos Totales > 0"
  },
  {
    id: 3,
    category: "Rentabilidad" as const,
    name: "Flujo de Efectivo Operativo Positivo",
    description: "La empresa debe generar flujo de efectivo positivo de sus operaciones",
    formula: "Flujo de Efectivo Operativo > 0"
  },
  {
    id: 4,
    category: "Rentabilidad" as const,
    name: "Calidad de las Ganancias",
    description: "El flujo de efectivo operativo debe ser mayor que la utilidad neta",
    formula: "Flujo de Efectivo Operativo > Utilidad Neta"
  },
  // Apalancamiento (3 criterios)
  {
    id: 5,
    category: "Apalancamiento" as const,
    name: "Reducción de Deuda a Largo Plazo",
    description: "La deuda a largo plazo debe haber disminuido respecto al año anterior",
    formula: "Deuda LP (actual) < Deuda LP (anterior)"
  },
  {
    id: 6,
    category: "Apalancamiento" as const,
    name: "Mejora en Liquidez Corriente",
    description: "La razón corriente debe haber mejorado respecto al año anterior",
    formula: "Razón Corriente (actual) > Razón Corriente (anterior)"
  },
  {
    id: 7,
    category: "Apalancamiento" as const,
    name: "Sin Emisión de Acciones",
    description: "No debe haber emisión de nuevas acciones (dilución)",
    formula: "Acciones en Circulación (actual) ≤ Acciones en Circulación (anterior)"
  },
  // Eficiencia (2 criterios)
  {
    id: 8,
    category: "Eficiencia" as const,
    name: "Mejora en Margen Bruto",
    description: "El margen bruto debe haber mejorado respecto al año anterior",
    formula: "Margen Bruto (actual) > Margen Bruto (anterior)"
  },
  {
    id: 9,
    category: "Eficiencia" as const,
    name: "Mejora en Rotación de Activos",
    description: "La rotación de activos debe haber mejorado respecto al año anterior",
    formula: "Rotación de Activos (actual) > Rotación de Activos (anterior)"
  }
];

export const BENEISH_VARIABLES_INFO = [
  {
    key: "DSRI",
    name: "Days Sales in Receivables Index",
    description: "Mide si las cuentas por cobrar están creciendo más rápido que las ventas",
    threshold: "1.031"
  },
  {
    key: "GMI",
    name: "Gross Margin Index",
    description: "Compara el margen bruto del año anterior con el actual",
    threshold: "1.014"
  },
  {
    key: "AQI",
    name: "Asset Quality Index",
    description: "Mide la proporción de activos no corrientes distintos de PPE",
    threshold: "1.031"
  },
  {
    key: "SGI",
    name: "Sales Growth Index",
    description: "Mide el crecimiento de las ventas año a año",
    threshold: "1.134"
  },
  {
    key: "DEPI",
    name: "Depreciation Index",
    description: "Compara la tasa de depreciación del año anterior con la actual",
    threshold: "1.077"
  },
  {
    key: "SGAI",
    name: "Sales General and Administrative Expenses Index",
    description: "Mide el crecimiento de los gastos SG&A relativos a las ventas",
    threshold: "1.054"
  },
  {
    key: "TATA",
    name: "Total Accruals to Total Assets",
    description: "Mide la proporción de acumulaciones totales sobre activos totales",
    threshold: "0.018"
  },
  {
    key: "LVGI",
    name: "Leverage Index",
    description: "Compara el apalancamiento del año anterior con el actual",
    threshold: "1.111"
  }
];

export const ALTMAN_COEFFICIENTS = {
  MANUFACTURING: {
    WORKING_CAPITAL_TO_TOTAL_ASSETS: 1.2,
    RETAINED_EARNINGS_TO_TOTAL_ASSETS: 1.4,
    EBIT_TO_TOTAL_ASSETS: 3.3,
    MARKET_VALUE_EQUITY_TO_BOOK_VALUE_DEBT: 0.6,
    SALES_TO_TOTAL_ASSETS: 1.0
  },
  NON_MANUFACTURING: {
    WORKING_CAPITAL_TO_TOTAL_ASSETS: 6.56,
    RETAINED_EARNINGS_TO_TOTAL_ASSETS: 3.26,
    EBIT_TO_TOTAL_ASSETS: 6.72,
    MARKET_VALUE_EQUITY_TO_BOOK_VALUE_DEBT: 1.05,
    SALES_TO_TOTAL_ASSETS: 0.0 // No se usa en no manufactureras
  }
};

export const ALTMAN_THRESHOLDS = {
  MANUFACTURING: {
    SAFE: 2.99,
    GREY_ZONE: 1.81
  },
  NON_MANUFACTURING: {
    SAFE: 2.6,
    GREY_ZONE: 1.1
  }
};

export const BENEISH_THRESHOLD = -1.78;
