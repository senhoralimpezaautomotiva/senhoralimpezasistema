-- Migration: riscos residuais do fluxo único via outbox.
-- Adiciona retry explícito ao outbox, separa fatos de negócio e aplica
-- atualização concorrente por automação com compare-and-swap.

BEGIN;

ALTER TABLE public.automacoes_eventos
    ADD COLUMN IF NOT EXISTS tentativas INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS proxima_tentativa TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS ultimo_erro TEXT;

UPDATE public.automacoes_eventos
SET status = 'ignorado_definitivo'
WHERE status = 'ignorado';

ALTER TABLE public.automacoes_eventos
    DROP CONSTRAINT IF EXISTS automacoes_eventos_status_check;

ALTER TABLE public.automacoes_eventos
    ADD CONSTRAINT automacoes_eventos_status_check
    CHECK (
        status IN (
            'pendente',
            'processado',
            'ignorado_definitivo',
            'pendente_retry',
            'erro_definitivo'
        )
    );

-- Não existe ação persistida de pagamento vinculada ao agendamento nesta
-- versão. Eventos/execuções pendentes desse tipo são ambíguos e ficam
-- encerrados, sem apagar o histórico e sem gerar avaliação indevida.
UPDATE public.automacoes_eventos
SET status = 'ignorado_definitivo',
    processed_at = now(),
    ultimo_erro = 'Sem fato autoritativo de pagamento no sistema atual.'
WHERE automacao = 'pagamento_recebido'
  AND status IN ('pendente', 'pendente_retry');

UPDATE public.automacoes_execucoes
SET status = 'cancelada',
    resposta_api = 'Cancelada: pagamento não confirmado por fonte autoritativa.',
    claim_token = NULL,
    claimed_at = NULL,
    claim_expires_at = NULL,
    updated_at = now()
WHERE automacao = 'pagamento_recebido'
  AND status IN ('pendente', 'processando');

DROP INDEX IF EXISTS public.idx_automacoes_eventos_status_created;
CREATE INDEX idx_automacoes_eventos_status_created
    ON public.automacoes_eventos (
        status,
        coalesce(proxima_tentativa, created_at),
        created_at
    );

