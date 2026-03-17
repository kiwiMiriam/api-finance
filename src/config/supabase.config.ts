import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseConfig {
  private supabaseClient: SupabaseClient;
  private supabaseServiceClient: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseAnonKey = this.configService.get<string>('SUPABASE_ANON_KEY');
    const supabaseServiceKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration. Please check your environment variables.');
    }

    // Cliente para operaciones con autenticación de usuario
    this.supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: false,
      },
    });

    // Cliente con service role para operaciones administrativas (bypass RLS)
    this.supabaseServiceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  /**
   * Cliente Supabase para operaciones con autenticación de usuario
   */
  getClient(): SupabaseClient {
    return this.supabaseClient;
  }

  /**
   * Cliente Supabase con service role para operaciones administrativas
   * Bypassa Row Level Security (RLS)
   */
  getServiceClient(): SupabaseClient {
    return this.supabaseServiceClient;
  }

  /**
   * Crea un cliente con token de usuario específico
   */
  getClientWithAuth(accessToken: string): SupabaseClient {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseAnonKey = this.configService.get<string>('SUPABASE_ANON_KEY');

    const client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    return client;
  }
}

/**
 * Tipos de base de datos para TypeScript
 */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string;
          display_name: string | null;
          tier: 'free' | 'premium' | 'enterprise';
          search_count: number;
          max_searches: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          display_name?: string | null;
          tier?: 'free' | 'premium' | 'enterprise';
          search_count?: number;
          max_searches?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          display_name?: string | null;
          tier?: 'free' | 'premium' | 'enterprise';
          search_count?: number;
          max_searches?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      portfolio: {
        Row: {
          id: string;
          user_id: string;
          ticker: string;
          sector: string | null;
          added_at: string;
          last_analysis: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          ticker: string;
          sector?: string | null;
          added_at?: string;
          last_analysis?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          ticker?: string;
          sector?: string | null;
          added_at?: string;
          last_analysis?: string | null;
        };
      };
      analysis_cache: {
        Row: {
          id: string;
          ticker: string;
          analysis_data: any;
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
      alerts: {
        Row: {
          id: string;
          ticker: string;
          severity: 'low' | 'medium' | 'high' | 'critical';
          indicator: string;
          value: number;
          threshold: number;
          message: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          ticker: string;
          severity: 'low' | 'medium' | 'high' | 'critical';
          indicator: string;
          value: number;
          threshold: number;
          message: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          ticker?: string;
          severity?: 'low' | 'medium' | 'high' | 'critical';
          indicator?: string;
          value?: number;
          threshold?: number;
          message?: string;
          created_at?: string;
        };
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: 'user' | 'admin' | 'analyst';
          granted_at: string;
          granted_by: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: 'user' | 'admin' | 'analyst';
          granted_at?: string;
          granted_by?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: 'user' | 'admin' | 'analyst';
          granted_at?: string;
          granted_by?: string | null;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      user_tier: 'free' | 'premium' | 'enterprise';
      alert_severity: 'low' | 'medium' | 'high' | 'critical';
      user_role: 'user' | 'admin' | 'analyst';
    };
  };
}
