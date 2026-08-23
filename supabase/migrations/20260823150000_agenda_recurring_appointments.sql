-- Migration: metadados e criacao transacional de recorrencia administrativa.
-- Aditiva e backward-compatible: agendamentos existentes permanecem avulsos.

BEGIN;

ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS recurrence_id UUID,
  ADD COLUMN IF NOT EXISTS recurrence_sequence INTEGER,
  ADD COLUMN IF NOT EXISTS recurrence_frequency TEXT,
  ADD COLUMN IF NOT EXISTS recurrence_total INTEGER;

ALTER TABLE public.agendamentos
  DROP CONSTRAINT IF EXISTS agendamentos_recurrence_frequency_check,
  ADD CONSTRAINT agendamentos_recurrence_frequency_check
    CHECK (
      recurrence_frequency IS NULL
      OR recurrence_frequency IN ('weekly', 'biweekly', 'monthly')
    );

ALTER TABLE public.agendamentos
  DROP CONSTRAINT IF EXISTS agendamentos_recurrence_sequence_check,
  ADD CONSTRAINT agendamentos_recurrence_sequence_check
    CHECK (
      recurrence_sequence IS NULL
      OR recurrence_sequence > 0
    );

ALTER TABLE public.agendamentos
  DROP CONSTRAINT IF EXISTS agendamentos_recurrence_total_check,
  ADD CONSTRAINT agendamentos_recurrence_total_check
    CHECK (
      recurrence_total IS NULL
      OR recurrence_total > 0
    );

CREATE UNIQUE INDEX IF NOT EXISTS idx_agendamentos_recurrence_sequence
  ON public.agendamentos (recurrence_id, recurrence_sequence)
  WHERE recurrence_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agendamentos_recurrence_id
  ON public.agendamentos (recurrence_id)
  WHERE recurrence_id IS NOT NULL;

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

    IF (
           TG_OP = 'INSERT'
           AND (
             NEW.recurrence_id IS NULL
             OR coalesce(NEW.recurrence_sequence, 1) = 1
           )
       )
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

