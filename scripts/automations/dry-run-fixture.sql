\set ON_ERROR_STOP on

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE OR REPLACE FUNCTION public.portal_is_active_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$ SELECT false $$;

CREATE TABLE public.clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL DEFAULT 'Cliente',
    telefone TEXT,
    whatsapp TEXT
);

CREATE TABLE public.agendamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'Agendado',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.configuracoes_empresa (
    id UUID PRIMARY KEY,
    automations JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE OR REPLACE FUNCTION public.update_configuracoes_empresa_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = clock_timestamp();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_configuracoes_empresa_updated_at
BEFORE UPDATE ON public.configuracoes_empresa
FOR EACH ROW
EXECUTE FUNCTION public.update_configuracoes_empresa_updated_at();

INSERT INTO public.configuracoes_empresa (id, automations)
VALUES ('c0000000-0000-0000-0000-000000000000', '[]'::jsonb);

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
TO service_role;
