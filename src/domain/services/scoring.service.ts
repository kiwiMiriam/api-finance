import { Injectable } from '@nestjs/common';
import {
  FinancialData,
  AnalysisResponse,
  ManualAnalysisRequest,
  PiotroskiScore,
  AltmanZScore,
  BeneishMScore,
  PIOTROSKI_CRITERIA,
  BENEISH_VARIABLES_INFO,
  ALTMAN_COEFFICIENTS,
  ALTMAN_THRESHOLDS,
  BENEISH_THRESHOLD
} from '../interfaces/analysis.interfaces';

/**
 * Servicio de scoring financiero refactorizado
 * Implementa los cálculos exactos de Piotroski, Altman y Beneish
 */
@Injectable()
export class ScoringService {

  /**
   * Calcular Piotroski F-Score (0-9)
   */
  calculatePiotroskiFScore(data: FinancialData, priorData?: FinancialData): PiotroskiScore {
    const criteria = PIOTROSKI_CRITERIA.map(criterion => {
      let passed = false;
      let value = '';

      switch (criterion.id) {
        case 1: // Utilidad Neta Positiva
          passed = data.netIncome > 0;
          value = data.netIncome.toLocaleString();
          break;

        case 2: // ROA Positivo
          const roa = data.netIncome / data.totalAssets;
          passed = roa > 0;
          value = (roa * 100).toFixed(2) + '%';
          break;

        case 3: // Flujo de Efectivo Operativo Positivo
          passed = data.operatingCashFlow > 0;
          value = data.operatingCashFlow.toLocaleString();
          break;

        case 4: // Calidad de las Ganancias
          passed = data.operatingCashFlow > data.netIncome;
          value = `FCO: ${data.operatingCashFlow.toLocaleString()} vs UN: ${data.netIncome.toLocaleString()}`;
          break;

        case 5: // Reducción de Deuda a Largo Plazo
          if (priorData && priorData.longTermDebt !== undefined) {
            passed = data.longTermDebt < priorData.longTermDebt;
            value = `${data.longTermDebt.toLocaleString()} < ${priorData.longTermDebt.toLocaleString()}`;
          } else {
            passed = false;
            value = 'Datos del año anterior no disponibles';
          }
          break;

        case 6: // Mejora en Liquidez Corriente
          if (priorData && priorData.currentAssets && priorData.currentLiabilities) {
            const currentRatio = data.currentAssets / data.currentLiabilities;
            const priorCurrentRatio = priorData.currentAssets / priorData.currentLiabilities;
            passed = currentRatio > priorCurrentRatio;
            value = `${currentRatio.toFixed(2)} > ${priorCurrentRatio.toFixed(2)}`;
          } else {
            passed = false;
            value = 'Datos del año anterior no disponibles';
          }
          break;

        case 7: // Sin Emisión de Acciones
          if (priorData && priorData.sharesOutstanding) {
            passed = data.sharesOutstanding <= priorData.sharesOutstanding;
            value = `${data.sharesOutstanding.toLocaleString()} ≤ ${priorData.sharesOutstanding.toLocaleString()}`;
          } else {
            passed = false;
            value = 'Datos del año anterior no disponibles';
          }
          break;

        case 8: // Mejora en Margen Bruto
          if (priorData && priorData.grossProfit && priorData.revenue) {
            const grossMargin = data.grossProfit / data.revenue;
            const priorGrossMargin = priorData.grossProfit / priorData.revenue;
            passed = grossMargin > priorGrossMargin;
            value = `${(grossMargin * 100).toFixed(2)}% > ${(priorGrossMargin * 100).toFixed(2)}%`;
          } else {
            passed = false;
            value = 'Datos del año anterior no disponibles';
          }
          break;

        case 9: // Mejora en Rotación de Activos
          if (priorData && priorData.totalAssets) {
            const assetTurnover = data.revenue / data.totalAssets;
            const priorAssetTurnover = priorData.revenue / priorData.totalAssets;
            passed = assetTurnover > priorAssetTurnover;
            value = `${assetTurnover.toFixed(2)} > ${priorAssetTurnover.toFixed(2)}`;
          } else {
            passed = false;
            value = 'Datos del año anterior no disponibles';
          }
          break;
      }

      return {
        id: criterion.id,
        category: criterion.category,
        name: criterion.name,
        passed,
        description: criterion.description,
        formula: criterion.formula,
        value
      };
    });

    const totalScore = criteria.filter(c => c.passed).length;

    return {
      totalScore,
      criteria
    };
  }

