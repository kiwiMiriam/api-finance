-- =================================
-- API FINANCE DATABASE SCHEMA
-- =================================
-- Este archivo contiene las definiciones de tablas para Supabase
-- Ejecutar en el SQL Editor de Supabase Dashboard

-- =================================
-- ENUMS
-- =================================

-- Enum para tiers de usuario
CREATE TYPE user_tier AS ENUM ('free', 'premium', 'enterprise');

-- Enum para severidad de alertas
CREATE TYPE alert_severity AS ENUM ('low', 'medium', 'high', 'critical');

-- Enum para roles de usuario
CREATE TYPE user_role AS ENUM ('user', 'admin', 'analyst');

-- =================================
-- TABLA: profiles
-- =================================
-- Extiende la tabla auth.users con información adicional del perfil

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    display_name TEXT,
    tier user_tier DEFAULT 'free' NOT NULL,
    search_count INTEGER DEFAULT 0 NOT NULL,
    max_searches INTEGER DEFAULT 5 NOT NULL, -- 5 para free, 100 para premium, ilimitado para enterprise
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_tier ON public.profiles(tier);

-- =================================
-- TABLA: portfolio
-- =================================
-- Almacena los activos en la cartera de cada usuario

CREATE TABLE IF NOT EXISTS public.portfolio (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    ticker VARCHAR(10) NOT NULL,
    sector VARCHAR(100),
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    last_analysis TIMESTAMP WITH TIME ZONE,
    
    -- Constraint para evitar duplicados por usuario
    UNIQUE(user_id, ticker)
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_portfolio_user_id ON public.portfolio(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_ticker ON public.portfolio(ticker);
CREATE INDEX IF NOT EXISTS idx_portfolio_sector ON public.portfolio(sector);

-- =================================
-- TABLA: analysis_cache
-- =================================
-- Cache de análisis para optimizar costos de API externa

CREATE TABLE IF NOT EXISTS public.analysis_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticker VARCHAR(10) NOT NULL,
    analysis_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    source VARCHAR(50) DEFAULT 'financial_modeling_prep' NOT NULL,
    
    -- Constraint para evitar duplicados por ticker activo
    UNIQUE(ticker, source)
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_analysis_cache_ticker ON public.analysis_cache(ticker);
CREATE INDEX IF NOT EXISTS idx_analysis_cache_expires_at ON public.analysis_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_analysis_cache_source ON public.analysis_cache(source);

-- Índice GIN para búsquedas en JSONB
CREATE INDEX IF NOT EXISTS idx_analysis_cache_data ON public.analysis_cache USING GIN(analysis_data);

-- =================================
-- TABLA: alerts
-- =================================
-- Almacena alertas de fraude y anomalías detectadas

CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticker VARCHAR(10) NOT NULL,
    severity alert_severity NOT NULL,
    indicator VARCHAR(50) NOT NULL, -- DSRI, GMI, AQI, etc.
    value DECIMAL(10,4) NOT NULL,
    threshold DECIMAL(10,4) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_alerts_ticker ON public.alerts(ticker);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON public.alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_indicator ON public.alerts(indicator);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON public.alerts(created_at DESC);

-- =================================
-- TABLA: user_roles
-- =================================
-- Gestión de roles y permisos de usuarios

CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role user_role DEFAULT 'user' NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    granted_by UUID REFERENCES auth.users(id),
    
    -- Constraint para evitar roles duplicados por usuario
    UNIQUE(user_id, role)
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- =================================
-- TABLA: api_usage_log
-- =================================
-- Log de uso de APIs externas para auditoría y control de costos

CREATE TABLE IF NOT EXISTS public.api_usage_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ticker VARCHAR(10),
    endpoint VARCHAR(100) NOT NULL,
    api_provider VARCHAR(50) NOT NULL,
    cost_credits INTEGER DEFAULT 1 NOT NULL,
    response_status INTEGER,
    response_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_api_usage_log_user_id ON public.api_usage_log(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_log_ticker ON public.api_usage_log(ticker);
CREATE INDEX IF NOT EXISTS idx_api_usage_log_created_at ON public.api_usage_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_log_api_provider ON public.api_usage_log(api_provider);

-- =================================
-- FUNCIONES AUXILIARES
-- =================================

-- Función para limpiar cache expirado
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.analysis_cache 
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener estadísticas de uso por usuario
CREATE OR REPLACE FUNCTION get_user_usage_stats(target_user_id UUID)
RETURNS TABLE(
    total_searches INTEGER,
    searches_today INTEGER,
    searches_this_month INTEGER,
    most_searched_ticker VARCHAR(10)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_searches,
        COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END)::INTEGER as searches_today,
        COUNT(CASE WHEN DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE) THEN 1 END)::INTEGER as searches_this_month,
        (
            SELECT ticker 
            FROM public.api_usage_log 
            WHERE user_id = target_user_id AND ticker IS NOT NULL
            GROUP BY ticker 
            ORDER BY COUNT(*) DESC 
            LIMIT 1
        ) as most_searched_ticker
    FROM public.api_usage_log 
    WHERE user_id = target_user_id;
END;
$$ LANGUAGE plpgsql;

-- =================================
-- COMENTARIOS EN TABLAS
-- =================================

COMMENT ON TABLE public.profiles IS 'Perfiles extendidos de usuarios con información de tier y límites de uso';
COMMENT ON TABLE public.portfolio IS 'Carteras de activos de cada usuario';
COMMENT ON TABLE public.analysis_cache IS 'Cache de análisis financieros para optimizar costos de API';
COMMENT ON TABLE public.alerts IS 'Alertas de fraude y anomalías detectadas en análisis';
COMMENT ON TABLE public.user_roles IS 'Roles y permisos de usuarios del sistema';
COMMENT ON TABLE public.api_usage_log IS 'Log de uso de APIs externas para auditoría y control de costos';

-- =================================
-- DATOS INICIALES (OPCIONAL)
-- =================================

-- Insertar sectores comunes para referencia
-- Esta tabla es opcional y puede ser útil para categorización
CREATE TABLE IF NOT EXISTS public.sectors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Sectores comunes del mercado
INSERT INTO public.sectors (name, description) VALUES
('Technology', 'Empresas de tecnología y software'),
('Healthcare', 'Empresas farmacéuticas y de salud'),
('Financial Services', 'Bancos, seguros y servicios financieros'),
('Consumer Discretionary', 'Bienes de consumo no esenciales'),
('Consumer Staples', 'Bienes de consumo esenciales'),
('Energy', 'Empresas de petróleo, gas y energía renovable'),
('Industrials', 'Empresas industriales y manufactureras'),
('Materials', 'Empresas de materias primas y químicos'),
('Real Estate', 'Empresas inmobiliarias y REITs'),
('Utilities', 'Empresas de servicios públicos'),
('Communication Services', 'Telecomunicaciones y medios')
ON CONFLICT (name) DO NOTHING;
