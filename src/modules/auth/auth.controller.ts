import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/user.decorator';
import { 
  SyncProfileDto, 
  UpdateProfileDto, 
  ChangePlanDto,
  NotificationSettingsDto 
} from '../../domain/dto/auth.dto';
import type {
  UserProfile,
  SyncProfileResponse,
  UserUsageStats,
  UserPlan,
  ChangePlanResponse,
  NotificationSettings,
} from '../../domain/interfaces/auth.interfaces';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('sync')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Sincronizar perfil con Supabase Auth',
    description: `
      Endpoint que se ejecuta después del login en el frontend para:
      - Crear perfil si es la primera vez que el usuario se autentica
      - Actualizar información del perfil si ya existe
      - Sincronizar datos entre Supabase Auth y la tabla profiles
      - Actualizar timestamp de último login
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Perfil sincronizado exitosamente',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Perfil sincronizado exitosamente' },
        profile: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'user-uuid-123' },
            email: { type: 'string', example: 'usuario@ejemplo.com' },
            displayName: { type: 'string', example: 'Juan Pérez' },
            tier: { type: 'string', enum: ['free', 'pro', 'enterprise'], example: 'free' },
            searchCount: { type: 'number', example: 3 },
            searchLimit: { type: 'number', example: 5 },
            preferences: {
              type: 'object',
              properties: {
                language: { type: 'string', example: 'es' },
                timezone: { type: 'string', example: 'America/Lima' },
                emailNotifications: { type: 'boolean', example: true },
                pushNotifications: { type: 'boolean', example: true },
              },
            },
          },
        },
        isNewUser: { type: 'boolean', example: false },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 500, description: 'Error interno del servidor' })
  async syncProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() syncProfileDto: SyncProfileDto,
  ): Promise<SyncProfileResponse> {
    try {
      return await this.authService.syncProfile(user.id, syncProfileDto);
    } catch (error) {
      throw new HttpException(
        'Error al sincronizar perfil',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('me')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Obtener perfil completo del usuario',
    description: `
      Retorna el perfil completo del usuario autenticado incluyendo:
      - Información personal (nombre, email, avatar)
      - Plan actual y límites de uso
      - Preferencias de usuario
      - Estadísticas de cuenta
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Perfil obtenido exitosamente',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'user-uuid-123' },
        email: { type: 'string', example: 'usuario@ejemplo.com' },
        displayName: { type: 'string', example: 'Juan Pérez' },
        firstName: { type: 'string', example: 'Juan' },
        lastName: { type: 'string', example: 'Pérez' },
        avatarUrl: { type: 'string', example: 'https://ejemplo.com/avatar.jpg' },
        tier: { type: 'string', enum: ['free', 'pro', 'enterprise'], example: 'free' },
        searchCount: { type: 'number', example: 3, description: 'Búsquedas usadas en el período actual' },
        searchLimit: { type: 'number', example: 5, description: 'Límite de búsquedas por período' },
        preferences: {
          type: 'object',
          properties: {
            language: { type: 'string', example: 'es' },
            timezone: { type: 'string', example: 'America/Lima' },
            emailNotifications: { type: 'boolean', example: true },
            pushNotifications: { type: 'boolean', example: true },
          },
        },
        createdAt: { type: 'string', example: '2024-01-15T10:30:00.000Z' },
        lastLoginAt: { type: 'string', example: '2024-03-17T10:30:00.000Z' },
        isActive: { type: 'boolean', example: true },
        isEmailVerified: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 404, description: 'Perfil no encontrado' })
  async getProfile(@CurrentUser() user: AuthenticatedUser): Promise<UserProfile> {
    return await this.authService.getProfile(user.id);
  }

  @Put('me')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Actualizar perfil de usuario',
    description: `
      Permite al usuario actualizar su información personal y preferencias:
      - Nombre y apellidos
      - Preferencias de idioma y zona horaria
      - Configuración de notificaciones
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Perfil actualizado exitosamente',
    schema: {
      type: 'object',
      description: 'Perfil actualizado completo',
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos' })
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() updateProfileDto: UpdateProfileDto,
  ): Promise<UserProfile> {
    return await this.authService.updateProfile(user.id, updateProfileDto);
  }

  @Get('usage-stats')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Obtener estadísticas de uso del usuario',
    description: `
      Retorna estadísticas detalladas del uso de la plataforma:
      - Uso del período actual vs límites
      - Estadísticas históricas totales
      - Actividad reciente del usuario
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Estadísticas obtenidas exitosamente',
    schema: {
      type: 'object',
      properties: {
        currentPeriod: {
          type: 'object',
          properties: {
            searchesUsed: { type: 'number', example: 3 },
            searchesLimit: { type: 'number', example: 5 },
            periodStart: { type: 'string', example: '2024-03-01T00:00:00.000Z' },
            periodEnd: { type: 'string', example: '2024-03-31T23:59:59.999Z' },
          },
        },
        allTime: {
          type: 'object',
          properties: {
            totalSearches: { type: 'number', example: 47 },
            totalAnalyses: { type: 'number', example: 42 },
            portfolioItems: { type: 'number', example: 8 },
            alertsGenerated: { type: 'number', example: 12 },
            accountAge: { type: 'number', example: 62, description: 'Días desde la creación de la cuenta' },
          },
        },
        recentActivity: {
          type: 'object',
          properties: {
            lastAnalysis: { type: 'string', example: '2024-03-17T09:15:00.000Z' },
            lastPortfolioUpdate: { type: 'string', example: '2024-03-16T14:30:00.000Z' },
            lastLogin: { type: 'string', example: '2024-03-17T10:30:00.000Z' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async getUserUsageStats(@CurrentUser() user: AuthenticatedUser): Promise<UserUsageStats> {
    return await this.authService.getUserUsageStats(user.id);
  }

  @Get('plan')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Obtener información del plan actual',
    description: `
      Retorna información detallada del plan actual del usuario:
      - Características y límites del plan
      - Precios y opciones de facturación
      - Features disponibles
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Información del plan obtenida exitosamente',
    schema: {
      type: 'object',
      properties: {
        tier: { type: 'string', enum: ['free', 'pro', 'enterprise'], example: 'free' },
        name: { type: 'string', example: 'Plan Gratuito' },
        description: { type: 'string', example: 'Perfecto para comenzar con análisis financiero básico' },
        features: {
          type: 'array',
          items: { type: 'string' },
          example: ['5 análisis por mes', 'Scores básicos', 'Cartera de hasta 10 activos'],
        },
        limits: {
          type: 'object',
          properties: {
            searchesPerMonth: { type: 'number', example: 5 },
            portfolioItems: { type: 'number', example: 10 },
            alertsEnabled: { type: 'boolean', example: false },
            prioritySupport: { type: 'boolean', example: false },
            apiAccess: { type: 'boolean', example: false },
          },
        },
        pricing: {
          type: 'object',
          properties: {
            monthly: { type: 'number', example: 0 },
            yearly: { type: 'number', example: 0 },
            currency: { type: 'string', example: 'USD' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async getUserPlan(@CurrentUser() user: AuthenticatedUser): Promise<UserPlan> {
    return await this.authService.getUserPlan(user.id);
  }

  @Post('change-plan')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Cambiar plan de usuario',
    description: `
      Permite al usuario cambiar su plan de suscripción:
      - Upgrade o downgrade entre planes
      - Selección de ciclo de facturación (mensual/anual)
      - Procesamiento de pago (integración futura con Stripe)
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Plan cambiado exitosamente',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Plan cambiado exitosamente a Plan Pro' },
        newPlan: {
          type: 'object',
          description: 'Información del nuevo plan',
        },
        billingInfo: {
          type: 'object',
          properties: {
            nextBillingDate: { type: 'string', example: '2024-04-17T00:00:00.000Z' },
            amount: { type: 'number', example: 29 },
            currency: { type: 'string', example: 'USD' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 400, description: 'Plan o método de pago inválido' })
  @ApiResponse({ status: 402, description: 'Error en el procesamiento del pago' })
  async changePlan(
    @CurrentUser() user: AuthenticatedUser,
    @Body() changePlanDto: ChangePlanDto,
  ): Promise<ChangePlanResponse> {
    return await this.authService.changePlan(user.id, changePlanDto);
  }

  @Get('notifications')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Obtener configuración de notificaciones',
    description: `
      Retorna la configuración actual de notificaciones del usuario:
      - Notificaciones por email (alertas, reportes, marketing)
      - Notificaciones push (alertas, actualizaciones)
      - Notificaciones in-app
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Configuración de notificaciones obtenida exitosamente',
    schema: {
      type: 'object',
      properties: {
        email: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean', example: true },
            fraudAlerts: { type: 'boolean', example: true },
            portfolioUpdates: { type: 'boolean', example: true },
            weeklyReports: { type: 'boolean', example: false },
            marketingEmails: { type: 'boolean', example: false },
          },
        },
        push: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean', example: true },
            fraudAlerts: { type: 'boolean', example: true },
            portfolioUpdates: { type: 'boolean', example: true },
            priceAlerts: { type: 'boolean', example: true },
          },
        },
        inApp: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean', example: true },
            fraudAlerts: { type: 'boolean', example: true },
            portfolioUpdates: { type: 'boolean', example: true },
            systemUpdates: { type: 'boolean', example: true },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async getNotificationSettings(@CurrentUser() user: AuthenticatedUser): Promise<NotificationSettings> {
    return await this.authService.getNotificationSettings(user.id);
  }
}