  /**
   * Calcular Altman Z-Score
   */
  calculateAltmanZScore(data: FinancialData): AltmanZScore {
    // Determinar si es manufacturera o no manufacturera
    const isManufacturing = this.isManufacturingCompany(data);
    const coefficients = isManufacturing ? 
      ALTMAN_COEFFICIENTS.MANUFACTURING : 
      ALTMAN_COEFFICIENTS.NON_MANUFACTURING;

    const components: any[] = [];
    let totalScore = 0;

    // X1: Working Capital / Total Assets
    const workingCapital = data.currentAssets - data.currentLiabilities;
    const x1 = workingCapital / data.totalAssets;
    const x1Contribution = x1 * coefficients.WORKING_CAPITAL_TO_TOTAL_ASSETS;
    components.push({
      name: 'Working Capital / Total Assets',
      value: x1,
      coefficient: coefficients.WORKING_CAPITAL_TO_TOTAL_ASSETS,
      contribution: x1Contribution
    });
    totalScore += x1Contribution;

    // X2: Retained Earnings / Total Assets
    const x2 = data.retainedEarnings / data.totalAssets;
    const x2Contribution = x2 * coefficients.RETAINED_EARNINGS_TO_TOTAL_ASSETS;
    components.push({
      name: 'Retained Earnings / Total Assets',
      value: x2,
      coefficient: coefficients.RETAINED_EARNINGS_TO_TOTAL_ASSETS,
      contribution: x2Contribution
    });
    totalScore += x2Contribution;

    // X3: EBIT / Total Assets
    const ebit = data.operatingIncome || (data.netIncome + data.interestExpense);
    const x3 = ebit / data.totalAssets;
    const x3Contribution = x3 * coefficients.EBIT_TO_TOTAL_ASSETS;
    components.push({
      name: 'EBIT / Total Assets',
      value: x3,
      coefficient: coefficients.EBIT_TO_TOTAL_ASSETS,
      contribution: x3Contribution
    });
    totalScore += x3Contribution;

    // X4: Market Value of Equity / Book Value of Total Debt
    const totalDebt = data.shortTermDebt + data.longTermDebt;
    const x4 = data.marketCap / totalDebt;
    const x4Contribution = x4 * (isManufacturing ? 
      coefficients.MARKET_VALUE_EQUITY_TO_BOOK_VALUE_DEBT : 
      coefficients.MARKET_VALUE_EQUITY_TO_BOOK_VALUE_DEBT);
    components.push({
      name: 'Market Value Equity / Book Value Debt',
      value: x4,
      coefficient: isManufacturing ? 
        coefficients.MARKET_VALUE_EQUITY_TO_BOOK_VALUE_DEBT : 
        coefficients.MARKET_VALUE_EQUITY_TO_BOOK_VALUE_DEBT,
      contribution: x4Contribution
    });
    totalScore += x4Contribution;

    // X5: Sales / Total Assets (solo para manufactureras)
    if (isManufacturing) {
      const x5 = data.revenue / data.totalAssets;
      const x5Contribution = x5 * coefficients.SALES_TO_TOTAL_ASSETS;
      components.push({
        name: 'Sales / Total Assets',
        value: x5,
        coefficient: coefficients.SALES_TO_TOTAL_ASSETS,
        contribution: x5Contribution
      });
      totalScore += x5Contribution;
    }

    // Determinar interpretación
    const thresholds = isManufacturing ? 
      ALTMAN_THRESHOLDS.MANUFACTURING : 
      ALTMAN_THRESHOLDS.NON_MANUFACTURING;

    let interpretation: 'SAFE' | 'GREY_ZONE' | 'DISTRESS';
    if (totalScore >= thresholds.SAFE) {
      interpretation = 'SAFE';
    } else if (totalScore >= thresholds.GREY_ZONE) {
      interpretation = 'GREY_ZONE';
    } else {
      interpretation = 'DISTRESS';
    }

    return {
      totalScore,
      interpretation,
      components
    };
  }

