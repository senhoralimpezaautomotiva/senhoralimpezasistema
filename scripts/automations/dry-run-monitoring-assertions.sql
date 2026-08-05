\set ON_ERROR_STOP on

-- O alvo terminou processando com lease renovado no teste da versão anterior.
-- Ao vencer na política da Noite 9, deve ser colocado em quarentena e a RPC
-- não pode devolvê-lo como um novo claim.
UPDATE public.automacoes_execucoes
SET claim_expires_at = now() - interval '1 second'
WHERE id = '30000000-0000-0000-0000-000000000099';

CREATE TEMP TABLE monitoring_claim_result AS
SELECT *
FROM public.fn_claim_automacoes_execucoes(
    1,
    300,
    '30000000-0000-0000-0000-000000000099'
);

DO $$
DECLARE
    claimed_count INTEGER;
    quarantined_count INTEGER;
BEGIN
    SELECT count(*) INTO claimed_count FROM monitoring_claim_result;
    IF claimed_count <> 0 THEN
        RAISE EXCEPTION 'claim expirado foi reclamado automaticamente';
    END IF;

    SELECT count(*) INTO quarantined_count
    FROM public.automacoes_execucoes
    WHERE id = '30000000-0000-0000-0000-000000000099'
      AND status = 'erro_definitivo'
      AND claim_token IS NULL
      AND claim_expires_at <= now()
      AND resposta_api LIKE '[CLAIM ABANDONADO]%';
    IF quarantined_count <> 1 THEN
        RAISE EXCEPTION 'claim expirado não entrou em quarentena';
    END IF;
END;
$$;

-- Pendência real continua elegível e recebe claim normalmente.
INSERT INTO public.automacoes_execucoes (
    id,
    automacao,
    appointment_id,
    customer_id,
    telefone,
    mensagem,
    status,
    tentativas,
    data_execucao,
    deduplication_key
)
VALUES (
    '30000000-0000-0000-0000-000000000098',
    'servico_finalizado',
    '20000000-0000-0000-0000-000000000020',
    '10000000-0000-0000-0000-000000000020',
    '5511999990020',
    'Mensagem pendente monitorada',
    'pendente',
    0,
    now() - interval '1 minute',
    'claim:night-nine-pending'
)
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
    claimed_count INTEGER;
BEGIN
    SELECT count(*) INTO claimed_count
    FROM public.fn_claim_automacoes_execucoes(
        1,
        300,
        '30000000-0000-0000-0000-000000000098'
    );
    IF claimed_count <> 1 THEN
        RAISE EXCEPTION 'execução pendente não recebeu claim';
    END IF;
END;
$$;

\echo 'ASSERTIONS_MONITORING_OK'
