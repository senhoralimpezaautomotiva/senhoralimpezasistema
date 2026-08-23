-- Corrige a selecao do servico principal na RPC de conversao do Orcamento Vivo.
-- A migration original ja foi aplicada em producao; esta substitui apenas o corpo da RPC.

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_converter_itens_orcamento_em_agendamento(
    p_orcamento_id UUID,
    p_item_ids UUID[],
    p_cliente_id UUID,
    p_veiculo_id UUID,
    p_data_agendamento DATE,
    p_hora_agendamento TIME,
    p_valor_servico NUMERIC,
    p_tempo_real INTEGER,
    p_observacoes TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_agendamento_id UUID := gen_random_uuid();
    v_item_count INTEGER;
    v_first_service_id UUID;
    v_budget_status TEXT;
    v_remaining_pending INTEGER;
    v_completed_count INTEGER;
    v_total_count INTEGER;
    v_user_profile TEXT;
    v_user_permissions JSONB;
    v_can_convert_budget BOOLEAN;
    v_can_create_appointment BOOLEAN;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuario autenticado obrigatorio para converter orcamento';
    END IF;

    SELECT usuario.perfil, coalesce(usuario.permissions, '{}'::jsonb)
    INTO v_user_profile, v_user_permissions
    FROM public.usuarios AS usuario
    WHERE usuario.auth_user_id = auth.uid()
      AND usuario.status = 'ativo';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Usuario sem permissao para converter orcamento';
    END IF;

    v_can_convert_budget := coalesce(
        (v_user_permissions->'orcamentos'->>'create')::boolean,
        CASE v_user_profile
            WHEN 'admin' THEN true
            WHEN 'gerente' THEN true
            WHEN 'atendente' THEN true
            ELSE false
        END
    ) OR coalesce(
        (v_user_permissions->'orcamentos'->>'edit')::boolean,
        CASE v_user_profile
            WHEN 'admin' THEN true
            WHEN 'gerente' THEN true
            WHEN 'atendente' THEN true
            ELSE false
        END
    );

    v_can_create_appointment := coalesce(
        (v_user_permissions->'agenda'->>'create')::boolean,
        CASE v_user_profile
            WHEN 'admin' THEN true
            WHEN 'gerente' THEN true
            WHEN 'atendente' THEN true
            WHEN 'personalizado' THEN true
            ELSE false
        END
    );

    IF NOT (v_can_convert_budget AND v_can_create_appointment) THEN
        RAISE EXCEPTION 'Usuario sem permissao para converter orcamento';
    END IF;

    IF p_orcamento_id IS NULL OR p_cliente_id IS NULL OR p_veiculo_id IS NULL THEN
        RAISE EXCEPTION 'Dados obrigatorios ausentes para conversao do orcamento';
    END IF;
    IF p_item_ids IS NULL OR array_length(p_item_ids, 1) IS NULL THEN
        RAISE EXCEPTION 'Selecione ao menos um item do orcamento';
    END IF;

    SELECT status
    INTO v_budget_status
    FROM public.orcamentos
    WHERE id = p_orcamento_id
      AND cliente_id = p_cliente_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Orcamento nao encontrado para o cliente informado';
    END IF;
    IF v_budget_status IN ('rascunho', 'recusado', 'cancelado', 'vencido') THEN
        RAISE EXCEPTION 'Orcamento nao disponivel para conversao';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.veiculos
        WHERE id = p_veiculo_id AND cliente_id = p_cliente_id
    ) THEN
        RAISE EXCEPTION 'Veiculo nao pertence ao cliente do orcamento';
    END IF;

    WITH selected_items AS (
        SELECT item.*
        FROM public.orcamento_itens AS item
        WHERE item.id = ANY(p_item_ids)
        FOR UPDATE
    )
    SELECT count(*),
           (array_agg(servico_id ORDER BY array_position(p_item_ids, id)))[1]
    INTO v_item_count, v_first_service_id
    FROM selected_items;

    IF v_item_count <> array_length(p_item_ids, 1) THEN
        RAISE EXCEPTION 'Um ou mais itens selecionados nao existem';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM public.orcamento_itens AS item
        WHERE item.id = ANY(p_item_ids)
          AND item.orcamento_id <> p_orcamento_id
    ) THEN
        RAISE EXCEPTION 'Item nao pertence ao orcamento informado';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM public.orcamento_itens AS item
        WHERE item.id = ANY(p_item_ids)
          AND item.status <> 'pendente'
    ) THEN
        RAISE EXCEPTION 'Um ou mais itens ja foram convertidos ou concluidos';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM public.orcamento_itens AS item
        WHERE item.id = ANY(p_item_ids)
          AND item.servico_id IS NULL
    ) THEN
        RAISE EXCEPTION 'Itens manuais sem servico cadastrado nao podem ser convertidos automaticamente';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM public.orcamento_itens AS item
        LEFT JOIN public.agendamentos AS active_appointment
          ON active_appointment.id = item.agendamento_id
         AND active_appointment.status <> 'Cancelado'
        WHERE item.id = ANY(p_item_ids)
          AND item.agendamento_id IS NOT NULL
          AND active_appointment.id IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'Um ou mais itens ja possuem agendamento ativo';
    END IF;

    INSERT INTO public.agendamentos (
        id, cliente_id, veiculo_id, servico_id, data_agendamento, hora_agendamento,
        tempo_real, valor_servico, status, observacoes, orcamento_id, orcamento_item_ids
    ) VALUES (
        v_agendamento_id, p_cliente_id, p_veiculo_id, v_first_service_id,
        p_data_agendamento, p_hora_agendamento, p_tempo_real, p_valor_servico,
        'Agendado', coalesce(p_observacoes, ''),
        p_orcamento_id, p_item_ids
    );

    UPDATE public.orcamento_itens
    SET status = 'agendado',
        agendamento_id = v_agendamento_id,
        converted_at = now(),
        concluded_at = NULL
    WHERE id = ANY(p_item_ids);

    SELECT
        count(*) FILTER (WHERE status = 'pendente'),
        count(*) FILTER (WHERE status = 'concluido'),
        count(*)
    INTO v_remaining_pending, v_completed_count, v_total_count
    FROM public.orcamento_itens
    WHERE orcamento_id = p_orcamento_id;

    UPDATE public.orcamentos
    SET status = CASE
            WHEN v_total_count > 0 AND v_completed_count = v_total_count THEN 'convertido'
            ELSE 'enviado'
        END,
        updated_at = now()
    WHERE id = p_orcamento_id;

    RETURN v_agendamento_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_converter_itens_orcamento_em_agendamento(
    UUID, UUID[], UUID, UUID, DATE, TIME, NUMERIC, INTEGER, TEXT
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_converter_itens_orcamento_em_agendamento(
    UUID, UUID[], UUID, UUID, DATE, TIME, NUMERIC, INTEGER, TEXT
) TO authenticated, service_role;

COMMIT;
