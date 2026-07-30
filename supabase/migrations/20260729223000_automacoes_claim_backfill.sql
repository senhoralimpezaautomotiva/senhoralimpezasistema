-- Migration: claim atômico da fila e reconciliação segura de execuções legadas.
-- Mantém o outbox como produtor único de novas execuções.

BEGIN;

ALTER TABLE public.automacoes_execucoes
    ADD COLUMN IF NOT EXISTS claim_token UUID,
    ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS claim_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_automacoes_execucoes_claim
    ON public.automacoes_execucoes (status, data_execucao, claim_expires_at);

-- Execuções vazias dos produtores antigos são colocadas em quarentena. O
-- backfill é deliberadamente separado e exige janela temporal aprovada para
-- impedir disparos antigos ou avaliações sem fato real de pagamento.
UPDATE public.automacoes_execucoes AS execution
SET status = 'cancelada',
    resposta_api = 'Execução legada vazia em quarentena; requer backfill operacional aprovado.',
    deduplication_key = 'legacy_empty:' || execution.id,
    claim_token = NULL,
    claimed_at = NULL,
    claim_expires_at = NULL,
    updated_at = now()
WHERE execution.status = 'pendente'
  AND length(trim(coalesce(execution.mensagem, ''))) = 0
  AND execution.automacao IN (
      'novo_cliente',
      'novo_agendamento',
      'servico_iniciado',
      'servico_finalizado',
      'pagamento_recebido'
  )
  AND (
      execution.automacao = 'novo_cliente'
      OR execution.appointment_id IS NOT NULL
  );

-- Consolida chaves ausentes de execuções legadas não vazias. Se houver mais
-- de uma execução para o mesmo fato, somente a detentora da chave canônica
-- permanece elegível; pendências excedentes são canceladas.
DO $$
DECLARE
    canonical_key TEXT;
    keeper_id UUID;
BEGIN
    FOR canonical_key IN
        SELECT DISTINCT
            CASE
                WHEN execution.automacao = 'novo_cliente'
                    THEN 'novo_cliente:' || execution.customer_id
                ELSE execution.automacao || ':' || execution.appointment_id
            END
        FROM public.automacoes_execucoes AS execution
        WHERE length(trim(coalesce(execution.mensagem, ''))) > 0
          AND execution.automacao IN (
              'novo_cliente',
              'novo_agendamento',
              'servico_iniciado',
              'servico_finalizado',
              'pagamento_recebido'
          )
          AND (
              execution.automacao = 'novo_cliente'
              OR execution.appointment_id IS NOT NULL
          )
    LOOP
        SELECT execution.id
        INTO keeper_id
        FROM public.automacoes_execucoes AS execution
        WHERE (
            CASE
                WHEN execution.automacao = 'novo_cliente'
                    THEN 'novo_cliente:' || execution.customer_id
                ELSE execution.automacao || ':' || execution.appointment_id
            END
        ) = canonical_key
          AND length(trim(coalesce(execution.mensagem, ''))) > 0
        ORDER BY
            (execution.deduplication_key = canonical_key) DESC,
            CASE execution.status
                WHEN 'sucesso' THEN 0
                WHEN 'processando' THEN 1
                WHEN 'pendente' THEN 2
                WHEN 'erro_definitivo' THEN 3
                ELSE 4
            END,
            execution.created_at,
            execution.id
        LIMIT 1;

        UPDATE public.automacoes_execucoes AS execution
        SET status = 'cancelada',
            resposta_api = 'Execução legada duplicada consolidada durante a migração.',
            deduplication_key = 'legacy_duplicate:' || execution.id,
            claim_token = NULL,
            claimed_at = NULL,
            claim_expires_at = NULL,
            updated_at = now()
        WHERE execution.id <> keeper_id
          AND execution.status IN ('pendente', 'processando')
          AND (
              CASE
                  WHEN execution.automacao = 'novo_cliente'
                      THEN 'novo_cliente:' || execution.customer_id
                  ELSE execution.automacao || ':' || execution.appointment_id
              END
          ) = canonical_key
          AND length(trim(coalesce(execution.mensagem, ''))) > 0;

        UPDATE public.automacoes_execucoes
        SET deduplication_key = canonical_key,
            updated_at = now()
        WHERE id = keeper_id
          AND deduplication_key IS DISTINCT FROM canonical_key;
    END LOOP;
END;
$$;

-- Se o mesmo fato já foi enviado com sucesso, um evento legado reconstituído
-- é encerrado sem produzir uma nova mensagem.
UPDATE public.automacoes_eventos AS event
SET status = 'processado',
    processed_at = now()
WHERE event.status = 'pendente'
  AND EXISTS (
      SELECT 1
      FROM public.automacoes_execucoes AS execution
      WHERE execution.status = 'sucesso'
        AND execution.deduplication_key = event.deduplication_key
  );

-- Recupera somente claims de versões anteriores que ficaram abandonados.
UPDATE public.automacoes_execucoes
SET status = 'pendente',
    data_execucao = least(data_execucao, now()),
    updated_at = now()
WHERE status = 'processando'
  AND claim_token IS NULL
  AND updated_at < now() - interval '10 minutes';

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
    RETURN QUERY
    WITH candidates AS (
        SELECT execution.id
        FROM public.automacoes_execucoes AS execution
        WHERE (
            p_execution_id IS NULL
            OR execution.id = p_execution_id
        )
        AND (
            (
                execution.status = 'pendente'
                AND execution.data_execucao <= now()
            ) OR (
                execution.status = 'processando'
                AND execution.claim_expires_at IS NOT NULL
                AND execution.claim_expires_at <= now()
            )
        )
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
