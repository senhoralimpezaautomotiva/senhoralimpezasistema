\set ON_ERROR_STOP on

CREATE TEMP TABLE claim_audit AS
SELECT claim_token AS original_token
FROM public.automacoes_execucoes
WHERE id = '30000000-0000-0000-0000-000000000099';

DO $$
DECLARE
    finalized BOOLEAN;
BEGIN
    SELECT public.fn_finalizar_automacao_execucao(
        '30000000-0000-0000-0000-000000000099',
        gen_random_uuid(),
        'sucesso',
        1,
        'token incorreto',
        now(),
        NULL,
        now()
    )
    INTO finalized;
    IF finalized THEN
        RAISE EXCEPTION 'token incorreto finalizou a execução';
    END IF;
END;
$$;

UPDATE public.automacoes_execucoes
SET claim_expires_at = now() - interval '1 second'
WHERE id = '30000000-0000-0000-0000-000000000099';

SELECT *
FROM public.fn_claim_automacoes_execucoes(
    1,
    300,
    '30000000-0000-0000-0000-000000000099'
);

DO $$
DECLARE
    old_token UUID;
    new_token UUID;
BEGIN
    SELECT original_token INTO old_token FROM claim_audit;
    SELECT claim_token INTO new_token
    FROM public.automacoes_execucoes
    WHERE id = '30000000-0000-0000-0000-000000000099';

    IF old_token IS NULL OR new_token IS NULL OR old_token = new_token THEN
        RAISE EXCEPTION 'lease expirado não foi recuperado com novo token';
    END IF;
END;
$$;

\echo 'ASSERTIONS_CLAIM_OK'
