import { AutomationTrigger } from '../types';

export type AutomationEventDecision =
  | { action: 'queue'; reason: 'eligible' }
  | { action: 'processado'; reason: 'duplicate_execution' }
  | { action: 'ignorado_definitivo'; reason: string }
  | { action: 'pendente_retry'; reason: string }
  | { action: 'erro_definitivo'; reason: string };

const OPERATIONAL_EVENTS = new Set([
  'novo_cliente',
  'novo_agendamento',
  'servico_iniciado',
  'servico_finalizado',
  'pagamento_recebido',
  'orcamento_enviado'
]);

interface AutomationEventPolicyInput {
  event: string;
  appointmentId?: string | null;
  budgetId?: string | null;
  configurationLoaded: boolean;
  customersLoaded: boolean;
  appointmentsLoaded: boolean;
  vehiclesLoaded: boolean;
  servicesLoaded: boolean;
  budgetsLoaded?: boolean;
  customerFound: boolean;
  appointmentFound: boolean;
  appointmentStatus?: string;
  vehicleFound: boolean;
  serviceFound: boolean;
  budgetFound?: boolean;
  duplicateExecution: boolean;
  trigger?: AutomationTrigger;
  phone: string;
}

export const classifyAutomationEvent = (
  input: AutomationEventPolicyInput
): AutomationEventDecision => {
  if (!OPERATIONAL_EVENTS.has(input.event)) {
    return { action: 'erro_definitivo', reason: 'unsupported_event' };
  }
  if (!input.configurationLoaded) {
    return { action: 'pendente_retry', reason: 'configuration_sync_incomplete' };
  }
  if (!input.customersLoaded) {
    return { action: 'pendente_retry', reason: 'customer_sync_incomplete' };
  }
  if (input.appointmentId && !input.appointmentsLoaded) {
    return { action: 'pendente_retry', reason: 'appointment_sync_incomplete' };
  }
  if (input.appointmentId && (!input.vehiclesLoaded || !input.servicesLoaded)) {
    return { action: 'pendente_retry', reason: 'appointment_context_sync_incomplete' };
  }
  if (input.budgetId && !input.budgetsLoaded) {
    return { action: 'pendente_retry', reason: 'budget_sync_incomplete' };
  }
  if (input.duplicateExecution) {
    return { action: 'processado', reason: 'duplicate_execution' };
  }
  if (!input.customerFound) {
    return { action: 'pendente_retry', reason: 'customer_missing_from_memory' };
  }
  if (input.appointmentId && !input.appointmentFound) {
    return { action: 'pendente_retry', reason: 'appointment_missing_from_memory' };
  }
  if (input.budgetId && !input.budgetFound) {
    return { action: 'pendente_retry', reason: 'budget_missing_from_memory' };
  }
  if (input.appointmentStatus === 'cancelado') {
    return { action: 'ignorado_definitivo', reason: 'appointment_cancelled' };
  }
  if (input.appointmentId && (!input.vehicleFound || !input.serviceFound)) {
    return { action: 'ignorado_definitivo', reason: 'invalid_appointment_relations' };
  }
  if (!input.trigger) {
    return { action: 'ignorado_definitivo', reason: 'automation_not_configured' };
  }
  if (!input.trigger.isActive) {
    return { action: 'ignorado_definitivo', reason: 'automation_inactive' };
  }
  if (!input.trigger.template.trim()) {
    return { action: 'ignorado_definitivo', reason: 'empty_template' };
  }
  if (input.phone.replace(/\D/g, '').length < 8) {
    return { action: 'ignorado_definitivo', reason: 'invalid_phone' };
  }
  return { action: 'queue', reason: 'eligible' };
};

export const getAutomationEventRetryDelayMinutes = (attempts: number): number =>
  Math.min(60, 2 ** Math.max(0, Math.min(attempts, 6)));
