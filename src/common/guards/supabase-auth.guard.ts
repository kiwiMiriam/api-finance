import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SupabaseConfigService } from '../../config/supabase.config';

/**
 * Guard para autenticación con Supabase
 * Verifica tokens JWT de Supabase y establece el usuario en el request
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private supabaseConfig: SupabaseConfigService,
    private reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // Verificar si la ruta es pública
    const isPublic = this.reflector.get<boolean>('isPublic', context.getHandler());
    if (isPublic) {
      return true;
    }

    // Extraer token del header Authorization
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de acceso requerido');
    }

    const token = authHeader.substring(7);

    try {
      // Verificar token con Supabase
      const supabase = this.supabaseConfig.getUserClient();
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        throw new UnauthorizedException('Token inválido o expirado');
      }

      // Obtener perfil del usuario
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      // Obtener roles del usuario
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      // Establecer usuario en el request
      request.user = {
        id: user.id,
        email: user.email,
        profile,
        roles: roles?.map(r => r.role) || ['user'],
        supabaseUser: user
      };

      // Crear cliente Supabase con el token del usuario
      request.supabase = this.supabaseConfig.createUserClient(token);

      return true;
    } catch (error) {
      throw new UnauthorizedException('Error al verificar autenticación');
    }
  }
}

