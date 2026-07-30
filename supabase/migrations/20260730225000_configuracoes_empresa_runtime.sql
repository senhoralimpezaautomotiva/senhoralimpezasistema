-- Migration: restaura a configuração central exigida pelo runtime e pelo worker.
-- Não armazena credenciais de provedores; segredos permanecem no ambiente do servidor.

BEGIN;

CREATE TABLE IF NOT EXISTS public.configuracoes_empresa (
    id UUID PRIMARY KEY DEFAULT 'c0000000-0000-0000-0000-000000000000'::uuid,
    company_name VARCHAR(255) DEFAULT 'Senhora Limpeza Estética Automotiva',
    phone VARCHAR(50),
    email VARCHAR(100),
    cnpj VARCHAR(50),
    address TEXT,
    hours_of_operation TEXT,
    logo_url TEXT,
    primary_color VARCHAR(50) DEFAULT '#0F172A',
    accent_color VARCHAR(50) DEFAULT '#0EA5E9',
    referral_active BOOLEAN DEFAULT TRUE,
    referral_discount_percent INTEGER DEFAULT 10,
    agenda JSONB,
    automations JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT configuracoes_empresa_automations_array
        CHECK (jsonb_typeof(automations) = 'array')
);

ALTER TABLE public.configuracoes_empresa
    ADD COLUMN IF NOT EXISTS agenda JSONB,
    ADD COLUMN IF NOT EXISTS automations JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.configuracoes_empresa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS configuracoes_empresa_select_public
    ON public.configuracoes_empresa;
DROP POLICY IF EXISTS configuracoes_empresa_insert_staff
    ON public.configuracoes_empresa;
DROP POLICY IF EXISTS configuracoes_empresa_update_staff
    ON public.configuracoes_empresa;

CREATE POLICY configuracoes_empresa_select_public
ON public.configuracoes_empresa
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY configuracoes_empresa_insert_staff
ON public.configuracoes_empresa
FOR INSERT
TO authenticated
WITH CHECK (public.portal_is_active_staff());

CREATE POLICY configuracoes_empresa_update_staff
ON public.configuracoes_empresa
FOR UPDATE
TO authenticated
USING (public.portal_is_active_staff())
WITH CHECK (public.portal_is_active_staff());

REVOKE ALL ON TABLE public.configuracoes_empresa FROM anon, authenticated;
GRANT SELECT ON TABLE public.configuracoes_empresa TO anon, authenticated;
GRANT INSERT, UPDATE ON TABLE public.configuracoes_empresa TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.configuracoes_empresa
    TO service_role;

CREATE OR REPLACE FUNCTION public.update_configuracoes_empresa_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_configuracoes_empresa_updated_at
    ON public.configuracoes_empresa;
CREATE TRIGGER trigger_update_configuracoes_empresa_updated_at
BEFORE UPDATE ON public.configuracoes_empresa
FOR EACH ROW
EXECUTE FUNCTION public.update_configuracoes_empresa_updated_at();

INSERT INTO public.configuracoes_empresa (id, automations)
VALUES (
    'c0000000-0000-0000-0000-000000000000'::uuid,
    '[]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
