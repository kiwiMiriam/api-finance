import { IsString, IsOptional, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para agregar activo a la cartera
 */
export class AddPortfolioDto {
  @ApiProperty({
    description: 'Símbolo del ticker (ej: AAPL, MSFT, GOOGL)',
    example: 'AAPL',
    minLength: 1,
    maxLength: 10,
  })
  @IsString()
  ticker: string;

  @ApiPropertyOptional({
    description: 'Notas opcionales sobre el activo',
    example: 'Empresa con buen potencial de crecimiento',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * DTO para actualizar activo en cartera
 */
export class UpdatePortfolioDto {
  @ApiPropertyOptional({
    description: 'Notas sobre el activo',
    example: 'Actualización: resultados Q4 positivos',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Habilitar/deshabilitar alertas para este activo',
    example: true,
  })
  @IsOptional()
  alertsEnabled?: boolean;
}

/**
 * DTO para filtros de consulta de cartera
 */
export class PortfolioFiltersDto {
  @ApiPropertyOptional({
    description: 'Filtrar por sector',
    example: 'Technology',
  })
  @IsOptional()
  @IsString()
  sector?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por nivel de riesgo',
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    example: 'LOW',
  })
  @IsOptional()
  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @ApiPropertyOptional({
    description: 'Filtrar por riesgo de fraude',
    enum: ['LOW', 'MEDIUM', 'HIGH'],
    example: 'LOW',
  })
  @IsOptional()
  @IsEnum(['LOW', 'MEDIUM', 'HIGH'])
  fraudRisk?: 'LOW' | 'MEDIUM' | 'HIGH';

  @ApiPropertyOptional({
    description: 'F-Score mínimo (0-9)',
    example: 5,
    minimum: 0,
    maximum: 9,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(9)
  minFScore?: number;

  @ApiPropertyOptional({
    description: 'F-Score máximo (0-9)',
    example: 9,
    minimum: 0,
    maximum: 9,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(9)
  maxFScore?: number;

  @ApiPropertyOptional({
    description: 'Campo por el cual ordenar',
    enum: ['ticker', 'fScore', 'zScore', 'mScore', 'addedAt', 'riskLevel'],
    example: 'fScore',
  })
  @IsOptional()
  @IsEnum(['ticker', 'fScore', 'zScore', 'mScore', 'addedAt', 'riskLevel'])
  sortBy?: 'ticker' | 'fScore' | 'zScore' | 'mScore' | 'addedAt' | 'riskLevel';

  @ApiPropertyOptional({
    description: 'Orden de clasificación',
    enum: ['ASC', 'DESC'],
    example: 'DESC',
  })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';

  @ApiPropertyOptional({
    description: 'Número de elementos por página',
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
    description: 'Número de elementos a saltar (para paginación)',
    example: 0,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number;
}

/**
 * DTO para configurar alertas de portfolio
 */
export class PortfolioAlertDto {
  @ApiProperty({
    description: 'Tipo de alerta',
    enum: ['FSCORE_DROP', 'ZSCORE_CRITICAL', 'MSCORE_FRAUD', 'PRICE_CHANGE'],
    example: 'FSCORE_DROP',
  })
  @IsEnum(['FSCORE_DROP', 'ZSCORE_CRITICAL', 'MSCORE_FRAUD', 'PRICE_CHANGE'])
  alertType: 'FSCORE_DROP' | 'ZSCORE_CRITICAL' | 'MSCORE_FRAUD' | 'PRICE_CHANGE';

  @ApiProperty({
    description: 'Umbral para disparar la alerta',
    example: 5,
  })
  @IsNumber()
  threshold: number;

  @ApiPropertyOptional({
    description: 'Si la alerta está activa',
    example: true,
    default: true,
  })
  @IsOptional()
  isActive?: boolean;
}
