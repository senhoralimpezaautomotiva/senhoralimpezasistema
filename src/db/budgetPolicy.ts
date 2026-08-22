import { Appointment, AutomationExecution, Budget } from '../types';
import { budgetHasPendingItems } from '../utils/budgetLifecycle';

export type BudgetAutomationEvent =
  | 'orcamento_enviado'
  | 'orcamento_followup_7d'
  | 'orcamento_followup_14d';

export const buildBudgetDeduplicationKey = (
  event: BudgetAutomationEvent,
  budgetId?: string | null
): string | undefined => budgetId ? `${event}:${budgetId}` : undefined;

const DAY_MS = 24 * 60 * 60 * 1000;

const hasLaterAppointment = (
  budget: Budget,
  appointments: Appointment[],
  anchor: Date
): boolean => appointments.some(appointment => {
  if (appointment.customerId !== budget.customerId) return false;
  const createdAt = appointment.createdAt ? new Date(appointment.createdAt) : null;
  return Boolean(createdAt && Number.isFinite(createdAt.getTime()) && createdAt > anchor);
});

const isExpired = (budget: Budget, now: Date): boolean => {
  const endOfValidity = new Date(`${budget.validUntil}T23:59:59-03:00`);
  return !Number.isFinite(endOfValidity.getTime()) || now > endOfValidity;
};

export type BudgetAutomationDecision =
  | { action: 'queue'; reason: 'eligible'; deduplicationKey: string }
  | { action: 'send'; reason: 'eligible' }
  | { action: 'cancel'; reason: string }
  | { action: 'wait'; reason: string };

interface BudgetAutomationInput {
  event: BudgetAutomationEvent;
  budget: Budget;
  appointments: Appointment[];
  executions: AutomationExecution[];
  now?: Date;
  currentExecutionId?: string;
}

export const evaluateBudgetAutomation = (
  input: BudgetAutomationInput
): BudgetAutomationDecision => {
  const now = input.now ?? new Date();
  if (input.budget.status !== 'enviado') {
    return { action: 'cancel', reason: 'budget_not_pending' };
  }
  if (isExpired(input.budget, now)) {
    return { action: 'cancel', reason: 'budget_expired' };
  }

  const initialKey = buildBudgetDeduplicationKey('orcamento_enviado', input.budget.id)!;
  const initialExecution = input.executions.find(
    execution => execution.deduplication_key === initialKey && execution.status === 'sucesso'
  );
  const sentAnchor = input.budget.sentAt ? new Date(input.budget.sentAt) : null;
  const dueAnchorValue = input.event === 'orcamento_enviado'
    ? input.budget.sentAt
    : initialExecution?.updated_at;
  const dueAnchor = dueAnchorValue ? new Date(dueAnchorValue) : null;

  if (!sentAnchor || !Number.isFinite(sentAnchor.getTime())) {
    return { action: 'cancel', reason: 'send_timestamp_missing' };
  }
  if (!dueAnchor || !Number.isFinite(dueAnchor.getTime())) {
    return input.event === 'orcamento_enviado'
      ? { action: 'cancel', reason: 'send_timestamp_missing' }
      : { action: 'wait', reason: 'initial_send_not_accepted' };
  }
  if (!budgetHasPendingItems(input.budget, input.appointments)) {
    return { action: 'cancel', reason: 'budget_without_pending_items' };
  }
  if (!input.budget.items.some(item => item.status || item.appointmentId) && hasLaterAppointment(input.budget, input.appointments, sentAnchor)) {
    return { action: 'cancel', reason: 'appointment_after_budget_send' };
  }

  const deduplicationKey = buildBudgetDeduplicationKey(input.event, input.budget.id)!;
  const duplicate = input.executions.some(
    execution => execution.id !== input.currentExecutionId
      && execution.deduplication_key === deduplicationKey
  );
  if (duplicate) {
    return { action: 'cancel', reason: 'duplicate_execution' };
  }

  const days = input.event === 'orcamento_followup_7d'
    ? 7
    : input.event === 'orcamento_followup_14d'
      ? 14
      : 0;
  let dueAt = dueAnchor.getTime() + days * DAY_MS;

  if (input.event === 'orcamento_followup_7d' && !input.currentExecutionId) {
    const day14 = dueAnchor.getTime() + 14 * DAY_MS;
    if (now.getTime() >= day14) {
      return { action: 'cancel', reason: 'seven_day_window_missed' };
    }
  }

  if (input.event === 'orcamento_followup_14d') {
    const stage7Key = buildBudgetDeduplicationKey('orcamento_followup_7d', input.budget.id)!;
    const stage7 = input.executions.find(execution => execution.deduplication_key === stage7Key);
    if (stage7?.status === 'pendente' || stage7?.status === 'processando') {
      return { action: 'wait', reason: 'seven_day_follow_up_pending' };
    }
    if (stage7?.status === 'sucesso') {
      const stage7AcceptedAt = new Date(stage7.updated_at).getTime();
      if (Number.isFinite(stage7AcceptedAt)) {
        dueAt = Math.max(dueAt, stage7AcceptedAt + 7 * DAY_MS);
      }
    }
  }

  if (now.getTime() < dueAt) {
    return { action: 'wait', reason: 'follow_up_not_due' };
  }

  return input.currentExecutionId
    ? { action: 'send', reason: 'eligible' }
    : { action: 'queue', reason: 'eligible', deduplicationKey };
};
