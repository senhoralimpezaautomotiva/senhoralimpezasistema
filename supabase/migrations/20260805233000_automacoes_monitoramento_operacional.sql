-- Noite 9: quarentena de claims abandonados e claim exclusivo de pendências.
-- Um claim vencido é ambíguo: o provedor pode ter aceitado a mensagem antes de
-- o worker falhar ao persistir o resultado. Por isso ele nunca volta
-- automaticamente à fila.

BEGIN;

UPDATE public.automacoes_execucoes AS execution
SET status = 'erro_definitivo',
    resposta_api = concat(
        '[CLAIM ABANDONADO] Reconciliação necessária: o envio pode ter sido aceito; reenvio automático bloqueado.',
        CASE
            WHEN nullif(btrim(execution.resposta_api), '') IS NULL THEN ''
            ELSE concat(' Estado anterior preservado: ', left(execution.resposta_api, 1000))
        END
    ),
    claim_token = NULL,
    data_proxima_tentativa = NULL,
    updated_at = now()
WHERE execution.status = 'processando'
  AND (
      (
          execution.claim_expires_at IS NULL
          AND execution.updated_at <= now() - interval '15 minutes'
      )
      OR execution.claim_expires_at <= now()
  );

CREATE OR REPLACE FUNCTION public.fn_claim_automacoes_execucoes(
    p_limit INTEGER DEFAULT 100,
    p_lease_seconds INTEGER DEFAULT 300,
    p_execution_id UUID DEFAULT NULL
)
RETURNS SETOF public.automacoes_execucoes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Quarentena atômica antes de qualquer novo claim. A execução fica visível
    -- para reconciliação e não pode ser reenviada silenciosamente.
    UPDATE public.automacoes_execucoes AS execution
    SET status = 'erro_definitivo',
        resposta_api = concat(
            '[CLAIM ABANDONADO] Reconciliação necessária: o envio pode ter sido aceito; reenvio automático bloqueado.',
            CASE
                WHEN nullif(btrim(execution.resposta_api), '') IS NULL THEN ''
                ELSE concat(' Estado anterior preservado: ', left(execution.resposta_api, 1000))
            END
        ),
        claim_token = NULL,
        data_proxima_tentativa = NULL,
        updated_at = now()
    WHERE execution.status = 'processando'
      AND (
          (
              execution.claim_expires_at IS NULL
              AND execution.updated_at <= now() - interval '15 minutes'
          )
          OR execution.claim_expires_at <= now()
      );

    RETURN QUERY
    WITH candidates AS (
        SELECT execution.id
        FROM public.automacoes_execucoes AS execution
        WHERE (
            p_execution_id IS NULL
            OR execution.id = p_execution_id
        )
          AND execution.status = 'pendente'
          AND execution.data_execucao <= now()
        ORDER BY execution.data_execucao, execution.created_at, execution.id
        LIMIT least(greatest(coalesce(p_limit, 100), 1), 100)
        FOR UPDATE SKIP LOCKED
    ),
    claimed AS (
        UPDATE public.automacoes_execucoes AS execution
        SET status = 'processando',
            claim_token = gen_random_uuid(),
            claimed_at = now(),
            claim_expires_at = now() + make_interval(
                secs => least(greatest(coalesce(p_lease_seconds, 300), 60), 900)
            ),
            updated_at = now()
        FROM candidates
        WHERE execution.id = candidates.id
        RETURNING execution.*
    )
    SELECT claimed.*
    FROM claimed;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_claim_automacoes_execucoes(INTEGER, INTEGER, UUID)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_claim_automacoes_execucoes(INTEGER, INTEGER, UUID)
TO service_role;

COMMIT;
