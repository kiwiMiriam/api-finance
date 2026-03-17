-- =================================
-- API FINANCE SUPABASE SCHEMA
-- =================================
-- Esquema basado en los contratos del README del frontend

-- =================================
-- ENUMS
-- =================================

-- Enum para planes de usuario
CREATE TYPE tier_plan AS ENUM ('free', 'pro', 'enterprise');

-- Enum para roles de aplicación
CREATE TYPE app_role AS ENUM ('admin', 'moderator', 'user');

-- Enum para mercados
CREATE TYPE market_type AS ENUM ('US', 'PE', 'GLOBAL');

-- =================================
-- TABLA: profiles
-- =================================
-- Extiende auth.users con información del perfil

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT,
    search_count INTEGER DEFAULT 0,
    tier_plan tier_plan DEFAULT 'free' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Índices
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_tier_plan ON public.profiles(tier_plan);

-- =================================
-- TABLA: portfolio
-- =================================
-- Cartera de activos por usuario

CREATE TABLE IF NOT EXISTS public.portfolio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    ticker TEXT NOT NULL,
    name TEXT NOT NULL,
    market market_type NOT NULL,
    sector TEXT,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraint único por usuario y ticker
    UNIQUE(user_id, ticker)
);

-- RLS para portfolio
ALTER TABLE public.portfolio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own portfolio" ON public.portfolio
    FOR ALL USING (auth.uid() = user_id);

-- Índices
CREATE INDEX IF NOT EXISTS idx_portfolio_user_id ON public.portfolio(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_ticker ON public.portfolio(ticker);
CREATE INDEX IF NOT EXISTS idx_portfolio_market ON public.portfolio(market);

-- =================================
-- TABLA: user_roles
-- =================================
-- Roles de seguridad para usuarios

CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    granted_by UUID REFERENCES auth.users(id),
    
    -- Constraint único por usuario y rol
    UNIQUE(user_id, role)
);

-- RLS para user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own roles" ON public.user_roles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" ON public.user_roles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- =================================
-- TABLA: analysis_cache
-- =================================
-- Cache de análisis para optimizar costos de API

CREATE TABLE IF NOT EXISTS public.analysis_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker TEXT NOT NULL,
    analysis_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    source TEXT DEFAULT 'financial_modeling_prep',
    
    -- Constraint único por ticker
    UNIQUE(ticker)
);

-- RLS para analysis_cache
ALTER TABLE public.analysis_cache ENABLE ROW LEVEL SECURITY;

-- Todos los usuarios autenticados pueden leer el cache
CREATE POLICY "Authenticated users can read cache" ON public.analysis_cache
    FOR SELECT USING (auth.role() = 'authenticated');

-- Solo el sistema puede escribir en el cache
CREATE POLICY "System can write to cache" ON public.analysis_cache
    FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update cache" ON public.analysis_cache
    FOR UPDATE USING (true);

-- Acceso público limitado para endpoints sin autenticación
CREATE POLICY "Public limited access to cache" ON public.analysis_cache
    FOR SELECT USING (
        auth.role() = 'anon' AND 
        created_at > NOW() - INTERVAL '1 hour'
    );

-- Índices
CREATE INDEX IF NOT EXISTS idx_analysis_cache_ticker ON public.analysis_cache(ticker);
CREATE INDEX IF NOT EXISTS idx_analysis_cache_expires_at ON public.analysis_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_analysis_cache_created_at ON public.analysis_cache(created_at);

-- Índice GIN para búsquedas en JSONB
CREATE INDEX IF NOT EXISTS idx_analysis_cache_data ON public.analysis_cache USING GIN(analysis_data);

-- =================================
-- TABLA: api_usage_log
-- =================================
-- Log de uso de APIs para auditoría

CREATE TABLE IF NOT EXISTS public.api_usage_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ticker TEXT,
    endpoint TEXT NOT NULL,
    api_provider TEXT NOT NULL,
    cost_credits INTEGER DEFAULT 1,
    response_status INTEGER,
    response_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para api_usage_log
ALTER TABLE public.api_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage logs" ON public.api_usage_log
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert usage logs" ON public.api_usage_log
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view all usage logs" ON public.api_usage_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Índices
CREATE INDEX IF NOT EXISTS idx_api_usage_log_user_id ON public.api_usage_log(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_log_ticker ON public.api_usage_log(ticker);
CREATE INDEX IF NOT EXISTS idx_api_usage_log_created_at ON public.api_usage_log(created_at DESC);

-- =================================
-- FUNCIONES AUXILIARES
-- =================================

-- Función para limpiar cache expirado
CREATE OR REPLACE FUNCTION public.clean_expired_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.analysis_cache 
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener estadísticas de usuario
CREATE OR REPLACE FUNCTION public.get_user_stats(target_user_id UUID)
RETURNS TABLE(
    total_searches INTEGER,
    searches_today INTEGER,
    searches_this_month INTEGER,
    tier tier_plan,
    portfolio_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.search_count as total_searches,
        (
            SELECT COUNT(*)::INTEGER 
            FROM public.api_usage_log 
            WHERE user_id = target_user_id 
            AND DATE(created_at) = CURRENT_DATE
            AND endpoint LIKE '%/analysis/%'
        ) as searches_today,
        (
            SELECT COUNT(*)::INTEGER 
            FROM public.api_usage_log 
            WHERE user_id = target_user_id 
            AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
            AND endpoint LIKE '%/analysis/%'
        ) as searches_this_month,
        p.tier_plan as tier,
        (
            SELECT COUNT(*)::INTEGER 
            FROM public.portfolio 
            WHERE user_id = target_user_id
        ) as portfolio_count
    FROM public.profiles p
    WHERE p.id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =================================
-- TRIGGERS
-- =================================

-- Trigger para crear perfil automáticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name, tier_plan)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
        'free'
    );
    
    -- Asignar rol de usuario por defecto
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear el trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =================================
-- COMENTARIOS
-- =================================

COMMENT ON TABLE public.profiles IS 'Perfiles extendidos de usuarios con tier y contadores';
COMMENT ON TABLE public.portfolio IS 'Carteras de activos por usuario';
COMMENT ON TABLE public.user_roles IS 'Roles de seguridad para control de acceso';
COMMENT ON TABLE public.analysis_cache IS 'Cache de análisis para optimizar costos de API';
COMMENT ON TABLE public.api_usage_log IS 'Log de uso de APIs para auditoría y facturación';

