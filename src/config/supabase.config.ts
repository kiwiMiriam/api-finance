import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Configuración de Supabase con múltiples clientes
 * - Cliente de usuario: Para operaciones con RLS
 * - Cliente de servicio: Para operaciones administrativas
 */

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          search_count: number;
          tier_plan: 'free' | 'pro' | 'enterprise';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          search_count?: number;
          tier_plan?: 'free' | 'pro' | 'enterprise';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string | null;
          search_count?: number;
          tier_plan?: 'free' | 'pro' | 'enterprise';
          created_at?: string;
          updated_at?: string;
        };
      };
      portfolio: {
        Row: {
          id: string;
          user_id: string;
          ticker: string;
          name: string;
          market: 'US' | 'PE' | 'GLOBAL';
          sector: string | null;
          added_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          ticker: string;
          name: string;
          market: 'US' | 'PE' | 'GLOBAL';
          sector?: string | null;
          added_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          ticker?: string;
          name?: string;
          market?: 'US' | 'PE' | 'GLOBAL';
          sector?: string | null;
          added_at?: string;
        };
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: 'admin' | 'moderator' | 'user';
          granted_at: string;
          granted_by: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: 'admin' | 'moderator' | 'user';
          granted_at?: string;
          granted_by?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: 'admin' | 'moderator' | 'user';
          granted_at?: string;
          granted_by?: string | null;
        };
      };
      analysis_cache: {
        Row: {
          id: string;
          ticker: string;
          analysis_data: any; // JSONB
          created_at: string;
          expires_at: string;
          source: string;
        };
        Insert: {
          id?: string;
          ticker: string;
          analysis_data: any;
          created_at?: string;
          expires_at: string;
          source?: string;
        };
        Update: {
          id?: string;
          ticker?: string;
          analysis_data?: any;
          created_at?: string;
          expires_at?: string;
          source?: string;
        };
      };
      api_usage_log: {
        Row: {
          id: string;
          user_id: string | null;
          ticker: string | null;
          endpoint: string;
          api_provider: string;
          cost_credits: number;
          response_status: number | null;
          response_time_ms: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          ticker?: string | null;
          endpoint: string;
          api_provider: string;
          cost_credits?: number;
          response_status?: number | null;
          response_time_ms?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          ticker?: string | null;
          endpoint?: string;
          api_provider?: string;
          cost_credits?: number;
          response_status?: number | null;
          response_time_ms?: number | null;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      clean_expired_cache: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      get_user_stats: {
        Args: {
          target_user_id: string;
        };
        Returns: {
          total_searches: number;
          searches_today: number;
          searches_this_month: number;
          tier: 'free' | 'pro' | 'enterprise';
          portfolio_count: number;
        }[];
      };
    };
    Enums: {
      tier_plan: 'free' | 'pro' | 'enterprise';
      app_role: 'admin' | 'moderator' | 'user';
      market_type: 'US' | 'PE' | 'GLOBAL';
    };
  };
}

@Injectable()
export class SupabaseConfigService {
  private readonly supabaseUrl: string;
  private readonly supabaseAnonKey: string;
  private readonly supabaseServiceRoleKey: string;

  // Cliente para operaciones de usuario (con RLS)
  private userClient: SupabaseClient<Database>;
  
  // Cliente para operaciones de servicio (bypass RLS)
  private serviceClient: SupabaseClient<Database>;

  constructor(private configService: ConfigService) {
    this.supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    this.supabaseAnonKey = this.configService.get<string>('SUPABASE_ANON_KEY');
    this.supabaseServiceRoleKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!this.supabaseUrl || !this.supabaseAnonKey || !this.supabaseServiceRoleKey) {
      throw new Error('Supabase configuration is missing. Please check your environment variables.');
    }

    // Inicializar clientes
    this.userClient = createClient<Database>(this.supabaseUrl, this.supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: false
      }
    });

    this.serviceClient = createClient<Database>(this.supabaseUrl, this.supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  /**
   * Cliente para operaciones de usuario con RLS habilitado
   * Usar para operaciones que requieren autenticación de usuario
   */
  getUserClient(): SupabaseClient<Database> {
    return this.userClient;
  }

  /**
   * Cliente para operaciones de servicio que bypasean RLS
   * Usar para operaciones administrativas y del sistema
   */
  getServiceClient(): SupabaseClient<Database> {
    return this.serviceClient;
  }

  /**
   * Crear cliente con token de usuario específico
   * Útil para operaciones en nombre de un usuario específico
   */
  createUserClient(accessToken: string): SupabaseClient<Database> {
    const client = createClient<Database>(this.supabaseUrl, this.supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    });

    return client;
  }

  /**
   * Verificar la conexión con Supabase
   */
  async healthCheck(): Promise<boolean> {
    try {
      const { data, error } = await this.serviceClient
        .from('profiles')
        .select('count')
        .limit(1);

      return !error;
    } catch (error) {
      console.error('Supabase health check failed:', error);
      return false;
    }
  }

  /**
   * Obtener configuración para el frontend
   */
  getPublicConfig() {
    return {
      supabaseUrl: this.supabaseUrl,
      supabaseAnonKey: this.supabaseAnonKey
    };
  }
}

