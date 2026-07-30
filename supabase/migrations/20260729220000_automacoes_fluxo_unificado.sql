-- Migration: unifica a produção de automações em um outbox de eventos.
-- Os triggers registram somente fatos de negócio. A aplicação é a única
-- responsável por localizar o template, renderizar e criar a execução.

BEGIN;

CREATE TABLE IF NOT EXISTS public.automacoes_eventos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automacao TEXT NOT NULL,
    appointment_id UUID REFERENCES public.agendamentos(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    deduplication_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    CONSTRAINT automacoes_eventos_status_check
        CHECK (status IN ('pendente', 'processado', 'ignorado'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_automacoes_eventos_dedup_key
    ON public.automacoes_eventos (deduplication_key);

CREATE INDEX IF NOT EXISTS idx_automacoes_eventos_status_created
    ON public.automacoes_eventos (status, created_at);

ALTER TABLE public.automacoes_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS automacoes_eventos_select_staff ON public.automacoes_eventos;
CREATE POLICY automacoes_eventos_select_staff
ON public.automacoes_eventos
FOR SELECT
TO authenticated
USING (public.portal_is_active_staff());

DROP POLICY IF EXISTS automacoes_eventos_update_staff ON public.automacoes_eventos;
CREATE POLICY automacoes_eventos_update_staff
ON public.automacoes_eventos
FOR UPDATE
TO authenticated
USING (public.portal_is_active_staff())
WITH CHECK (public.portal_is_active_staff());

REVOKE ALL ON TABLE public.automacoes_eventos FROM anon;
GRANT SELECT, UPDATE ON TABLE public.automacoes_eventos TO authenticated, service_role;
GRANT INSERT, DELETE ON TABLE public.automacoes_eventos TO service_role;

CREATE OR REPLACE FUNCTION public.fn_registrar_evento_automacao(
    p_automacao TEXT,
    p_customer_id UUID,
    p_appointment_id UUID,
    p_deduplication_key TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_is_active BOOLEAN;
    v_automations JSONB;
BEGIN
    IF p_automacao NOT IN (
        'novo_cliente',
        'novo_agendamento',
        'servico_iniciado',
        'servico_finalizado',
        'pagamento_recebido'
    ) THEN
        RAISE EXCEPTION 'Evento de automação inválido: %', p_automacao;
    END IF;

    SELECT CASE
        WHEN jsonb_typeof(config.automations) = 'array' THEN config.automations
        ELSE '[]'::jsonb
    END
    INTO v_automations
    FROM public.configuracoes_empresa AS config
    WHERE config.id = 'c0000000-0000-0000-0000-000000000000'::uuid;

    v_automations := coalesce(v_automations, '[]'::jsonb);

    -- Instalações legadas com configuração vazia usam os templates padrão já
    -- carregados pelo motor. Assim que o painel persistir uma configuração,
    -- o estado explícito de isActive volta a ser a fonte de verdade.
    IF jsonb_array_length(v_automations) = 0 THEN
        v_is_active := TRUE;
    ELSE
        SELECT EXISTS (
            SELECT 1
            FROM jsonb_array_elements(v_automations) AS item
            WHERE item->>'event' = p_automacao
              AND item->'isActive' = 'true'::jsonb
              AND length(trim(coalesce(item->>'template', ''))) > 0
        )
        INTO v_is_active;
    END IF;

    IF NOT v_is_active THEN
        RETURN;
    END IF;

    INSERT INTO public.automacoes_eventos (
        automacao,
        appointment_id,
        customer_id,
        deduplication_key
    )
    VALUES (
        p_automacao,
        p_appointment_id,
        p_customer_id,
        p_deduplication_key
    )
    ON CONFLICT (deduplication_key) DO NOTHING;
EXCEPTION WHEN OTHERS THEN
    -- O registro da automação é secundário e nunca pode reverter o cadastro,
    -- o agendamento ou uma mudança de status da operação principal.
    RAISE WARNING 'Falha isolada ao registrar evento de automação %: %',
        p_automacao,
        SQLERRM;
    RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_registrar_evento_automacao(TEXT, UUID, UUID, TEXT)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_trigger_enfileirar_novo_cliente()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM public.fn_registrar_evento_automacao(
        'novo_cliente',
        NEW.id,
        NULL,
        'novo_cliente:' || NEW.id
    );
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_trigger_enfileirar_agendamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_status TEXT;
    v_old_status TEXT;
BEGIN
    v_status := translate(
        lower(coalesce(NEW.status, '')),
        'áàâãéêíóôõúç',
        'aaaaeeiooouc'
    );
    v_old_status := CASE
        WHEN TG_OP = 'UPDATE' THEN translate(
            lower(coalesce(OLD.status, '')),
            'áàâãéêíóôõúç',
            'aaaaeeiooouc'
        )
        ELSE ''
    END;

    IF TG_OP = 'INSERT'
       OR (
           TG_OP = 'UPDATE'
           AND v_old_status NOT IN ('agendado', 'confirmado')
           AND v_status IN ('agendado', 'confirmado')
       )
    THEN
        PERFORM public.fn_registrar_evento_automacao(
            'novo_agendamento',
            NEW.cliente_id,
            NEW.id,
            'novo_agendamento:' || NEW.id
        );
    END IF;

    IF TG_OP = 'UPDATE'
       AND v_old_status NOT IN ('em_andamento', 'em andamento')
       AND v_status IN ('em_andamento', 'em andamento')
    THEN
        PERFORM public.fn_registrar_evento_automacao(
            'servico_iniciado',
            NEW.cliente_id,
            NEW.id,
            'servico_iniciado:' || NEW.id
        );
    END IF;

    IF TG_OP = 'UPDATE'
       AND v_old_status NOT IN ('finalizado', 'entregue', 'concluido')
       AND v_status IN ('finalizado', 'entregue', 'concluido')
    THEN
        PERFORM public.fn_registrar_evento_automacao(
            'servico_finalizado',
            NEW.cliente_id,
            NEW.id,
            'servico_finalizado:' || NEW.id
        );
        PERFORM public.fn_registrar_evento_automacao(
            'pagamento_recebido',
            NEW.cliente_id,
            NEW.id,
            'pagamento_recebido:' || NEW.id
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_trigger_cancelar_automacoes_agendamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    BEGIN
        IF TG_OP = 'UPDATE'
           AND lower(coalesce(NEW.status, '')) = 'cancelado'
           AND lower(coalesce(OLD.status, '')) <> 'cancelado'
        THEN
            UPDATE public.automacoes_eventos
            SET status = 'ignorado',
                processed_at = now()
            WHERE appointment_id = NEW.id
              AND status = 'pendente';

            UPDATE public.automacoes_execucoes
            SET status = 'cancelada',
                updated_at = now()
            WHERE appointment_id = NEW.id
              AND status = 'pendente';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Falha isolada ao cancelar automações do agendamento %: %',
            NEW.id,
            SQLERRM;
    END;
    RETURN NEW;
END;
$$;

COMMIT;
