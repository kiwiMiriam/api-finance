import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseConfigService } from '../../config/supabase.config';
import type {
  UserProfile,
  SyncProfileRequest,
  SyncProfileResponse,
  UpdateProfileRequest,
  UserUsageStats,
  UserPlan,
  ChangePlanRequest,
  ChangePlanResponse,
  NotificationSettings,
} from '../../domain/interfaces/auth.interfaces';

@Injectable()
export class AuthService {
  constructor(private supabaseConfig: SupabaseConfigService) {}

  /**
   * Sincronizar perfil de usuario con Supabase Auth
   */
  async syncProfile(userId: string, request: SyncProfileRequest): Promise<SyncProfileResponse> {
    try {
      const supabase = this.supabaseConfig.getServiceClient();
      
      // Verificar si el perfil ya existe
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      let profile: UserProfile;
      let isNewUser = false;

      if (existingProfile) {
        // Actualizar perfil existente
        const { data: updatedProfile, error } = await (supabase
          .from('profiles') as any)
          .update({
            email: request.email,
            display_name: request.displayName,
            first_name: request.firstName,
            last_name: request.lastName,
            avatar_url: request.avatarUrl,
            last_login_at: new Date().toISOString(),
          })
          .eq('id', userId)
          .select()
          .single();

        if (error) {
          throw new HttpException(
            `Error al actualizar perfil: ${error.message}`,
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }

        profile = this.mapProfileFromDB(updatedProfile);
      } else {
        // Crear nuevo perfil
        isNewUser = true;
        const newProfileData = {
          id: userId,
          email: request.email,
          display_name: request.displayName,
          first_name: request.firstName,
          last_name: request.lastName,
          avatar_url: request.avatarUrl,
          tier: 'free',
          search_count: 0,
          search_limit: 5,
          preferences: {
            language: 'es',
            timezone: 'America/Lima',
            emailNotifications: true,
            pushNotifications: true,
          },
          is_active: true,
          is_email_verified: false,
          last_login_at: new Date().toISOString(),
        };

        const { data: createdProfile, error } = await supabase
          .from('profiles')
          .insert(newProfileData as any)
          .select()
          .single();

        if (error) {
          throw new HttpException(
            `Error al crear perfil: ${error.message}`,
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }

        profile = this.mapProfileFromDB(createdProfile);
      }

      return {
        success: true,
        message: isNewUser ? 'Perfil creado exitosamente' : 'Perfil sincronizado exitosamente',
        profile,
        isNewUser,
      };
    } catch (error) {
      console.error('Error in syncProfile:', error);
      throw new HttpException(
        'Error al sincronizar perfil',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Obtener perfil completo del usuario
   */
  async getProfile(userId: string): Promise<UserProfile> {
    try {
      const supabase = this.supabaseConfig.getServiceClient();
      
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        throw new HttpException(
          `Error al obtener perfil: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      if (!profile) {
        throw new HttpException(
          'Perfil no encontrado',
          HttpStatus.NOT_FOUND,
        );
      }

      return this.mapProfileFromDB(profile);
    } catch (error) {
      console.error('Error in getProfile:', error);
      throw new HttpException(
        'Error al obtener perfil de usuario',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Actualizar perfil de usuario
   */
  async updateProfile(userId: string, request: UpdateProfileRequest): Promise<UserProfile> {
    try {
      const supabase = this.supabaseConfig.getServiceClient();
      
      const updateData: any = {};
      
      if (request.displayName !== undefined) updateData.display_name = request.displayName;
      if (request.firstName !== undefined) updateData.first_name = request.firstName;
      if (request.lastName !== undefined) updateData.last_name = request.lastName;
      
      if (request.preferences) {
        // Obtener preferencias actuales
        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('preferences')
          .eq('id', userId)
          .single();

        const currentPreferences = (currentProfile as any)?.preferences || {};
        const newPreferences = {
          ...currentPreferences,
          ...request.preferences,
        };
        
        updateData.preferences = newPreferences;
      }

      const { data: updatedProfile, error } = await (supabase
        .from('profiles') as any)
        .update(updateData)
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        throw new HttpException(
          `Error al actualizar perfil: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return this.mapProfileFromDB(updatedProfile);
    } catch (error) {
      console.error('Error in updateProfile:', error);
      throw new HttpException(
        'Error al actualizar perfil',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Obtener estadísticas de uso del usuario
   */
  async getUserUsageStats(userId: string): Promise<UserUsageStats> {
    try {
      const supabase = this.supabaseConfig.getServiceClient();
      
      // Obtener perfil para límites actuales
      const profile = await this.getProfile(userId);
      
      // Calcular período actual (mes actual)
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // Obtener estadísticas de uso
      const { data: usageData } = await supabase
        .from('api_usage_log')
        .select('*')
        .eq('user_id', userId);

      const { data: portfolioData } = await supabase
        .from('portfolio')
        .select('id, created_at')
        .eq('user_id', userId);

      const { data: alertsData } = await supabase
        .from('fraud_alerts')
        .select('id, created_at')
        .eq('user_id', userId);

      // Procesar estadísticas
      const currentPeriodUsage = (usageData || []).filter(
        (usage: any) => new Date(usage.created_at) >= periodStart && new Date(usage.created_at) <= periodEnd
      );

      const accountCreatedAt = new Date(profile.createdAt);
      const accountAge = Math.floor((now.getTime() - accountCreatedAt.getTime()) / (1000 * 60 * 60 * 24));

      return {
        currentPeriod: {
          searchesUsed: currentPeriodUsage.length,
          searchesLimit: profile.searchLimit,
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
        },
        allTime: {
          totalSearches: (usageData || []).length,
          totalAnalyses: (usageData || []).filter((usage: any) => usage.endpoint === '/analysis').length,
          portfolioItems: (portfolioData || []).length,
          alertsGenerated: (alertsData || []).length,
          accountAge,
        },
        recentActivity: {
          lastAnalysis: this.getLastActivity(usageData || [], '/analysis'),
          lastPortfolioUpdate: this.getLastActivity(portfolioData || []),
          lastLogin: profile.lastLoginAt,
        },
      };
    } catch (error) {
      console.error('Error in getUserUsageStats:', error);
      throw new HttpException(
        'Error al obtener estadísticas de uso',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Obtener información del plan del usuario
   */
  async getUserPlan(userId: string): Promise<UserPlan> {
    try {
      const profile = await this.getProfile(userId);
      return this.getPlanInfo(profile.tier);
    } catch (error) {
      console.error('Error in getUserPlan:', error);
      throw new HttpException(
        'Error al obtener información del plan',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Cambiar plan de usuario
   */
  async changePlan(userId: string, request: ChangePlanRequest): Promise<ChangePlanResponse> {
    try {
      const supabase = this.supabaseConfig.getServiceClient();
      
      // Obtener límites del nuevo plan
      const newPlanInfo = this.getPlanInfo(request.newTier);
      
      // Actualizar perfil con nuevo plan
      const { data: updatedProfile, error } = await (supabase
        .from('profiles') as any)
        .update({
          tier: request.newTier,
          search_limit: newPlanInfo.limits.searchesPerMonth,
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        throw new HttpException(
          `Error al cambiar plan: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // TODO: Integrar con sistema de pagos (Stripe, etc.)
      const billingInfo = {
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        amount: request.billingCycle === 'yearly' ? newPlanInfo.pricing.yearly : newPlanInfo.pricing.monthly,
        currency: newPlanInfo.pricing.currency,
      };

      return {
        success: true,
        message: `Plan cambiado exitosamente a ${newPlanInfo.name}`,
        newPlan: newPlanInfo,
        billingInfo,
      };
    } catch (error) {
      console.error('Error in changePlan:', error);
      throw new HttpException(
        'Error al cambiar plan',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Obtener configuración de notificaciones
   */
  async getNotificationSettings(userId: string): Promise<NotificationSettings> {
    try {
      const profile = await this.getProfile(userId);
      
      // TODO: Expandir con configuraciones más detalladas
      return {
        email: {
          enabled: profile.preferences.emailNotifications,
          fraudAlerts: true,
          portfolioUpdates: true,
          weeklyReports: false,
          marketingEmails: false,
        },
        push: {
          enabled: profile.preferences.pushNotifications,
          fraudAlerts: true,
          portfolioUpdates: true,
          priceAlerts: true,
        },
        inApp: {
          enabled: true,
          fraudAlerts: true,
          portfolioUpdates: true,
          systemUpdates: true,
        },
      };
    } catch (error) {
      console.error('Error in getNotificationSettings:', error);
      throw new HttpException(
        'Error al obtener configuración de notificaciones',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Mapear perfil de base de datos a interfaz
   */
  private mapProfileFromDB(dbProfile: any): UserProfile {
    return {
      id: dbProfile.id,
      email: dbProfile.email,
      displayName: dbProfile.display_name,
      firstName: dbProfile.first_name,
      lastName: dbProfile.last_name,
      avatarUrl: dbProfile.avatar_url,
      tier: dbProfile.tier,
      searchCount: dbProfile.search_count,
      searchLimit: dbProfile.search_limit,
      preferences: dbProfile.preferences || {
        language: 'es',
        timezone: 'America/Lima',
        emailNotifications: true,
        pushNotifications: true,
      },
      createdAt: dbProfile.created_at,
      lastLoginAt: dbProfile.last_login_at,
      isActive: dbProfile.is_active,
      isEmailVerified: dbProfile.is_email_verified,
    };
  }

  /**
   * Obtener información de plan por tier
   */
  private getPlanInfo(tier: 'free' | 'pro' | 'enterprise'): UserPlan {
    const plans = {
      free: {
        tier: 'free' as const,
        name: 'Plan Gratuito',
        description: 'Perfecto para comenzar con análisis financiero básico',
        features: [
          '5 análisis por mes',
          'Scores básicos (F-Score, Z-Score, M-Score)',
          'Cartera de hasta 10 activos',
          'Soporte por email',
        ],
        limits: {
          searchesPerMonth: 5,
          portfolioItems: 10,
          alertsEnabled: false,
          prioritySupport: false,
          apiAccess: false,
        },
        pricing: {
          monthly: 0,
          yearly: 0,
          currency: 'USD',
        },
      },
      pro: {
        tier: 'pro' as const,
        name: 'Plan Pro',
        description: 'Para inversores serios que necesitan análisis avanzado',
        features: [
          '100 análisis por mes',
          'Todos los scores y métricas',
          'Cartera ilimitada',
          'Alertas de fraude en tiempo real',
          'Reportes semanales',
          'Soporte prioritario',
        ],
        limits: {
          searchesPerMonth: 100,
          portfolioItems: -1, // ilimitado
          alertsEnabled: true,
          prioritySupport: true,
          apiAccess: false,
        },
        pricing: {
          monthly: 29,
          yearly: 290,
          currency: 'USD',
        },
      },
      enterprise: {
        tier: 'enterprise' as const,
        name: 'Plan Enterprise',
        description: 'Para instituciones y equipos profesionales',
        features: [
          'Análisis ilimitados',
          'API completa',
          'Cartera ilimitada',
          'Alertas personalizadas',
          'Reportes personalizados',
          'Soporte dedicado 24/7',
          'Integración personalizada',
        ],
        limits: {
          searchesPerMonth: -1, // ilimitado
          portfolioItems: -1, // ilimitado
          alertsEnabled: true,
          prioritySupport: true,
          apiAccess: true,
        },
        pricing: {
          monthly: 99,
          yearly: 990,
          currency: 'USD',
        },
      },
    };

    return plans[tier];
  }

  /**
   * Obtener última actividad de un array de datos
   */
  private getLastActivity(data: any[], endpoint?: string): string {
    if (!data || data.length === 0) {
      return new Date(0).toISOString();
    }

    let filteredData = data;
    if (endpoint) {
      filteredData = data.filter((item: any) => item.endpoint === endpoint);
    }

    if (filteredData.length === 0) {
      return new Date(0).toISOString();
    }

    const latest = filteredData.reduce((latest: any, current: any) => {
      return new Date(current.created_at) > new Date(latest.created_at) ? current : latest;
    });

    return latest.created_at;
  }
}
