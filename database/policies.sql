-- =================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =================================
-- Este archivo contiene las políticas de seguridad a nivel de fila

-- =================================
-- HABILITAR RLS EN TODAS LAS TABLAS
-- =================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;

-- =================================
-- POLÍTICAS PARA TABLA: profiles
-- =================================

-- Los usuarios pueden ver y actualizar solo su propio perfil
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = user_id);

-- Los administradores pueden ver todos los perfiles
CREATE POLICY "Admins can view all profiles" ON public.profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Los administradores pueden actualizar cualquier perfil
CREATE POLICY "Admins can update any profile" ON public.profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Solo el sistema puede insertar perfiles (via trigger)
CREATE POLICY "System can insert profiles" ON public.profiles
    FOR INSERT WITH CHECK (true);

-- =================================
-- POLÍTICAS PARA TABLA: portfolio
-- =================================

-- Los usuarios pueden ver solo su propia cartera
CREATE POLICY "Users can view own portfolio" ON public.portfolio
    FOR SELECT USING (auth.uid() = user_id);

-- Los usuarios pueden insertar en su propia cartera
CREATE POLICY "Users can insert to own portfolio" ON public.portfolio
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Los usuarios pueden actualizar su propia cartera
CREATE POLICY "Users can update own portfolio" ON public.portfolio
    FOR UPDATE USING (auth.uid() = user_id);

-- Los usuarios pueden eliminar de su propia cartera
CREATE POLICY "Users can delete from own portfolio" ON public.portfolio
    FOR DELETE USING (auth.uid() = user_id);

-- Los administradores pueden ver todas las carteras
CREATE POLICY "Admins can view all portfolios" ON public.portfolio
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- =================================
-- POLÍTICAS PARA TABLA: analysis_cache
-- =================================

-- Todos los usuarios autenticados pueden leer el cache (es público)
CREATE POLICY "Authenticated users can read cache" ON public.analysis_cache
    FOR SELECT USING (auth.role() = 'authenticated');

-- Solo el sistema puede escribir en el cache
CREATE POLICY "System can write to cache" ON public.analysis_cache
    FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update cache" ON public.analysis_cache
    FOR UPDATE USING (true);

CREATE POLICY "System can delete from cache" ON public.analysis_cache
    FOR DELETE USING (true);

-- Los administradores pueden gestionar el cache
CREATE POLICY "Admins can manage cache" ON public.analysis_cache
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- =================================
-- POLÍTICAS PARA TABLA: alerts
-- =================================

-- Todos los usuarios autenticados pueden ver alertas (son públicas)
CREATE POLICY "Authenticated users can view alerts" ON public.alerts
    FOR SELECT USING (auth.role() = 'authenticated');

-- Solo el sistema puede crear alertas
CREATE POLICY "System can create alerts" ON public.alerts
    FOR INSERT WITH CHECK (true);

-- Los administradores y analistas pueden gestionar alertas
CREATE POLICY "Admins and analysts can manage alerts" ON public.alerts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role IN ('admin', 'analyst')
        )
    );

-- =================================
-- POLÍTICAS PARA TABLA: user_roles
-- =================================

-- Los usuarios pueden ver sus propios roles
CREATE POLICY "Users can view own roles" ON public.user_roles
    FOR SELECT USING (auth.uid() = user_id);

-- Solo los administradores pueden gestionar roles
CREATE POLICY "Admins can manage roles" ON public.user_roles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Los administradores pueden ver todos los roles
CREATE POLICY "Admins can view all roles" ON public.user_roles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- =================================
-- POLÍTICAS PARA TABLA: api_usage_log
-- =================================

-- Los usuarios pueden ver solo sus propios logs
CREATE POLICY "Users can view own usage logs" ON public.api_usage_log
    FOR SELECT USING (auth.uid() = user_id);

-- Solo el sistema puede insertar logs
CREATE POLICY "System can insert usage logs" ON public.api_usage_log
    FOR INSERT WITH CHECK (true);

-- Los administradores pueden ver todos los logs
CREATE POLICY "Admins can view all usage logs" ON public.api_usage_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Los administradores pueden gestionar logs
CREATE POLICY "Admins can manage usage logs" ON public.api_usage_log
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- =================================
-- POLÍTICAS PARA TABLA: sectors
-- =================================

-- Todos los usuarios autenticados pueden leer sectores (son públicos)
CREATE POLICY "Authenticated users can read sectors" ON public.sectors
    FOR SELECT USING (auth.role() = 'authenticated');

-- Solo los administradores pueden gestionar sectores
CREATE POLICY "Admins can manage sectors" ON public.sectors
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- =================================
-- POLÍTICAS ESPECIALES PARA ENDPOINTS PÚBLICOS
-- =================================

-- Crear una función para verificar si un endpoint es público
CREATE OR REPLACE FUNCTION public.is_public_endpoint(endpoint_path TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN endpoint_path LIKE '%/api/analysis/%' AND endpoint_path NOT LIKE '%/portfolio%';
END;
$$ LANGUAGE plpgsql;

-- Política especial para permitir acceso público limitado al cache
CREATE POLICY "Public access to analysis cache" ON public.analysis_cache
    FOR SELECT USING (
        -- Permitir acceso público solo si no hay usuario autenticado
        -- y el análisis es reciente (menos de 1 hora para usuarios no autenticados)
        auth.role() = 'anon' AND 
        created_at > NOW() - INTERVAL '1 hour'
    );

-- =================================
-- FUNCIONES DE UTILIDAD PARA POLÍTICAS
-- =================================

-- Función para verificar si un usuario es administrador
CREATE OR REPLACE FUNCTION public.is_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = user_uuid AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para verificar si un usuario es analista o administrador
CREATE OR REPLACE FUNCTION public.is_analyst_or_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = user_uuid AND role IN ('admin', 'analyst')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener el tier del usuario actual
CREATE OR REPLACE FUNCTION public.get_user_tier(user_uuid UUID DEFAULT auth.uid())
RETURNS TEXT AS $$
DECLARE
    user_tier_value TEXT;
BEGIN
    SELECT tier INTO user_tier_value
    FROM public.profiles 
    WHERE user_id = user_uuid;
    
    RETURN COALESCE(user_tier_value, 'free');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =================================
-- COMENTARIOS SOBRE SEGURIDAD
-- =================================

/*
NOTAS IMPORTANTES SOBRE SEGURIDAD:

1. RLS (Row Level Security) está habilitado en todas las tablas
2. Los usuarios solo pueden acceder a sus propios datos
3. Los administradores tienen acceso completo
4. Los analistas pueden gestionar alertas
5. El cache y las alertas son públicos para usuarios autenticados
6. Los endpoints públicos tienen acceso limitado al cache (1 hora)
7. Todas las políticas usan auth.uid() para identificar al usuario actual
8. Las funciones SECURITY DEFINER permiten operaciones privilegiadas

PARA TESTING:
- Usar el service role key para operaciones administrativas
- Usar tokens de usuario para operaciones normales
- Los endpoints públicos usan el anon key

PARA PRODUCCIÓN:
- Revisar y ajustar los tiempos de cache público
- Monitorear el uso de recursos
- Implementar rate limiting adicional si es necesario
*/
