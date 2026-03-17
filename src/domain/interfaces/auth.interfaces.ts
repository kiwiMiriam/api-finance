/**
 * Interfaces para el módulo de Autenticación
 */

/**
 * Perfil de usuario completo
 */
export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  
  // Plan y límites
  tier: 'free' | 'pro' | 'enterprise';
  searchCount: number;
  searchLimit: number;
  
  // Configuraciones
  preferences: {
    language: 'es' | 'en';
    timezone: string;
    emailNotifications: boolean;
    pushNotifications: boolean;
  };
  
  // Metadatos
  createdAt: string;
  lastLoginAt: string;
  isActive: boolean;
  isEmailVerified: boolean;
}

/**
 * Request para sincronizar perfil con Supabase
 */
export interface SyncProfileRequest {
  email: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}

/**
 * Response de sincronización
 */
export interface SyncProfileResponse {
  success: boolean;
  message: string;
  profile?: UserProfile;
  isNewUser: boolean;
}

/**
 * Estadísticas de uso del usuario
 */
export interface UserUsageStats {
  currentPeriod: {
    searchesUsed: number;
    searchesLimit: number;
    periodStart: string;
    periodEnd: string;
  };
  
  allTime: {
    totalSearches: number;
    totalAnalyses: number;
    portfolioItems: number;
    alertsGenerated: number;
    accountAge: number; // días
  };
  
  recentActivity: {
    lastAnalysis: string;
    lastPortfolioUpdate: string;
    lastLogin: string;
  };
}

/**
 * Request para actualizar perfil
 */
export interface UpdateProfileRequest {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  preferences?: {
    language?: 'es' | 'en';
    timezone?: string;
    emailNotifications?: boolean;
    pushNotifications?: boolean;
  };
}

/**
 * Información de plan de usuario
 */
export interface UserPlan {
  tier: 'free' | 'pro' | 'enterprise';
  name: string;
  description: string;
  features: string[];
  limits: {
    searchesPerMonth: number;
    portfolioItems: number;
    alertsEnabled: boolean;
    prioritySupport: boolean;
    apiAccess: boolean;
  };
  pricing: {
    monthly: number;
    yearly: number;
    currency: string;
  };
}

/**
 * Token de autenticación
 */
export interface AuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
  tokenType: 'Bearer';
  user: {
    id: string;
    email: string;
    role: string;
  };
}

/**
 * Request para cambio de plan
 */
export interface ChangePlanRequest {
  newTier: 'free' | 'pro' | 'enterprise';
  billingCycle: 'monthly' | 'yearly';
  paymentMethodId?: string;
}

/**
 * Response de cambio de plan
 */
export interface ChangePlanResponse {
  success: boolean;
  message: string;
  newPlan?: UserPlan;
  billingInfo?: {
    nextBillingDate: string;
    amount: number;
    currency: string;
  };
}

/**
 * Configuración de notificaciones
 */
export interface NotificationSettings {
  email: {
    enabled: boolean;
    fraudAlerts: boolean;
    portfolioUpdates: boolean;
    weeklyReports: boolean;
    marketingEmails: boolean;
  };
  push: {
    enabled: boolean;
    fraudAlerts: boolean;
    portfolioUpdates: boolean;
    priceAlerts: boolean;
  };
  inApp: {
    enabled: boolean;
    fraudAlerts: boolean;
    portfolioUpdates: boolean;
    systemUpdates: boolean;
  };
}

/**
 * Sesión de usuario
 */
export interface UserSession {
  id: string;
  userId: string;
  deviceInfo: {
    userAgent: string;
    ip: string;
    location?: string;
    deviceType: 'desktop' | 'mobile' | 'tablet';
  };
  createdAt: string;
  lastActiveAt: string;
  isActive: boolean;
}

/**
 * Actividad de usuario
 */
export interface UserActivity {
  id: string;
  userId: string;
  action: 'login' | 'logout' | 'analysis' | 'portfolio_add' | 'portfolio_remove' | 'alert_created' | 'profile_update';
  details: {
    [key: string]: any;
  };
  timestamp: string;
  ipAddress: string;
  userAgent: string;
}