  /**
   * Calcular Beneish M-Score
   */
  calculateBeneishMScore(data: FinancialData, priorData?: FinancialData): BeneishMScore {
    const variables: any[] = [];

    if (!priorData) {
      // Si no hay datos del año anterior, retornar score neutro
      return {
        totalScore: -2.5, // Score seguro
        variables: BENEISH_VARIABLES_INFO.map(info => ({
          key: info.key,
          name: info.name,
          value: 0,
          description: info.description,
          flagged: false,
          threshold: info.threshold
        }))
      };
    }

    // DSRI: Days Sales in Receivables Index
    const dsr = (data.netReceivables / data.revenue) * 365;
    const dsrPrior = (priorData.netReceivables / priorData.revenue) * 365;
    const dsri = dsr / dsrPrior;
    variables.push({
      key: 'DSRI',
      name: 'Days Sales in Receivables Index',
      value: dsri,
      description: 'Mide si las cuentas por cobrar están creciendo más rápido que las ventas',
      flagged: dsri > 1.031,
      threshold: '1.031'
    });

    // GMI: Gross Margin Index
    const grossMargin = data.grossProfit / data.revenue;
    const grossMarginPrior = priorData.grossProfit / priorData.revenue;
    const gmi = grossMarginPrior / grossMargin;
    variables.push({
      key: 'GMI',
      name: 'Gross Margin Index',
      value: gmi,
      description: 'Compara el margen bruto del año anterior con el actual',
      flagged: gmi > 1.014,
      threshold: '1.014'
    });

    // AQI: Asset Quality Index
    const nonCurrentAssetsExcludingPPE = data.totalAssets - data.currentAssets - data.propertyPlantEquipmentNet;
    const aqi = nonCurrentAssetsExcludingPPE / data.totalAssets;
    const nonCurrentAssetsExcludingPPEPrior = priorData.totalAssets - priorData.currentAssets - priorData.propertyPlantEquipmentNet;
    const aqiPrior = nonCurrentAssetsExcludingPPEPrior / priorData.totalAssets;
    const aqiIndex = aqi / aqiPrior;
    variables.push({
      key: 'AQI',
      name: 'Asset Quality Index',
      value: aqiIndex,
      description: 'Mide la proporción de activos no corrientes distintos de PPE',
      flagged: aqiIndex > 1.031,
      threshold: '1.031'
    });

    // SGI: Sales Growth Index
    const sgi = data.revenue / priorData.revenue;
    variables.push({
      key: 'SGI',
      name: 'Sales Growth Index',
      value: sgi,
      description: 'Mide el crecimiento de las ventas año a año',
      flagged: sgi > 1.134,
      threshold: '1.134'
    });

    // DEPI: Depreciation Index
    const depreciationRate = data.capitalExpenditures / (data.capitalExpenditures + data.propertyPlantEquipmentNet);
    const depreciationRatePrior = priorData.capitalExpenditures / (priorData.capitalExpenditures + priorData.propertyPlantEquipmentNet);
    const depi = depreciationRatePrior / depreciationRate;
    variables.push({
      key: 'DEPI',
      name: 'Depreciation Index',
      value: depi,
      description: 'Compara la tasa de depreciación del año anterior con la actual',
      flagged: depi > 1.077,
      threshold: '1.077'
    });

    // SGAI: Sales General and Administrative Expenses Index
    const sgaExpenses = data.revenue - data.grossProfit - data.operatingIncome;
    const sgaRate = sgaExpenses / data.revenue;
    const sgaExpensesPrior = priorData.revenue - priorData.grossProfit - priorData.operatingIncome;
    const sgaRatePrior = sgaExpensesPrior / priorData.revenue;
    const sgai = sgaRate / sgaRatePrior;
    variables.push({
      key: 'SGAI',
      name: 'SG&A Expenses Index',
      value: sgai,
      description: 'Mide el crecimiento de los gastos SG&A relativos a las ventas',
      flagged: sgai > 1.054,
      threshold: '1.054'
    });

    // TATA: Total Accruals to Total Assets
    const totalAccruals = data.netIncome - data.operatingCashFlow;
    const tata = totalAccruals / data.totalAssets;
    variables.push({
      key: 'TATA',
      name: 'Total Accruals to Total Assets',
      value: tata,
      description: 'Mide la proporción de acumulaciones totales sobre activos totales',
      flagged: Math.abs(tata) > 0.018,
      threshold: '0.018'
    });

    // LVGI: Leverage Index
    const leverage = (data.shortTermDebt + data.longTermDebt) / data.totalAssets;
    const leveragePrior = (priorData.shortTermDebt + priorData.longTermDebt) / priorData.totalAssets;
    const lvgi = leverage / leveragePrior;
    variables.push({
      key: 'LVGI',
      name: 'Leverage Index',
      value: lvgi,
      description: 'Compara el apalancamiento del año anterior con el actual',
      flagged: lvgi > 1.111,
      threshold: '1.111'
    });

    // Calcular M-Score usando la fórmula de Beneish
    const mScore = -6.065 + 
      0.823 * dsri + 
      0.906 * gmi + 
      0.593 * aqiIndex + 
      0.717 * sgi + 
      0.107 * depi + 
      0.841 * sgai + 
      0.077 * tata + 
      -0.156 * lvgi;

    return {
      totalScore: mScore,
      variables
    };
  }