REVOKE INSERT, UPDATE, DELETE ON TABLE public.automacoes_eventos
FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.automacoes_execucoes
FROM authenticated;
GRANT SELECT ON TABLE public.automacoes_eventos TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.automacoes_eventos TO service_role;
GRANT SELECT ON TABLE public.automacoes_execucoes TO authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON TABLE public.automacoes_execucoes TO service_role;

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

    -- Compatibilidade explícita: null, objeto legado ou [] significam que a
    -- instalação ainda usa os defaults do backend. Nenhum default é persistido
    -- aqui e nenhum template customizado é sobrescrito.
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
    RAISE WARNING 'Falha isolada ao registrar evento de automação %: %',
        p_automacao,
        SQLERRM;
    RETURN;
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
    v_status := regexp_replace(
        translate(
            lower(trim(coalesce(NEW.status, ''))),
            'áàâãéêíóôõúç',
            'aaaaeeiooouc'
        ),
        '[[:space:]-]+',
        '_',
        'g'
    );
    v_old_status := CASE
        WHEN TG_OP = 'UPDATE' THEN regexp_replace(
            translate(
                lower(trim(coalesce(OLD.status, ''))),
                'áàâãéêíóôõúç',
                'aaaaeeiooouc'
            ),
            '[[:space:]-]+',
            '_',
            'g'
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

    -- Cliente chegou e estados de espera permanecem fatos distintos.
    IF TG_OP = 'UPDATE'
       AND v_old_status <> 'em_andamento'
       AND v_status = 'em_andamento'
    THEN
        PERFORM public.fn_registrar_evento_automacao(
            'servico_iniciado',
            NEW.cliente_id,
            NEW.id,
            'servico_iniciado:' || NEW.id
        );
    END IF;

    -- "Concluído" é aceito apenas como compatibilidade de finalização legada.
    -- Entrega e pagamento não são inferidos a partir deste fato.
    IF TG_OP = 'UPDATE'
       AND v_old_status NOT IN ('finalizado', 'concluido')
       AND v_status IN ('finalizado', 'concluido')
    THEN
        PERFORM public.fn_registrar_evento_automacao(
            'servico_finalizado',
            NEW.cliente_id,
            NEW.id,
            'servico_finalizado:' || NEW.id
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
            SET status = 'ignorado_definitivo',
                processed_at = now(),
                ultimo_erro = 'Agendamento cancelado.'
            WHERE appointment_id = NEW.id
              AND status IN ('pendente', 'pendente_retry');

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

CREATE OR REPLACE FUNCTION public.fn_update_automacao_config(
    p_company_id UUID,
    p_automation_id TEXT,
    p_patch JSONB,
    p_expected_updated_at TIMESTAMPTZ,
    p_defaults JSONB
)
RETURNS TABLE (automations JSONB, updated_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_current JSONB;
    v_current_updated_at TIMESTAMPTZ;
    v_index INTEGER;
    v_next JSONB;
    v_confirmed_updated_at TIMESTAMPTZ;
BEGIN
    IF jsonb_typeof(p_patch) <> 'object'
       OR p_patch = '{}'::jsonb
       OR p_patch - ARRAY['isActive', 'template', 'inactiveDays', 'minServices'] <> '{}'::jsonb
    THEN
        RAISE EXCEPTION 'AUTOMATION_CONFIG_INVALID_PATCH';
    END IF;

    IF p_patch ? 'isActive'
       AND jsonb_typeof(p_patch->'isActive') <> 'boolean'
    THEN
        RAISE EXCEPTION 'AUTOMATION_CONFIG_INVALID_IS_ACTIVE';
    END IF;

    IF p_patch ? 'template'
       AND (
           jsonb_typeof(p_patch->'template') <> 'string'
           OR length(trim(p_patch->>'template')) NOT BETWEEN 1 AND 2000
       )
    THEN
        RAISE EXCEPTION 'AUTOMATION_CONFIG_INVALID_TEMPLATE';
    END IF;

    IF p_patch ? 'inactiveDays'
       AND (
           jsonb_typeof(p_patch->'inactiveDays') <> 'number'
           OR (p_patch->>'inactiveDays')::numeric <> trunc((p_patch->>'inactiveDays')::numeric)
           OR (p_patch->>'inactiveDays')::integer < 1
       )
    THEN
        RAISE EXCEPTION 'AUTOMATION_CONFIG_INVALID_INACTIVE_DAYS';
    END IF;

    IF p_patch ? 'minServices'
       AND (
           jsonb_typeof(p_patch->'minServices') <> 'number'
           OR (p_patch->>'minServices')::numeric <> trunc((p_patch->>'minServices')::numeric)
           OR (p_patch->>'minServices')::integer < 0
       )
    THEN
        RAISE EXCEPTION 'AUTOMATION_CONFIG_INVALID_MIN_SERVICES';
    END IF;

    SELECT config.automations, config.updated_at
    INTO v_current, v_current_updated_at
    FROM public.configuracoes_empresa AS config
    WHERE config.id = p_company_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'AUTOMATION_CONFIG_NOT_FOUND';
    END IF;

    IF p_expected_updated_at IS NULL
       OR v_current_updated_at IS DISTINCT FROM p_expected_updated_at
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '40001',
            MESSAGE = 'AUTOMATION_CONFIG_CONFLICT';
    END IF;

    IF jsonb_typeof(v_current) <> 'array'
       OR jsonb_array_length(v_current) = 0
    THEN
        IF jsonb_typeof(p_defaults) <> 'array'
           OR jsonb_array_length(p_defaults) = 0
        THEN
            RAISE EXCEPTION 'AUTOMATION_CONFIG_DEFAULTS_REQUIRED';
        END IF;
        v_current := p_defaults;
    END IF;

    SELECT (entry.ordinality - 1)::integer
    INTO v_index
    FROM jsonb_array_elements(v_current) WITH ORDINALITY AS entry(item, ordinality)
    WHERE entry.item->>'id' = p_automation_id
    LIMIT 1;

    IF v_index IS NULL THEN
        RAISE EXCEPTION 'AUTOMATION_CONFIG_AUTOMATION_NOT_FOUND';
    END IF;

    v_next := jsonb_set(
        v_current,
        ARRAY[v_index::text],
        (v_current->v_index) || p_patch,
        false
    );

    UPDATE public.configuracoes_empresa AS config
    SET automations = v_next,
        updated_at = clock_timestamp()
    WHERE config.id = p_company_id
    RETURNING config.updated_at
    INTO v_confirmed_updated_at;

    RETURN QUERY
    SELECT v_next, v_confirmed_updated_at;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_update_automacao_config(
    UUID,
    TEXT,
    JSONB,
    TIMESTAMPTZ,
    JSONB
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.fn_update_automacao_config(
    UUID,
    TEXT,
    JSONB,
    TIMESTAMPTZ,
    JSONB
) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_finalizar_automacao_execucao(
    p_execution_id UUID,
    p_claim_token UUID,
    p_status TEXT,
    p_tentativas INTEGER,
    p_resposta_api TEXT,
    p_data_execucao TIMESTAMPTZ,
    p_data_proxima_tentativa TIMESTAMPTZ,
    p_updated_at TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_affected INTEGER;
BEGIN
    IF p_claim_token IS NULL
       OR p_status NOT IN ('pendente', 'sucesso', 'erro_definitivo', 'cancelada')
       OR p_tentativas < 0
       OR p_data_execucao IS NULL
       OR p_updated_at IS NULL
    THEN
        RETURN FALSE;
    END IF;

    UPDATE public.automacoes_execucoes AS execution
    SET status = p_status,
        tentativas = p_tentativas,
        resposta_api = p_resposta_api,
        data_execucao = p_data_execucao,
        data_proxima_tentativa = p_data_proxima_tentativa,
        claim_token = NULL,
        claimed_at = NULL,
        claim_expires_at = NULL,
        updated_at = p_updated_at
    WHERE execution.id = p_execution_id
      AND execution.status = 'processando'
      AND execution.claim_token = p_claim_token;

    GET DIAGNOSTICS v_affected = ROW_COUNT;
    RETURN v_affected = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_finalizar_automacao_execucao(
    UUID,
    UUID,
    TEXT,
    INTEGER,
    TEXT,
    TIMESTAMPTZ,
    TIMESTAMPTZ,
    TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.fn_finalizar_automacao_execucao(
    UUID,
    UUID,
    TEXT,
    INTEGER,
    TEXT,
    TIMESTAMPTZ,
    TIMESTAMPTZ,
    TIMESTAMPTZ
) TO service_role;

COMMIT;
