\set ON_ERROR_STOP on

\if :{?backfill_since}
\else
  \echo 'ERRO: informe -v backfill_since=YYYY-MM-DDTHH:MM:SSZ'
  \quit 2
\endif

\if :{?approve_backfill}
\else
  \set approve_backfill 'NO'
\endif

SELECT :'approve_backfill' = 'YES' AS backfill_approved \gset

BEGIN;

CREATE TEMP TABLE approved_legacy_backfill ON COMMIT DROP AS
SELECT
    execution.id AS legacy_execution_id,
    execution.automacao,
    execution.appointment_id,
    execution.customer_id,
    CASE
        WHEN execution.automacao = 'novo_cliente'
            THEN 'novo_cliente:' || execution.customer_id
        ELSE execution.automacao || ':' || execution.appointment_id
    END AS canonical_key
FROM public.automacoes_execucoes AS execution
WHERE execution.status = 'cancelada'
  AND execution.resposta_api =
      'Execução legada vazia em quarentena; requer backfill operacional aprovado.'
  AND execution.created_at >= :'backfill_since'::timestamptz
  AND execution.automacao IN (
      'novo_cliente',
      'novo_agendamento',
      'servico_iniciado',
      'servico_finalizado'
  )
  AND (
      execution.automacao = 'novo_cliente'
      OR execution.appointment_id IS NOT NULL
  )
  AND (
      execution.appointment_id IS NULL
      OR EXISTS (
          SELECT 1
          FROM public.agendamentos AS appointment
          WHERE appointment.id = execution.appointment_id
            AND lower(coalesce(appointment.status, '')) <> 'cancelado'
      )
  )
  AND NOT EXISTS (
      SELECT 1
      FROM public.automacoes_execucoes AS delivered
      WHERE delivered.status = 'sucesso'
        AND delivered.deduplication_key = CASE
            WHEN execution.automacao = 'novo_cliente'
                THEN 'novo_cliente:' || execution.customer_id
            ELSE execution.automacao || ':' || execution.appointment_id
        END
  );

\echo 'Candidatos ao backfill por tipo:'
SELECT automacao, count(*)
FROM approved_legacy_backfill
GROUP BY automacao
ORDER BY automacao;

\if :backfill_approved
  INSERT INTO public.automacoes_eventos (
      automacao,
      appointment_id,
      customer_id,
      deduplication_key,
      status
  )
  SELECT
      candidate.automacao,
      candidate.appointment_id,
      candidate.customer_id,
      candidate.canonical_key,
      'pendente'
  FROM approved_legacy_backfill AS candidate
  ON CONFLICT (deduplication_key) DO NOTHING;

  \echo 'Backfill aprovado e aplicado. Revise a contagem antes de COMMIT.'
  SELECT automacao, status, count(*)
  FROM public.automacoes_eventos
  WHERE deduplication_key IN (
      SELECT canonical_key FROM approved_legacy_backfill
  )
  GROUP BY automacao, status
  ORDER BY automacao, status;
  COMMIT;
\else
  \echo 'DRY-RUN: nenhuma linha inserida. Use -v approve_backfill=YES após aprovação.'
  ROLLBACK;
\endif
