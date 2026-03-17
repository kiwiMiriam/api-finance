import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator para obtener el usuario actual del request
 * Uso: @CurrentUser() user: AuthenticatedUser
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

/**
 * Decorator para obtener el cliente Supabase del usuario actual
 * Uso: @UserSupabase() supabase: SupabaseClient
 */
export const UserSupabase = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.supabase;
  },
);

/**
 * Interface para el usuario autenticado
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  profile: {
    id: string;
    email: string;
    display_name: string | null;
    search_count: number;
    tier_plan: 'free' | 'pro' | 'enterprise';
    created_at: string;
    updated_at: string;
  };
  roles: string[];
  supabaseUser: any;
}

