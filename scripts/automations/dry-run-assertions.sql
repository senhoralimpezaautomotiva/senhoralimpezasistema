\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION pg_temp.assert_true(condition BOOLEAN, message TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    IF condition IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'ASSERTION FAILED: %', message;
    END IF;
END;
$$;

SELECT pg_temp.assert_true(
    (
        SELECT status = 'cancelada'
           AND resposta_api LIKE '%quarentena%'
        FROM public.automacoes_execucoes
        WHERE id = '30000000-0000-0000-0000-000000000001'
    ),
    'execução vazia legada deve ficar em quarentena'
);

SELECT pg_temp.assert_true(
    NOT EXISTS (
        SELECT 1
        FROM public.automacoes_eventos
        WHERE deduplication_key = 'servico_finalizado:20000000-0000-0000-0000-000000000001'
    ),
    'quarentena não pode disparar backfill automático'
);

SELECT pg_temp.assert_true(
    (
        SELECT status = 'cancelada'
        FROM public.automacoes_execucoes
        WHERE id = '30000000-0000-0000-0000-000000000004'
    ),
    'duplicata pendente deve ser consolidada'
);

SELECT pg_temp.assert_true(
    (
        SELECT deduplication_key =
            'novo_agendamento:20000000-0000-0000-0000-000000000002'
        FROM public.automacoes_execucoes
        WHERE id = '30000000-0000-0000-0000-000000000003'
    ),
    'execução já enviada deve manter a chave canônica'
);

DO $$
BEGIN
    BEGIN
        UPDATE public.configuracoes_empresa
        SET automations = '{invalid json}'::jsonb
        WHERE id = 'c0000000-0000-0000-0000-000000000000';
        RAISE EXCEPTION 'JSON inválido foi aceito';
    EXCEPTION
        WHEN invalid_text_representation THEN NULL;
    END;
END;
$$;

UPDATE public.configuracoes_empresa
SET automations = NULL
WHERE id = 'c0000000-0000-0000-0000-000000000000';

INSERT INTO public.clientes (id, nome, telefone)
VALUES ('10000000-0000-0000-0000-000000000010', 'Config Null', '5511999990010');

SELECT pg_temp.assert_true(
    EXISTS (
        SELECT 1 FROM public.automacoes_eventos
        WHERE deduplication_key = 'novo_cliente:10000000-0000-0000-0000-000000000010'
    ),
    'configuração null deve usar compatibilidade de defaults'
);

UPDATE public.configuracoes_empresa
SET automations = '{}'::jsonb
WHERE id = 'c0000000-0000-0000-0000-000000000000';

INSERT INTO public.clientes (id, nome, telefone)
VALUES ('10000000-0000-0000-0000-000000000011', 'Config Objeto', '5511999990011');

SELECT pg_temp.assert_true(
    EXISTS (
        SELECT 1 FROM public.automacoes_eventos
        WHERE deduplication_key = 'novo_cliente:10000000-0000-0000-0000-000000000011'
    ),
    'configuração legada não-array deve usar defaults sem overwrite'
);

UPDATE public.configuracoes_empresa
SET automations = jsonb_build_array(
    jsonb_build_object(
        'id', 'at1',
        'event', 'novo_cliente',
        'isActive', false,
        'template', 'Template'
    )
)
WHERE id = 'c0000000-0000-0000-0000-000000000000';

INSERT INTO public.clientes (id, nome, telefone)
VALUES ('10000000-0000-0000-0000-000000000012', 'Inativo', '5511999990012');

SELECT pg_temp.assert_true(
    NOT EXISTS (
        SELECT 1 FROM public.automacoes_eventos
        WHERE deduplication_key = 'novo_cliente:10000000-0000-0000-0000-000000000012'
    ),
    'automação inativa não pode criar evento'
);

UPDATE public.configuracoes_empresa
SET automations = '[]'::jsonb
WHERE id = 'c0000000-0000-0000-0000-000000000000';

INSERT INTO public.clientes (id, nome, telefone)
VALUES ('10000000-0000-0000-0000-000000000020', 'Estados', '5511999990020');

INSERT INTO public.agendamentos (id, cliente_id, status)
VALUES (
    '20000000-0000-0000-0000-000000000020',
    '10000000-0000-0000-0000-000000000020',
    'Agendado'
);

UPDATE public.agendamentos SET status = 'Cliente chegou'
WHERE id = '20000000-0000-0000-0000-000000000020';
UPDATE public.agendamentos SET status = 'Aguardando aprovação'
WHERE id = '20000000-0000-0000-0000-000000000020';
UPDATE public.agendamentos SET status = 'Aguardando peça'
WHERE id = '20000000-0000-0000-0000-000000000020';

SELECT pg_temp.assert_true(
    NOT EXISTS (
        SELECT 1 FROM public.automacoes_eventos
        WHERE appointment_id = '20000000-0000-0000-0000-000000000020'
          AND automacao = 'servico_iniciado'
    ),
    'cliente chegou/aguardando não podem iniciar serviço'
);

UPDATE public.agendamentos SET status = 'Em andamento'
WHERE id = '20000000-0000-0000-0000-000000000020';
UPDATE public.agendamentos SET status = 'Finalizado'
WHERE id = '20000000-0000-0000-0000-000000000020';
UPDATE public.agendamentos SET status = 'Entregue'
WHERE id = '20000000-0000-0000-0000-000000000020';

SELECT pg_temp.assert_true(
    (
        SELECT count(*) = 1 FROM public.automacoes_eventos
        WHERE appointment_id = '20000000-0000-0000-0000-000000000020'
          AND automacao = 'servico_iniciado'
    ),
    'em andamento deve produzir exatamente um serviço iniciado'
);
SELECT pg_temp.assert_true(
    (
        SELECT count(*) = 1 FROM public.automacoes_eventos
        WHERE appointment_id = '20000000-0000-0000-0000-000000000020'
          AND automacao = 'servico_finalizado'
    ),
    'finalização deve produzir exatamente um serviço finalizado'
);
SELECT pg_temp.assert_true(
    NOT EXISTS (
        SELECT 1 FROM public.automacoes_eventos
        WHERE appointment_id = '20000000-0000-0000-0000-000000000020'
          AND automacao = 'pagamento_recebido'
    ),
    'finalização/entrega não podem fabricar pagamento ou avaliação'
);

INSERT INTO public.automacoes_eventos (
    automacao,
    appointment_id,
    customer_id,
    deduplication_key,
    status,
    tentativas,
    proxima_tentativa
)
VALUES (
    'novo_agendamento',
    '20000000-0000-0000-0000-000000000020',
    '10000000-0000-0000-0000-000000000020',
    'retry:test',
    'pendente_retry',
    2,
    now() + interval '5 minutes'
);

SELECT pg_temp.assert_true(
    EXISTS (
        SELECT 1 FROM public.automacoes_eventos
        WHERE deduplication_key = 'retry:test'
          AND status = 'pendente_retry'
          AND tentativas = 2
    ),
    'outbox deve aceitar retry explícito'
);

DO $$
DECLARE
    version_before TIMESTAMPTZ;
    version_after TIMESTAMPTZ;
    defaults JSONB := jsonb_build_array(
        jsonb_build_object(
            'id', 'at1',
            'event', 'novo_cliente',
            'isActive', true,
            'template', 'A'
        ),
        jsonb_build_object(
            'id', 'at2',
            'event', 'novo_agendamento',
            'isActive', true,
            'template', 'B'
        )
    );
BEGIN
    UPDATE public.configuracoes_empresa
    SET automations = '[]'::jsonb
    WHERE id = 'c0000000-0000-0000-0000-000000000000'
    RETURNING updated_at INTO version_before;

    PERFORM public.fn_update_automacao_config(
        'c0000000-0000-0000-0000-000000000000',
        'at1',
        '{"isActive":false}'::jsonb,
        version_before,
        defaults
    );

    BEGIN
        PERFORM public.fn_update_automacao_config(
            'c0000000-0000-0000-0000-000000000000',
            'at2',
            '{"template":"B customizado"}'::jsonb,
            version_before,
            defaults
        );
        RAISE EXCEPTION 'edição concorrente obsoleta foi aceita';
    EXCEPTION
        WHEN serialization_failure THEN NULL;
    END;

    SELECT updated_at INTO version_after
    FROM public.configuracoes_empresa
    WHERE id = 'c0000000-0000-0000-0000-000000000000';

    PERFORM public.fn_update_automacao_config(
        'c0000000-0000-0000-0000-000000000000',
        'at2',
        '{"template":"B customizado"}'::jsonb,
        version_after,
        defaults
    );
END;
$$;

SELECT pg_temp.assert_true(
    (
        SELECT bool_and(
            CASE item->>'id'
                WHEN 'at1' THEN item->'isActive' = 'false'::jsonb
                WHEN 'at2' THEN item->>'template' = 'B customizado'
                ELSE true
            END
        )
        FROM public.configuracoes_empresa AS config,
             jsonb_array_elements(config.automations) AS item
        WHERE config.id = 'c0000000-0000-0000-0000-000000000000'
    ),
    'retry concorrente deve preservar as duas edições'
);

SELECT pg_temp.assert_true(
    has_function_privilege(
        'service_role',
        'public.fn_claim_automacoes_execucoes(integer,integer,uuid)',
        'EXECUTE'
    ),
    'service_role deve poder executar claim'
);
SELECT pg_temp.assert_true(
    NOT has_function_privilege(
        'anon',
        'public.fn_claim_automacoes_execucoes(integer,integer,uuid)',
        'EXECUTE'
    ),
    'anon não pode executar claim'
);
SELECT pg_temp.assert_true(
    NOT has_function_privilege(
        'authenticated',
        'public.fn_update_automacao_config(uuid,text,jsonb,timestamptz,jsonb)',
        'EXECUTE'
    ),
    'authenticated não pode executar CAS administrativo'
);
SELECT pg_temp.assert_true(
    NOT has_function_privilege(
        'authenticated',
        'public.fn_finalizar_automacao_execucao(uuid,uuid,text,integer,text,timestamptz,timestamptz,timestamptz)',
        'EXECUTE'
    ),
    'authenticated não pode finalizar execução'
);

ALTER TABLE public.automacoes_eventos RENAME TO automacoes_eventos_indisponivel;
INSERT INTO public.clientes (id, nome, telefone)
VALUES ('10000000-0000-0000-0000-000000000099', 'Falha isolada', '5511999990099');
ALTER TABLE public.automacoes_eventos_indisponivel RENAME TO automacoes_eventos;

SELECT pg_temp.assert_true(
    EXISTS (
        SELECT 1 FROM public.clientes
        WHERE id = '10000000-0000-0000-0000-000000000099'
    ),
    'falha do trigger de automação não pode reverter operação principal'
);

\echo 'ASSERTIONS_SQL_OK'
