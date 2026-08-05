-- Migration: compatibilidade e deduplicação da automação cliente_inativo.
-- Não cria execuções; somente reconcilia chaves legadas da fila existente.

BEGIN;

-- Para cada cliente, associa no máximo uma execução legada ao ciclo iniciado
-- pelo atendimento concluído mais recente. Sucesso já registrado tem
-- preferência para impedir novo envio; em seguida vêm claim ativo, pendência e
-- estados finais sem sucesso.
WITH completed_appointments AS (
    SELECT
        appointment.id,
        appointment.cliente_id,
        (
            appointment.data_agendamento + appointment.hora_agendamento
        ) AT TIME ZONE 'America/Sao_Paulo' AS completed_at,
        row_number() OVER (
            PARTITION BY appointment.cliente_id
            ORDER BY
                appointment.data_agendamento DESC,
                appointment.hora_agendamento DESC,
                appointment.id DESC
        ) AS completion_rank
    FROM public.agendamentos AS appointment
    WHERE translate(
        lower(trim(coalesce(appointment.status, ''))),
        'áàâãéêíóôõúç',
        'aaaaeeiooouc'
    ) IN ('concluido', 'finalizado', 'entregue')
      AND appointment.data_agendamento IS NOT NULL
      AND appointment.hora_agendamento IS NOT NULL
), current_episode_candidate AS (
    SELECT DISTINCT ON (execution.customer_id)
        execution.id,
        'cliente_inativo:' || execution.customer_id || ':' || completed.id AS canonical_key
    FROM public.automacoes_execucoes AS execution
    JOIN completed_appointments AS completed
      ON completed.cliente_id = execution.customer_id
     AND completed.completion_rank = 1
    WHERE execution.automacao = 'cliente_inativo'
      AND execution.deduplication_key IS NULL
      AND execution.created_at >= completed.completed_at
    ORDER BY
        execution.customer_id,
        CASE execution.status
            WHEN 'sucesso' THEN 0
            WHEN 'processando' THEN 1
            WHEN 'pendente' THEN 2
            WHEN 'erro_definitivo' THEN 3
            WHEN 'cancelada' THEN 4
            ELSE 5
        END,
        execution.created_at,
        execution.id
)
UPDATE public.automacoes_execucoes AS execution
SET deduplication_key = candidate.canonical_key,
    updated_at = now()
FROM current_episode_candidate AS candidate
WHERE execution.id = candidate.id
  AND NOT EXISTS (
      SELECT 1
      FROM public.automacoes_execucoes AS current_execution
      WHERE current_execution.id <> execution.id
        AND current_execution.deduplication_key = candidate.canonical_key
  );

-- Pendências que continuaram sem chave são ambíguas ou duplicadas. Elas ficam
-- canceladas, com rastreabilidade, e o worker recria somente a execução que
-- satisfizer os critérios atuais.
UPDATE public.automacoes_execucoes AS execution
SET status = 'cancelada',
    resposta_api = 'Execução legada cancelada: ciclo de inatividade ambíguo ou duplicado.',
    deduplication_key = 'legacy_inactive_pending:' || execution.id,
    claim_token = NULL,
    claimed_at = NULL,
    claim_expires_at = NULL,
    updated_at = now()
WHERE execution.automacao = 'cliente_inativo'
  AND execution.status = 'pendente'
  AND execution.deduplication_key IS NULL;

COMMIT;
