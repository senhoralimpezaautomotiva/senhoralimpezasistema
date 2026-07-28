-- Migration: Criação da tabela public.automacoes_execucoes e políticas RLS para automações.
-- Esta migração é idempotente e preserva todas as políticas de segurança do Portal do Cliente.

BEGIN;

CREATE TABLE IF NOT EXISTS public.automacoes_execucoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL DEFAULT 'c0000000-0000-0000-0000-000000000000'::uuid,
    automacao TEXT NOT NULL,
    appointment_id UUID REFERENCES public.agendamentos(id) ON DELETE SET NULL,
    customer_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    telefone TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente',
    tentativas INTEGER NOT NULL DEFAULT 0,
    resposta_api TEXT,
    data_execucao TIMESTAMPTZ NOT NULL,
    data_proxima_tentativa TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT automacoes_execucoes_status_check CHECK (status IN ('pendente', 'processando', 'sucesso', 'erro_definitivo'))
);

-- Garantir índices para alta performance da fila de automação
CREATE INDEX IF NOT EXISTS idx_automacoes_execucoes_status_data ON public.automacoes_execucoes (status, data_execucao);
CREATE INDEX IF NOT EXISTS idx_automacoes_execucoes_customer ON public.automacoes_execucoes (customer_id);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_automacoes_execucoes_updated_at()
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

DROP TRIGGER IF EXISTS trigger_automacoes_execucoes_updated_at ON public.automacoes_execucoes;
CREATE TRIGGER trigger_automacoes_execucoes_updated_at
    BEFORE UPDATE ON public.automacoes_execucoes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_automacoes_execucoes_updated_at();

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.automacoes_execucoes ENABLE ROW LEVEL SECURITY;

-- Limpar políticas existentes se houver
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'automacoes_execucoes'
    LOOP
        EXECUTE format(
            'DROP POLICY IF EXISTS %I ON public.automacoes_execucoes',
            policy_record.policyname
        );
    END LOOP;
END $$;

-- Permitir acesso para membros ativos da equipe (interface administrativa)
CREATE POLICY "automacoes_execucoes_select_staff"
ON public.automacoes_execucoes
FOR SELECT
TO authenticated
USING (public.portal_is_active_staff());

CREATE POLICY "automacoes_execucoes_insert_staff"
ON public.automacoes_execucoes
FOR INSERT
TO authenticated
WITH CHECK (public.portal_is_active_staff());

CREATE POLICY "automacoes_execucoes_update_staff"
ON public.automacoes_execucoes
FOR UPDATE
TO authenticated
USING (public.portal_is_active_staff())
WITH CHECK (public.portal_is_active_staff());

-- Conceder permissões para a role service_role (usada pelo backend Node.js no Render) e equipe autenticada
REVOKE ALL ON TABLE public.automacoes_execucoes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.automacoes_execucoes TO authenticated, service_role;

COMMIT;
