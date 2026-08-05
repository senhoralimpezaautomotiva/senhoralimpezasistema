-- Migration: segurança de lembretes em cancelamentos e reagendamentos.
-- Mantém o worker como único produtor de automacoes_execucoes.

BEGIN;

-- Pendências antigas não registravam o horário na chave de deduplicação. Elas
-- são canceladas, sem envio, para que o worker recrie somente o lembrete do
-- horário atualmente persistido no agendamento.
UPDATE public.automacoes_execucoes AS execution
SET status = 'cancelada',
    resposta_api = 'Execução legada cancelada: horário não identificado; o worker recriará o lembrete atual.',
    deduplication_key = 'legacy_reminder_pending:' || execution.id,
    claim_token = NULL,
    claimed_at = NULL,
    claim_expires_at = NULL,
    updated_at = now()
WHERE execution.automacao = 'lembrete_agendamento'
  AND execution.status = 'pendente'
  AND execution.appointment_id IS NOT NULL
  AND execution.deduplication_key = 'lembrete_agendamento:' || execution.appointment_id;

-- Históricos legados cujo agendamento não mudou desde a criação recebem a
-- chave canônica do horário conhecido. Isso impede um novo envio do mesmo
-- lembrete após a publicação. Registros cujo agendamento mudou permanecem
-- legados e não bloqueiam o lembrete do novo horário.
UPDATE public.automacoes_execucoes AS execution
SET deduplication_key = 'lembrete_agendamento:'
        || execution.appointment_id
        || ':'
        || appointment.data_agendamento::text
        || 'T'
        || to_char(appointment.hora_agendamento::time, 'HH24:MI'),
    updated_at = now()
FROM public.agendamentos AS appointment
WHERE execution.automacao = 'lembrete_agendamento'
  AND execution.status <> 'pendente'
  AND execution.appointment_id = appointment.id
  AND execution.deduplication_key = 'lembrete_agendamento:' || execution.appointment_id
  AND appointment.data_agendamento IS NOT NULL
  AND appointment.hora_agendamento IS NOT NULL
  AND coalesce(appointment.updated_at, execution.created_at) <= execution.created_at
  AND NOT EXISTS (
      SELECT 1
      FROM public.automacoes_execucoes AS current_execution
      WHERE current_execution.id <> execution.id
        AND current_execution.deduplication_key = 'lembrete_agendamento:'
            || execution.appointment_id
            || ':'
            || appointment.data_agendamento::text
            || 'T'
            || to_char(appointment.hora_agendamento::time, 'HH24:MI')
  );

CREATE OR REPLACE FUNCTION public.fn_trigger_cancelar_automacoes_agendamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_new_status TEXT := lower(trim(coalesce(NEW.status, '')));
    v_old_status TEXT := lower(trim(coalesce(OLD.status, '')));
    v_schedule_changed BOOLEAN :=
        NEW.data_agendamento IS DISTINCT FROM OLD.data_agendamento
        OR NEW.hora_agendamento IS DISTINCT FROM OLD.hora_agendamento;
BEGIN
    BEGIN
        IF v_new_status = 'cancelado' AND v_old_status <> 'cancelado' THEN
            UPDATE public.automacoes_eventos
            SET status = 'ignorado_definitivo',
                processed_at = now(),
                ultimo_erro = 'Agendamento cancelado.'
            WHERE appointment_id = NEW.id
              AND status IN ('pendente', 'pendente_retry');

            UPDATE public.automacoes_execucoes
            SET status = 'cancelada',
                resposta_api = 'Execução cancelada: agendamento cancelado.',
                updated_at = now()
            WHERE appointment_id = NEW.id
              AND status = 'pendente';
        ELSIF v_schedule_changed THEN
            UPDATE public.automacoes_execucoes
            SET status = 'cancelada',
                resposta_api = 'Execução cancelada: agendamento reagendado.',
                updated_at = now()
            WHERE appointment_id = NEW.id
              AND automacao = 'lembrete_agendamento'
              AND status = 'pendente';
        ELSIF v_new_status NOT IN ('agendado', 'confirmado')
              AND v_old_status IS DISTINCT FROM v_new_status
        THEN
            UPDATE public.automacoes_execucoes
            SET status = 'cancelada',
                resposta_api = 'Execução cancelada: estado atual não permite lembrete.',
                updated_at = now()
            WHERE appointment_id = NEW.id
              AND automacao = 'lembrete_agendamento'
              AND status = 'pendente';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Falha isolada ao invalidar automações do agendamento %: %',
            NEW.id,
            SQLERRM;
    END;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_cancelar_automacoes_agendamento
ON public.agendamentos;

CREATE TRIGGER trigger_cancelar_automacoes_agendamento
    AFTER UPDATE OF status, data_agendamento, hora_agendamento
    ON public.agendamentos
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_trigger_cancelar_automacoes_agendamento();

COMMIT;