CREATE OR REPLACE FUNCTION public.fn_criar_agendamentos_recorrentes(
    p_cliente_id UUID,
    p_veiculo_id UUID,
    p_servico_id UUID,
    p_recurrence_id UUID,
    p_recurrence_frequency TEXT,
    p_recurrence_total INTEGER,
    p_occurrences JSONB,
    p_valor_servico NUMERIC,
    p_tempo_real INTEGER,
    p_observacoes TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_profile TEXT;
    v_user_permissions JSONB;
    v_can_create_appointment BOOLEAN;
    v_occurrence_count INTEGER;
    v_occurrence JSONB;
    v_date DATE;
    v_time TIME;
    v_sequence INTEGER;
    v_agenda JSONB;
    v_day JSONB;
    v_day_of_week INTEGER;
    v_open_time TIME;
    v_close_time TIME;
    v_lunch_start TIME;
    v_lunch_end TIME;
    v_has_lunch BOOLEAN;
    v_start_minutes INTEGER;
    v_end_minutes INTEGER;
    v_now TIMESTAMPTZ := now();
    v_min_advance_hours INTEGER;
    v_max_advance_days INTEGER;
    v_capacity INTEGER;
    v_occupancy INTEGER;
    v_slot JSONB;
    v_slot_time TIME;
    v_inserted_ids UUID[] := ARRAY[]::UUID[];
    v_new_id UUID;
    v_active_statuses TEXT[] := ARRAY['agendado', 'confirmado', 'cliente_chegou', 'em_andamento', 'aguardando_aprovacao', 'aguardando_peca'];
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuario autenticado obrigatorio para criar recorrencia';
    END IF;

    SELECT usuario.perfil, coalesce(usuario.permissions, '{}'::jsonb)
    INTO v_user_profile, v_user_permissions
    FROM public.usuarios AS usuario
    WHERE usuario.auth_user_id = auth.uid()
      AND usuario.status = 'ativo';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Usuario sem permissao para criar recorrencia';
    END IF;

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

    IF NOT v_can_create_appointment THEN
        RAISE EXCEPTION 'Usuario sem permissao para criar agendamentos recorrentes';
    END IF;

    IF p_cliente_id IS NULL OR p_veiculo_id IS NULL OR p_servico_id IS NULL THEN
        RAISE EXCEPTION 'Cliente, veiculo e servico sao obrigatorios';
    END IF;
    IF p_recurrence_id IS NULL THEN
        RAISE EXCEPTION 'recurrence_id obrigatorio';
    END IF;
    IF p_recurrence_frequency NOT IN ('weekly', 'biweekly', 'monthly') THEN
        RAISE EXCEPTION 'Frequencia de recorrencia invalida';
    END IF;
    IF p_recurrence_total IS NULL OR p_recurrence_total < 2 OR p_recurrence_total > 52 THEN
        RAISE EXCEPTION 'Total de recorrencia invalido';
    END IF;
    IF p_tempo_real IS NULL OR p_tempo_real <= 0 THEN
        RAISE EXCEPTION 'Duracao do servico invalida';
    END IF;
    IF p_occurrences IS NULL OR jsonb_typeof(p_occurrences) <> 'array' THEN
        RAISE EXCEPTION 'Ocorrencias da recorrencia invalidas';
    END IF;

    SELECT count(*)
    INTO v_occurrence_count
    FROM jsonb_array_elements(p_occurrences);

    IF v_occurrence_count <> p_recurrence_total THEN
        RAISE EXCEPTION 'Total de ocorrencias difere da serie informada';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.agendamentos AS appointment
        WHERE appointment.recurrence_id = p_recurrence_id
    ) THEN
        RETURN (
            SELECT jsonb_build_object(
                'recurrence_id', p_recurrence_id,
                'count', count(*),
                'appointment_ids', coalesce(jsonb_agg(appointment.id ORDER BY appointment.recurrence_sequence), '[]'::jsonb),
                'idempotent', true
            )
            FROM public.agendamentos AS appointment
            WHERE appointment.recurrence_id = p_recurrence_id
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.clientes AS cliente
        WHERE cliente.id = p_cliente_id
    ) THEN
        RAISE EXCEPTION 'Cliente nao encontrado';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.veiculos AS vehicle
        WHERE vehicle.id = p_veiculo_id
          AND vehicle.cliente_id = p_cliente_id
    ) THEN
        RAISE EXCEPTION 'Veiculo nao pertence ao cliente informado';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.servicos_disponiveis AS service
        WHERE service.id = p_servico_id
    ) THEN
        RAISE EXCEPTION 'Servico nao encontrado';
    END IF;

    SELECT config.agenda
    INTO v_agenda
    FROM public.configuracoes_empresa AS config
    ORDER BY config.updated_at DESC NULLS LAST
    LIMIT 1;

    IF v_agenda IS NULL OR jsonb_typeof(v_agenda) <> 'object' THEN
        RAISE EXCEPTION 'Configuracao de agenda nao encontrada';
    END IF;

    v_min_advance_hours := coalesce((v_agenda->>'minAdvanceHours')::integer, 0);
    v_max_advance_days := coalesce((v_agenda->>'maxAdvanceDays')::integer, 365);

    FOR v_date IN
        SELECT DISTINCT (occurrence->>'date')::date
        FROM jsonb_array_elements(p_occurrences) AS occurrence
        ORDER BY 1
    LOOP
        PERFORM pg_advisory_xact_lock(hashtext('agenda:' || v_date::text));
    END LOOP;

    FOR v_occurrence IN
        SELECT occurrence
        FROM jsonb_array_elements(p_occurrences) AS occurrence
        ORDER BY (occurrence->>'date')::date, (occurrence->>'time')::time, (occurrence->>'sequence')::integer
    LOOP
        v_date := (v_occurrence->>'date')::date;
        v_time := (v_occurrence->>'time')::time;
        v_sequence := (v_occurrence->>'sequence')::integer;

        IF v_sequence IS NULL OR v_sequence < 1 OR v_sequence > p_recurrence_total THEN
            RAISE EXCEPTION 'Sequencia invalida na recorrencia: %', coalesce(v_occurrence->>'sequence', 'nula');
        END IF;
        IF (v_date + v_time) < (v_now + make_interval(hours => v_min_advance_hours)) THEN
            RAISE EXCEPTION 'Ocorrencia % % nao respeita antecedencia minima', v_date, v_time;
        END IF;
        IF (v_date + v_time) > (v_now + make_interval(days => v_max_advance_days)) THEN
            RAISE EXCEPTION 'Ocorrencia % % excede antecedencia maxima', v_date, v_time;
        END IF;

        v_day_of_week := extract(dow from v_date)::integer;
        SELECT day_config
        INTO v_day
        FROM jsonb_array_elements(v_agenda->'days') AS day_config
        WHERE (day_config->>'dayOfWeek')::integer = v_day_of_week
        LIMIT 1;

        IF v_day IS NULL OR coalesce((v_day->>'isActive')::boolean, false) = false THEN
            RAISE EXCEPTION 'Estabelecimento fechado em %', v_date;
        END IF;

        v_open_time := (v_day->>'openTime')::time;
        v_close_time := (v_day->>'closeTime')::time;
        v_has_lunch := coalesce((v_day->>'hasLunchBreak')::boolean, false);
        v_lunch_start := coalesce((v_day->>'lunchStart')::time, '12:00'::time);
        v_lunch_end := coalesce((v_day->>'lunchEnd')::time, '13:00'::time);
        v_start_minutes := extract(hour from v_time)::integer * 60 + extract(minute from v_time)::integer;
        v_end_minutes := v_start_minutes + p_tempo_real;

        IF v_time < v_open_time
           OR (v_time + make_interval(mins => p_tempo_real)) > v_close_time
        THEN
            RAISE EXCEPTION 'Ocorrencia % % fora do expediente', v_date, v_time;
        END IF;

        IF v_has_lunch
           AND v_time < v_lunch_end
           AND (v_time + make_interval(mins => p_tempo_real)) > v_lunch_start
        THEN
            RAISE EXCEPTION 'Ocorrencia % % conflita com intervalo de almoco', v_date, v_time;
        END IF;

        FOR v_slot IN
            SELECT slot
            FROM jsonb_array_elements(v_agenda->'timeSlots') AS slot
            WHERE (slot->>'time')::time >= v_open_time
              AND (slot->>'time')::time < v_close_time
              AND (
                extract(hour from (slot->>'time')::time)::integer * 60
                + extract(minute from (slot->>'time')::time)::integer
              ) >= v_start_minutes
              AND (
                extract(hour from (slot->>'time')::time)::integer * 60
                + extract(minute from (slot->>'time')::time)::integer
              ) < v_end_minutes
            ORDER BY (slot->>'time')::time
        LOOP
            v_slot_time := (v_slot->>'time')::time;
            v_capacity := greatest(coalesce((v_slot->>'maxCapacity')::integer, 1), 1);

            SELECT count(*)
            INTO v_occupancy
            FROM public.agendamentos AS appointment
            WHERE appointment.data_agendamento = v_date
              AND regexp_replace(
                    translate(lower(trim(coalesce(appointment.status, ''))), 'áàâãéêíóôõúç', 'aaaaeeiooouc'),
                    '[[:space:]-]+',
                    '_',
                    'g'
                  ) = ANY(v_active_statuses)
              AND appointment.hora_agendamento <= v_slot_time
              AND (appointment.hora_agendamento + make_interval(mins => greatest(coalesce(appointment.tempo_real, 60), 1))) > v_slot_time;

            SELECT v_occupancy + count(*)
            INTO v_occupancy
            FROM jsonb_array_elements(p_occurrences) AS pending
            WHERE (pending->>'date')::date = v_date
              AND (pending->>'sequence')::integer <> v_sequence
              AND (pending->>'time')::time <= v_slot_time
              AND ((pending->>'time')::time + make_interval(mins => p_tempo_real)) > v_slot_time;

            IF v_occupancy >= v_capacity THEN
                RAISE EXCEPTION 'Capacidade esgotada em % %', v_date, v_slot_time;
            END IF;
        END LOOP;
    END LOOP;

    FOR v_occurrence IN
        SELECT occurrence
        FROM jsonb_array_elements(p_occurrences) AS occurrence
        ORDER BY (occurrence->>'sequence')::integer
    LOOP
        v_new_id := gen_random_uuid();
        v_date := (v_occurrence->>'date')::date;
        v_time := (v_occurrence->>'time')::time;
        v_sequence := (v_occurrence->>'sequence')::integer;

        INSERT INTO public.agendamentos (
            id,
            cliente_id,
            veiculo_id,
            servico_id,
            data_agendamento,
            hora_agendamento,
            tempo_real,
            valor_servico,
            status,
            observacoes,
            recurrence_id,
            recurrence_sequence,
            recurrence_frequency,
            recurrence_total
        ) VALUES (
            v_new_id,
            p_cliente_id,
            p_veiculo_id,
            p_servico_id,
            v_date,
            v_time,
            p_tempo_real,
            p_valor_servico,
            'Agendado',
            coalesce(p_observacoes, ''),
            p_recurrence_id,
            v_sequence,
            p_recurrence_frequency,
            p_recurrence_total
        );

        v_inserted_ids := array_append(v_inserted_ids, v_new_id);
    END LOOP;

    RETURN jsonb_build_object(
        'recurrence_id', p_recurrence_id,
        'count', array_length(v_inserted_ids, 1),
        'appointment_ids', to_jsonb(v_inserted_ids),
        'idempotent', false
    );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_criar_agendamentos_recorrentes(
    UUID, UUID, UUID, UUID, TEXT, INTEGER, JSONB, NUMERIC, INTEGER, TEXT
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_criar_agendamentos_recorrentes(
    UUID, UUID, UUID, UUID, TEXT, INTEGER, JSONB, NUMERIC, INTEGER, TEXT
) TO authenticated, service_role;

COMMIT;
