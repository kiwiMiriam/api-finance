import { IsString, IsOptional, IsEnum, IsNumber, IsBoolean, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para filtros de alertas de fraude
 */
export class AlertsFiltersDto {
  @ApiPropertyOptional({
    description: 'Filtrar por severidad de la alerta',
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    example: 'HIGH',
  })
  @IsOptional()
  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @ApiPropertyOptional({
    description: 'Filtrar por indicador específico del M-Score',
    enum: ['DSRI', 'GMI', 'AQI', 'SGI', 'DEPI', 'SGAI', 'TATA', 'LVGI', 'OVERALL_MSCORE'],
    example: 'DSRI',
  })
  @IsOptional()
  @IsEnum(['DSRI', 'GMI', 'AQI', 'SGI', 'DEPI', 'SGAI', 'TATA', 'LVGI', 'OVERALL_MSCORE'])
  indicator?: 'DSRI' | 'GMI' | 'AQI' | 'SGI' | 'DEPI' | 'SGAI' | 'TATA' | 'LVGI' | 'OVERALL_MSCORE';

  @ApiPropertyOptional({
    description: 'Filtrar por ticker específico',
    example: 'AAPL',
  })
  @IsOptional()
  @IsString()
  ticker?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por estado de lectura',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isRead?: boolean;

  @ApiPropertyOptional({
    description: 'Fecha de inicio (ISO string)',
    example: '2024-03-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Fecha de fin (ISO string)',
    example: '2024-03-17T23:59:59.999Z',
  })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Número de alertas por página',
    example: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Número de alertas a saltar (para paginación)',
    example: 0,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number;
}

/**
 * DTO para configurar umbrales de alertas
 */
export class AlertSettingsDto {
  @ApiPropertyOptional({
    description: 'Habilitar notificaciones por email',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @ApiPropertyOptional({
    description: 'Habilitar notificaciones push',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  pushNotifications?: boolean;

  @ApiPropertyOptional({
    description: 'Umbral para M-Score general',
    example: -1.78,
  })
  @IsOptional()
  @IsNumber()
  mScoreThreshold?: number;

  @ApiPropertyOptional({
    description: 'Umbral para DSRI (Days Sales in Receivables Index)',
    example: 1.031,
  })
  @IsOptional()
  @IsNumber()
  dsriThreshold?: number;

  @ApiPropertyOptional({
    description: 'Umbral para GMI (Gross Margin Index)',
    example: 1.014,
  })
  @IsOptional()
  @IsNumber()
  gmiThreshold?: number;

  @ApiPropertyOptional({
    description: 'Umbral para AQI (Asset Quality Index)',
    example: 1.043,
  })
  @IsOptional()
  @IsNumber()
  aqiThreshold?: number;

  @ApiPropertyOptional({
    description: 'Umbral para SGI (Sales Growth Index)',
    example: 1.107,
  })
  @IsOptional()
  @IsNumber()
  sgiThreshold?: number;

  @ApiPropertyOptional({
    description: 'Umbral para DEPI (Depreciation Index)',
    example: 1.077,
  })
  @IsOptional()
  @IsNumber()
  depiThreshold?: number;

  @ApiPropertyOptional({
    description: 'Umbral para SGAI (Sales General and Administrative expenses Index)',
    example: 1.054,
  })
  @IsOptional()
  @IsNumber()
  sgaiThreshold?: number;

  @ApiPropertyOptional({
    description: 'Umbral para TATA (Total Accruals to Total Assets)',
    example: 0.031,
  })
  @IsOptional()
  @IsNumber()
  tataThreshold?: number;

  @ApiPropertyOptional({
    description: 'Umbral para LVGI (Leverage Index)',
    example: 1.041,
  })
  @IsOptional()
  @IsNumber()
  lvgiThreshold?: number;

  @ApiPropertyOptional({
    description: 'Lista de tickers a monitorear',
    example: ['AAPL', 'MSFT', 'GOOGL'],
    type: [String],
  })
  @IsOptional()
  watchedTickers?: string[];
}

/**
 * DTO para marcar alertas como leídas
 */
export class MarkAlertsReadDto {
  @ApiProperty({
    description: 'IDs de las alertas a marcar como leídas',
    example: ['alert-1', 'alert-2', 'alert-3'],
    type: [String],
  })
  @IsString({ each: true })
  alertIds: string[];
}

/**
 * DTO para solicitar explicación de IA
 */
export class ExplanationRequestDto {
  @ApiProperty({
    description: 'Ticker para el cual generar explicación',
    example: 'AAPL',
  })
  @IsString()
  ticker: string;

  @ApiPropertyOptional({
    description: 'Incluir análisis comparativo de industria',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  includeIndustryComparison?: boolean;

  @ApiPropertyOptional({
    description: 'Incluir datos históricos en el análisis',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  includeHistoricalData?: boolean;
}
