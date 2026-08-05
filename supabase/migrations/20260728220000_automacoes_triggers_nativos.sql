-- Migration: Enfileiramento nativo de automações via Triggers PostgreSQL e deduplicação.
-- Data: 2026-07-28
-- Descrição: Garante a persistência atômica das automações diretamente no banco de dados,
-- eliminando dependências do navegador e aplicando regras transacionais estritas.

BEGIN;

-- 1. Adicionar coluna deduplication_key para garantia de idempotência
ALTER TABLE public.automacoes_execucoes 
ADD COLUMN IF NOT EXISTS deduplication_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_automacoes_execucoes_dedup_key 
ON public.automacoes_execucoes (deduplication_key) 
WHERE deduplication_key IS NOT NULL;

-- 2. Atualizar CHECK constraint da coluna status para aceitar 'cancelada'
ALTER TABLE public.automacoes_execucoes 
DROP CONSTRAINT IF EXISTS automacoes_execucoes_status_check;

ALTER TABLE public.automacoes_execucoes 
ADD CONSTRAINT automacoes_execucoes_status_check 
CHECK (status IN ('pendente', 'processando', 'sucesso', 'erro_definitivo', 'cancelada'));

-- 3. Função do Trigger de Novo Cliente (Degradável: exceções secundárias registradas sem interromper o cadastro)
CREATE OR REPLACE FUNCTION public.fn_trigger_enfileirar_novo_cliente()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_clean_phone TEXT;
BEGIN
    v_clean_phone := regexp_replace(coalesce(NEW.telefone, ''), '\D', '', 'g');
    IF length(v_clean_phone) < 8 THEN
        RETURN NEW;
    END IF;

    BEGIN
        INSERT INTO public.automacoes_execucoes (
            empresa_id,
            automacao,
            customer_id,
            telefone,
            mensagem,
            status,
            tentativas,
            data_execucao,
            deduplication_key
        ) VALUES (
            'c0000000-0000-0000-0000-000000000000'::uuid,
            'novo_cliente',
            NEW.id,
            coalesce(NEW.telefone, ''),
            '',
            'pendente',
            0,
            now(),
            'novo_cliente:' || NEW.id
        ) ON CONFLICT (deduplication_key) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Falha ao enfileirar automacao novo_cliente: %', SQLERRM;
    END;

    RETURN NEW;
END;
$$;

-- 4. Função do Trigger Principal de Agendamentos (Trata obrigatoriedade de confirmação e degradação de status)
CREATE OR REPLACE FUNCTION public.fn_trigger_enfileirar_agendamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_clean_phone TEXT;
    v_cliente_telefone TEXT;
    v_lower_status TEXT;
    v_old_lower_status TEXT;
