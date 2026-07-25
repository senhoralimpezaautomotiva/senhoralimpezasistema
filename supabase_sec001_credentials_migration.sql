-- SEC001 - contenção de credenciais e separação de configuração pública.
-- Pré-requisito: supabase_usuarios_rls_migration.sql aplicado, incluindo
-- public.is_active_usuario_admin().

BEGIN;

ALTER TABLE public.configuracoes_empresa ENABLE ROW LEVEL SECURITY;

-- Remove os valores expostos somente depois que os segredos já estiverem
-- cadastrados no ambiente seguro do servidor.
ALTER TABLE public.configuracoes_empresa
    DROP COLUMN IF EXISTS zapi_instance_id,
    DROP COLUMN IF EXISTS zapi_token,
    DROP COLUMN IF EXISTS zapi_client_token,
    DROP COLUMN IF EXISTS make_webhook_url;

-- Elimina políticas anteriores, inclusive as que permitiam escrita pública.
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'configuracoes_empresa'
    LOOP
        EXECUTE format(
            'DROP POLICY IF EXISTS %I ON public.configuracoes_empresa',
            policy_record.policyname
        );
    END LOOP;
END $$;

REVOKE ALL ON public.configuracoes_empresa FROM anon, authenticated;
GRANT SELECT ON public.configuracoes_empresa TO anon, authenticated;
GRANT INSERT, UPDATE ON public.configuracoes_empresa TO authenticated;

-- A leitura pública permanece possível porque a tabela não contém segredos.
CREATE POLICY "configuracoes_empresa_select_public"
ON public.configuracoes_empresa
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "configuracoes_empresa_insert_admin"
ON public.configuracoes_empresa
FOR INSERT
TO authenticated
WITH CHECK ((SELECT public.is_active_usuario_admin()));

CREATE POLICY "configuracoes_empresa_update_admin"
ON public.configuracoes_empresa
FOR UPDATE
TO authenticated
USING ((SELECT public.is_active_usuario_admin()))
WITH CHECK ((SELECT public.is_active_usuario_admin()));

-- Remove o registro-fallback que versões antigas armazenavam em clientes.
DO $$
BEGIN
    IF to_regclass('public.clientes') IS NOT NULL THEN
        DELETE FROM public.clientes
        WHERE id = 'c0000000-0000-0000-0000-000000000000'::uuid
          AND telefone = '00000000000';
    END IF;
END $$;

COMMIT;