  /**
   * Análisis consolidado completo
   */
  async analyzeCompany(data: FinancialData, priorData?: FinancialData): Promise<AnalysisResponse> {
    const piotroskiScore = this.calculatePiotroskiFScore(data, priorData);
    const altmanScore = this.calculateAltmanZScore(data);
    const beneishScore = this.calculateBeneishMScore(data, priorData);

    // Generar datos históricos simulados (en producción vendrían de la base de datos)
    const historicalScores = this.generateHistoricalScores(data.ticker);
    const quarterlyScores = this.generateQuarterlyScores(data.ticker);
    const sparkline7d = this.generateSparkline();

    return {
      symbol: data.ticker,
      name: data.companyName,
      market: this.determineMarket(data.ticker),
      sector: this.determineSector(data.ticker),
      fScore: piotroskiScore.totalScore,
      zScore: altmanScore.totalScore,
      mScore: beneishScore.totalScore,
      piotroskiCriteria: piotroskiScore.criteria,
      historicalScores,
      quarterlyScores,
      beneishVariables: beneishScore.variables,
      sparkline7d,
      aiExplanation: this.generateAIExplanation(piotroskiScore, altmanScore, beneishScore)
    };
  }

  /**
   * Análisis manual con datos mínimos
   */
  async analyzeManualData(request: ManualAnalysisRequest): Promise<AnalysisResponse> {
    // Convertir datos manuales a FinancialData
    const data = this.convertManualToFinancialData(request);
    const priorData = this.estimatePriorData(request);

    return this.analyzeCompany(data, priorData);
  }

  // =================================
  // MÉTODOS AUXILIARES
  // =================================

  private isManufacturingCompany(data: FinancialData): boolean {
    // Heurística simple: si tiene inventario significativo, probablemente es manufacturera
    const inventoryRatio = data.inventory / data.totalAssets;
    return inventoryRatio > 0.1; // 10% o más de inventario
  }

