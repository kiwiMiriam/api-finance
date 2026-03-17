import { IsString, IsOptional, IsEmail, IsEnum, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para sincronizar perfil con Supabase
 */
export class SyncProfileDto {
  @ApiProperty({
    description: 'Email del usuario',
    example: 'usuario@ejemplo.com',
  })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    description: 'Nombre para mostrar',
    example: 'Juan Pérez',
  })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({
    description: 'Nombre',
    example: 'Juan',
  })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Apellido',
    example: 'Pérez',
  })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({
    description: 'URL del avatar',
    example: 'https://ejemplo.com/avatar.jpg',
  })
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}

/**
 * DTO para actualizar perfil de usuario
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: 'Nombre para mostrar',
    example: 'Juan Pérez',
  })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({
    description: 'Nombre',
    example: 'Juan',
  })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Apellido',
    example: 'Pérez',
  })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Idioma preferido',
    enum: ['es', 'en'],
    example: 'es',
  })
  @IsOptional()
  @IsEnum(['es', 'en'])
  language?: 'es' | 'en';

  @ApiPropertyOptional({
    description: 'Zona horaria',
    example: 'America/Lima',
  })
  @IsOptional()
  @IsString()
  timezone?: string;

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
}

/**
 * DTO para cambio de plan
 */
export class ChangePlanDto {
  @ApiProperty({
    description: 'Nuevo plan',
    enum: ['free', 'pro', 'enterprise'],
    example: 'pro',
  })
  @IsEnum(['free', 'pro', 'enterprise'])
  newTier: 'free' | 'pro' | 'enterprise';

  @ApiProperty({
    description: 'Ciclo de facturación',
    enum: ['monthly', 'yearly'],
    example: 'monthly',
  })
  @IsEnum(['monthly', 'yearly'])
  billingCycle: 'monthly' | 'yearly';

  @ApiPropertyOptional({
    description: 'ID del método de pago',
    example: 'pm_1234567890',
  })
  @IsOptional()
  @IsString()
  paymentMethodId?: string;
}

/**
 * DTO para configuración de notificaciones
 */
export class NotificationSettingsDto {
  @ApiPropertyOptional({
    description: 'Habilitar notificaciones por email',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Alertas de fraude por email',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  emailFraudAlerts?: boolean;

  @ApiPropertyOptional({
    description: 'Actualizaciones de cartera por email',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  emailPortfolioUpdates?: boolean;

  @ApiPropertyOptional({
    description: 'Reportes semanales por email',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  emailWeeklyReports?: boolean;

  @ApiPropertyOptional({
    description: 'Emails de marketing',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  emailMarketing?: boolean;

  @ApiPropertyOptional({
    description: 'Habilitar notificaciones push',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Alertas de fraude push',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  pushFraudAlerts?: boolean;

  @ApiPropertyOptional({
    description: 'Actualizaciones de cartera push',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  pushPortfolioUpdates?: boolean;

  @ApiPropertyOptional({
    description: 'Alertas de precio push',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  pushPriceAlerts?: boolean;
}
