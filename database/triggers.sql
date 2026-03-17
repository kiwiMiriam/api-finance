-- =================================
-- TRIGGERS Y FUNCIONES AUTOMÁTICAS
-- =================================
-- Este archivo contiene triggers para automatizar procesos

-- =================================
-- TRIGGER: Auto-crear perfil de usuario
-- =================================
-- Se ejecuta automáticamente cuando un nuevo usuario se registra en auth.users

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, display_name, tier, search_count, max_searches)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
        'free',
        0,
        5
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

-- =================================
-- TRIGGER: Actualizar updated_at en profiles
-- =================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar a la tabla profiles
DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =================================
-- TRIGGER: Validar límites de búsqueda
-- =================================
-- Previene que los usuarios excedan sus límites de búsqueda

CREATE OR REPLACE FUNCTION public.validate_search_limits()
RETURNS TRIGGER AS $$
DECLARE
    user_profile RECORD;
BEGIN
    -- Obtener perfil del usuario
    SELECT * INTO user_profile 
    FROM public.profiles 
    WHERE user_id = NEW.user_id;
    
    -- Verificar si el usuario existe
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Usuario no encontrado en profiles';
    END IF;
    
    -- Verificar límites solo para usuarios free y premium
    IF user_profile.tier != 'enterprise' THEN
        IF user_profile.search_count >= user_profile.max_searches THEN
            RAISE EXCEPTION 'Límite de búsquedas excedido. Tier: %, Límite: %, Usado: %', 
                user_profile.tier, user_profile.max_searches, user_profile.search_count;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar a api_usage_log cuando se registra una búsqueda
DROP TRIGGER IF EXISTS validate_search_limits_trigger ON public.api_usage_log;
CREATE TRIGGER validate_search_limits_trigger
    BEFORE INSERT ON public.api_usage_log
    FOR EACH ROW 
    WHEN (NEW.endpoint LIKE '%/analysis/%' AND NEW.user_id IS NOT NULL)
    EXECUTE FUNCTION public.validate_search_limits();

-- =================================
-- TRIGGER: Incrementar contador de búsquedas
-- =================================
-- Incrementa automáticamente el search_count cuando se hace una búsqueda

CREATE OR REPLACE FUNCTION public.increment_search_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo incrementar para endpoints de análisis con usuario autenticado
    IF NEW.endpoint LIKE '%/analysis/%' AND NEW.user_id IS NOT NULL THEN
        UPDATE public.profiles 
        SET search_count = search_count + 1,
            updated_at = NOW()
        WHERE user_id = NEW.user_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar después de insertar en api_usage_log
DROP TRIGGER IF EXISTS increment_search_count_trigger ON public.api_usage_log;
CREATE TRIGGER increment_search_count_trigger
    AFTER INSERT ON public.api_usage_log
    FOR EACH ROW EXECUTE FUNCTION public.increment_search_count();

-- =================================
-- TRIGGER: Limpiar cache expirado automáticamente
-- =================================
-- Se ejecuta periódicamente para limpiar registros expirados

CREATE OR REPLACE FUNCTION public.auto_clean_expired_cache()
RETURNS TRIGGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Limpiar cache expirado cada 100 inserciones (aproximadamente)
    IF random() < 0.01 THEN
        SELECT clean_expired_cache() INTO deleted_count;
        
        -- Log de limpieza (opcional)
        IF deleted_count > 0 THEN
            RAISE NOTICE 'Auto-limpieza de cache: % registros eliminados', deleted_count;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar a analysis_cache
DROP TRIGGER IF EXISTS auto_clean_cache_trigger ON public.analysis_cache;
CREATE TRIGGER auto_clean_cache_trigger
    AFTER INSERT ON public.analysis_cache
    FOR EACH ROW EXECUTE FUNCTION public.auto_clean_expired_cache();

-- =================================
-- TRIGGER: Generar alertas automáticas
-- =================================
-- Genera alertas cuando se detectan anomalías en análisis

CREATE OR REPLACE FUNCTION public.generate_fraud_alerts()
RETURNS TRIGGER AS $$
DECLARE
    analysis_data JSONB;
    beneish_score NUMERIC;
    alert_message TEXT;
    alert_severity alert_severity;
BEGIN
    analysis_data := NEW.analysis_data;
    
    -- Extraer Beneish M-Score si existe
    IF analysis_data ? 'beneishMScore' AND analysis_data->'beneishMScore' ? 'totalScore' THEN
        beneish_score := (analysis_data->'beneishMScore'->>'totalScore')::NUMERIC;
        
        -- Generar alerta si M-Score indica posible manipulación
        IF beneish_score > -1.78 THEN
            -- Determinar severidad basada en el score
            IF beneish_score > 0 THEN
                alert_severity := 'critical';
                alert_message := 'M-Score muy alto (' || beneish_score || ') - Alta probabilidad de manipulación contable';
            ELSIF beneish_score > -1.0 THEN
                alert_severity := 'high';
                alert_message := 'M-Score elevado (' || beneish_score || ') - Posible manipulación contable';
            ELSE
                alert_severity := 'medium';
                alert_message := 'M-Score por encima del umbral (' || beneish_score || ') - Revisar indicadores';
            END IF;
            
            -- Insertar alerta
            INSERT INTO public.alerts (ticker, severity, indicator, value, threshold, message)
            VALUES (
                NEW.ticker,
                alert_severity,
                'BENEISH_MSCORE',
                beneish_score,
                -1.78,
                alert_message
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar a analysis_cache
DROP TRIGGER IF EXISTS generate_alerts_trigger ON public.analysis_cache;
CREATE TRIGGER generate_alerts_trigger
    AFTER INSERT OR UPDATE ON public.analysis_cache
    FOR EACH ROW EXECUTE FUNCTION public.generate_fraud_alerts();

-- =================================
-- FUNCIONES DE UTILIDAD
-- =================================

-- Función para resetear contadores de búsqueda (útil para testing)
CREATE OR REPLACE FUNCTION public.reset_user_search_count(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.profiles 
    SET search_count = 0, updated_at = NOW()
    WHERE user_id = target_user_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para actualizar tier de usuario
CREATE OR REPLACE FUNCTION public.update_user_tier(target_user_id UUID, new_tier user_tier)
RETURNS BOOLEAN AS $$
DECLARE
    new_max_searches INTEGER;
BEGIN
    -- Determinar límites según tier
    CASE new_tier
        WHEN 'free' THEN new_max_searches := 5;
        WHEN 'premium' THEN new_max_searches := 100;
        WHEN 'enterprise' THEN new_max_searches := 999999; -- Prácticamente ilimitado
    END CASE;
    
    UPDATE public.profiles 
    SET tier = new_tier, 
        max_searches = new_max_searches,
        updated_at = NOW()
    WHERE user_id = target_user_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