  private determineMarket(ticker: string): "US" | "PE" | "GLOBAL" {
    if (ticker.endsWith('.L') || ticker.includes('LIMA')) return 'PE';
    if (ticker.length <= 4 && !ticker.includes('.')) return 'US';
    return 'GLOBAL';
  }

  private determineSector(ticker: string): string {
    // En producción, esto vendría de una base de datos
    const sectorMap: Record<string, string> = {
      'AAPL': 'Technology',
      'MSFT': 'Technology',
      'GOOGL': 'Technology',
      'AMZN': 'Consumer Discretionary',
      'TSLA': 'Consumer Discretionary',
      'BRK.B': 'Financial Services',
      'JPM': 'Financial Services',
      'JNJ': 'Healthcare',
      'PFE': 'Healthcare'
    };
    return sectorMap[ticker] || 'Unknown';
  }

  private convertManualToFinancialData(request: ManualAnalysisRequest): FinancialData {
    return {
      ticker: 'MANUAL',
      companyName: request.companyName,
      reportDate: new Date().toISOString(),
      fiscalYear: new Date().getFullYear(),
      currency: 'USD',
      
      // Datos proporcionados
      revenue: request.totalRevenue,
      netIncome: request.netIncome,
      grossProfit: request.grossProfit,
      operatingIncome: request.grossProfit * 0.8, // Estimación
      ebitda: request.netIncome * 1.5, // Estimación
      interestExpense: request.longTermDebt * 0.05, // Estimación 5%
      incomeTaxExpense: request.netIncome * 0.3, // Estimación 30%
      costOfRevenue: request.totalRevenue - request.grossProfit,
      
      totalAssets: request.totalAssets,
      currentAssets: request.currentAssets,
      cashAndCashEquivalents: request.currentAssets * 0.3, // Estimación
      netReceivables: request.currentAssets * 0.4, // Estimación
      inventory: request.currentAssets * 0.2, // Estimación
      propertyPlantEquipmentNet: request.totalAssets * 0.4, // Estimación
      
      totalLiabilities: request.currentLiabilities + request.longTermDebt,
      currentLiabilities: request.currentLiabilities,
      shortTermDebt: request.currentLiabilities * 0.3, // Estimación
      accountsPayable: request.currentLiabilities * 0.5, // Estimación
      longTermDebt: request.longTermDebt,
      
      shareholdersEquity: request.totalAssets - (request.currentLiabilities + request.longTermDebt),
      retainedEarnings: request.netIncome * 5, // Estimación
      
      operatingCashFlow: request.operatingCashFlow,
      freeCashFlow: request.operatingCashFlow * 0.8, // Estimación
      capitalExpenditures: request.operatingCashFlow * 0.2, // Estimación
      
      sharesOutstanding: request.sharesOutstanding,
      weightedAverageShsOut: request.sharesOutstanding,
      
      marketCap: request.sharesOutstanding * 50, // Estimación $50 por acción
      
      dataSource: 'manual_input',
      lastUpdated: new Date()
    };
  }

  private estimatePriorData(request: ManualAnalysisRequest): FinancialData | undefined {
    if (!request.totalAssetsPrior || !request.totalRevenuePrior) {
      return undefined;
    }

    // Crear datos del año anterior basados en los datos proporcionados
    const currentData = this.convertManualToFinancialData(request);
    
    return {
      ...currentData,
      totalAssets: request.totalAssetsPrior,
      revenue: request.totalRevenuePrior,
      grossProfit: request.grossProfitPrior || request.grossProfit * 0.9,
      currentAssets: request.currentAssetsPrior || request.currentAssets * 0.9,
      currentLiabilities: request.currentLiabilitiesPrior || request.currentLiabilities * 0.9,
      longTermDebt: request.longTermDebtPrior || request.longTermDebt * 1.1,
      sharesOutstanding: request.sharesOutstandingPrior || request.sharesOutstanding * 1.05,
      netReceivables: (request.currentAssetsPrior || request.currentAssets * 0.9) * 0.4,
      propertyPlantEquipmentNet: request.totalAssetsPrior * 0.4
    };
  }