BEGIN
    -- Buscar telefone atualizado do cliente
    SELECT telefone INTO v_cliente_telefone
    FROM public.clientes
    WHERE id = NEW.cliente_id;

    v_clean_phone := regexp_replace(coalesce(v_cliente_telefone, ''), '\D', '', 'g');
    IF v_clean_phone IS NULL OR length(v_clean_phone) < 8 THEN
        RETURN NEW;
    END IF;

    v_lower_status := lower(coalesce(NEW.status, ''));
    v_old_lower_status := CASE WHEN TG_OP = 'UPDATE' THEN lower(coalesce(OLD.status, '')) ELSE '' END;

    -- A. NOVO AGENDAMENTO (OBRIGATÓRIO: ERRO GRAVE PROPAGA ROLLBACK / DUPLICIDADE É IGNORADA VIA ON CONFLICT DO NOTHING)
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND v_old_lower_status <> 'agendado' AND v_old_lower_status <> 'confirmado' AND (v_lower_status = 'agendado' OR v_lower_status = 'confirmado')) THEN
        INSERT INTO public.automacoes_execucoes (
            empresa_id,
            automacao,
            appointment_id,
            customer_id,
            telefone,
            mensagem,
            status,
            tentativas,
            data_execucao,
            deduplication_key
        ) VALUES (
            'c0000000-0000-0000-0000-000000000000'::uuid,
            'novo_agendamento',
            NEW.id,
            NEW.cliente_id,
            v_cliente_telefone,
            '',
            'pendente',
            0,
            now(),
            'novo_agendamento:' || NEW.id
        ) ON CONFLICT (deduplication_key) DO NOTHING;
    END IF;

    -- B. SERVIÇO INICIADO (DEGRADÁVEL)
    IF TG_OP = 'UPDATE' AND v_old_lower_status <> 'em_andamento' AND v_old_lower_status <> 'em andamento' AND (v_lower_status = 'em_andamento' OR v_lower_status = 'em andamento') THEN
        BEGIN
            INSERT INTO public.automacoes_execucoes (
                empresa_id,
                automacao,
                appointment_id,
                customer_id,
                telefone,
                mensagem,
                status,
                tentativas,
                data_execucao,
                deduplication_key
            ) VALUES (
                'c0000000-0000-0000-0000-000000000000'::uuid,
                'servico_iniciado',
                NEW.id,
                NEW.cliente_id,
                v_cliente_telefone,
                '',
                'pendente',
                0,
                now(),
                'servico_iniciado:' || NEW.id
            ) ON CONFLICT (deduplication_key) DO NOTHING;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Falha ao enfileirar automacao servico_iniciado: %', SQLERRM;
        END;
    END IF;

    -- C. SERVIÇO FINALIZADO & PESQUISA DE SATISFAÇÃO (DEGRADÁVEIS)
    IF TG_OP = 'UPDATE' AND (v_old_lower_status NOT IN ('finalizado', 'entregue', 'concluido')) AND (v_lower_status IN ('finalizado', 'entregue', 'concluido')) THEN
        BEGIN
            INSERT INTO public.automacoes_execucoes (
                empresa_id,
                automacao,
                appointment_id,
                customer_id,
                telefone,
                mensagem,
                status,
                tentativas,
                data_execucao,
                deduplication_key
            ) VALUES (
                'c0000000-0000-0000-0000-000000000000'::uuid,
                'servico_finalizado',
                NEW.id,
                NEW.cliente_id,
                v_cliente_telefone,
                '',
                'pendente',
                0,
                now(),
                'servico_finalizado:' || NEW.id
            ) ON CONFLICT (deduplication_key) DO NOTHING;

            INSERT INTO public.automacoes_execucoes (
                empresa_id,
                automacao,
                appointment_id,
                customer_id,
                telefone,
                mensagem,
                status,
                tentativas,
                data_execucao,
                deduplication_key
            ) VALUES (
                'c0000000-0000-0000-0000-000000000000'::uuid,
                'pagamento_recebido',
                NEW.id,
                NEW.cliente_id,
                v_cliente_telefone,
                '',
                'pendente',
                0,
                now(),
                'pagamento_recebido:' || NEW.id
            ) ON CONFLICT (deduplication_key) DO NOTHING;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Falha ao enfileirar automacoes de finalizacao: %', SQLERRM;
        END;
    END IF;

    RETURN NEW;
END;
$$;

-- 5. Função de Cancelamento Automático de Automações Pendentes
CREATE OR REPLACE FUNCTION public.fn_trigger_cancelar_automacoes_agendamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND lower(coalesce(NEW.status, '')) = 'cancelado' AND lower(coalesce(OLD.status, '')) <> 'cancelado' THEN
        UPDATE public.automacoes_execucoes
        SET status = 'cancelada',
            updated_at = now()
        WHERE appointment_id = NEW.id
          AND status = 'pendente';
    END IF;
    RETURN NEW;
END;
$$;

-- 6. Associação dos Triggers às Tabelas
DROP TRIGGER IF EXISTS trigger_enfileirar_novo_cliente ON public.clientes;
CREATE TRIGGER trigger_enfileirar_novo_cliente
    AFTER INSERT ON public.clientes
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_trigger_enfileirar_novo_cliente();

DROP TRIGGER IF EXISTS trigger_enfileirar_agendamento ON public.agendamentos;
CREATE TRIGGER trigger_enfileirar_agendamento
    AFTER INSERT OR UPDATE ON public.agendamentos
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_trigger_enfileirar_agendamento();

DROP TRIGGER IF EXISTS trigger_cancelar_automacoes_agendamento ON public.agendamentos;
CREATE TRIGGER trigger_cancelar_automacoes_agendamento
    AFTER UPDATE OF status ON public.agendamentos
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_trigger_cancelar_automacoes_agendamento();

COMMIT;