  private generateHistoricalScores(ticker: string) {
    // Datos simulados - en producción vendrían de la base de datos
    return [
      { year: 2020, fScore: 6, zScore: 2.1, mScore: -2.2 },
      { year: 2021, fScore: 7, zScore: 2.5, mScore: -2.1 },
      { year: 2022, fScore: 5, zScore: 1.8, mScore: -1.9 },
      { year: 2023, fScore: 8, zScore: 3.2, mScore: -2.5 }
    ];
  }

  private generateQuarterlyScores(ticker: string) {
    // Datos simulados - en producción vendrían de la base de datos
    return [
      { quarter: '2023-Q1', fScore: 7, zScore: 2.8, mScore: -2.3 },
      { quarter: '2023-Q2', fScore: 8, zScore: 3.0, mScore: -2.4 },
      { quarter: '2023-Q3', fScore: 7, zScore: 2.9, mScore: -2.2 },
      { quarter: '2023-Q4', fScore: 8, zScore: 3.2, mScore: -2.5 }
    ];
  }

  private generateSparkline(): number[] {
    // Generar datos simulados para los últimos 7 días
    return Array.from({ length: 7 }, () => Math.random() * 100 + 50);
  }

  private generateAIExplanation(
    piotroski: PiotroskiScore, 
    altman: AltmanZScore, 
    beneish: BeneishMScore
  ): string {
    let explanation = `Análisis Financiero Consolidado:\n\n`;
    
    // Piotroski F-Score
    explanation += `**Piotroski F-Score: ${piotroski.totalScore}/9**\n`;
    if (piotroski.totalScore >= 8) {
      explanation += `Excelente puntuación que indica una empresa financieramente sólida con fundamentos fuertes.\n\n`;
    } else if (piotroski.totalScore >= 6) {
      explanation += `Buena puntuación que sugiere fundamentos sólidos con algunas áreas de mejora.\n\n`;
    } else if (piotroski.totalScore >= 4) {
      explanation += `Puntuación moderada que indica fundamentos mixtos. Revisar criterios específicos.\n\n`;
    } else {
      explanation += `Puntuación baja que sugiere fundamentos débiles. Precaución recomendada.\n\n`;
    }

    // Altman Z-Score
    explanation += `**Altman Z-Score: ${altman.totalScore.toFixed(2)}**\n`;
    if (altman.interpretation === 'SAFE') {
      explanation += `La empresa se encuentra en zona segura con bajo riesgo de bancarrota.\n\n`;
    } else if (altman.interpretation === 'GREY_ZONE') {
      explanation += `La empresa está en zona gris. Monitorear de cerca la situación financiera.\n\n`;
    } else {
      explanation += `Alto riesgo de dificultades financieras. Revisar inmediatamente.\n\n`;
    }

    // Beneish M-Score
    explanation += `**Beneish M-Score: ${beneish.totalScore.toFixed(2)}**\n`;
    if (beneish.totalScore < -1.78) {
      explanation += `Bajo riesgo de manipulación contable. Los estados financieros parecen confiables.\n\n`;
    } else {
      explanation += `Posible riesgo de manipulación contable. Revisar variables específicas flagged.\n\n`;
    }

    explanation += `**Recomendación:** Basado en el análisis consolidado, `;
    const avgScore = (piotroski.totalScore / 9 + (altman.totalScore > 2.6 ? 1 : 0) + (beneish.totalScore < -1.78 ? 1 : 0)) / 3;
    
    if (avgScore > 0.7) {
      explanation += `esta empresa presenta fundamentos sólidos y es candidata para inversión.`;
    } else if (avgScore > 0.4) {
      explanation += `esta empresa presenta fundamentos mixtos. Análisis adicional recomendado.`;
    } else {
      explanation += `esta empresa presenta riesgos significativos. Precaución recomendada.`;
    }

    return explanation;
  }
}
