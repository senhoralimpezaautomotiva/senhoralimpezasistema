import type { Appointment, AutomationExecution } from '../types';

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const BUSINESS_TIME_ZONE = 'America/Sao_Paulo';

type InactiveCustomerAppointment = Pick<
  Appointment,
  'id' | 'dateTime' | 'status' | 'concludedAt' | 'createdAt'
>;

type InactiveCustomerExecution = Pick<
  AutomationExecution,
  'deduplication_key' | 'status' | 'created_at' | 'updated_at'
>;

export type InactiveCustomerStage = 1 | 2 | 3;

const FOLLOW_UP_DAYS: Record<Exclude<InactiveCustomerStage, 1>, number> = {
  2: 7,
  3: 21
};

const normalizeStatus = (status?: string | null): string =>
  String(status || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

export const parseInactiveCustomerDateTime = (value?: string | null): number => {
  const source = String(value || '');
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(source)) {
    return Date.parse(source);
  }

  const match = source.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/
  );
  if (!match) return Number.NaN;

  const desiredWallClock = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] || 0)
  );
  let timestamp = desiredWallClock;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });

  for (let attempt = 0; attempt < 2; attempt++) {
    const parts = formatter.formatToParts(new Date(timestamp));
    const read = (type: Intl.DateTimeFormatPartTypes): number =>
      Number(parts.find(part => part.type === type)?.value || 0);
    const representedWallClock = Date.UTC(
      read('year'),
      read('month') - 1,
      read('day'),
      read('hour'),
      read('minute'),
      read('second')
    );
    timestamp += desiredWallClock - representedWallClock;
  }

  return timestamp;
};

const getAppointmentTimestamp = (appointment: InactiveCustomerAppointment): number => {
  const timestamp = parseInactiveCustomerDateTime(
    appointment.concludedAt || appointment.dateTime
  );
  return Number.isFinite(timestamp) ? timestamp : Number.NaN;
};

export const buildInactiveCustomerCycleKey = (
  customerId?: string | null,
  lastCompletedAppointmentId?: string | null
): string | undefined => customerId && lastCompletedAppointmentId
  ? `cliente_inativo:${customerId}:${lastCompletedAppointmentId}`
  : undefined;

export const buildInactiveCustomerDeduplicationKey = (
  customerId?: string | null,
  lastCompletedAppointmentId?: string | null,
  stage: InactiveCustomerStage = 1
): string | undefined => {
  const cycleKey = buildInactiveCustomerCycleKey(
    customerId,
    lastCompletedAppointmentId
  );
  return cycleKey ? `${cycleKey}:etapa:${stage}` : undefined;
};

const parseInactiveCustomerStage = (
  deduplicationKey: string | null | undefined,
  cycleKey: string
): { stage: InactiveCustomerStage; legacy: boolean } | undefined => {
  if (deduplicationKey === cycleKey) {
    return { stage: 1, legacy: true };
  }

  const stage = ([1, 2, 3] as const).find(
    item => deduplicationKey === `${cycleKey}:etapa:${item}`
  );
  return stage ? { stage, legacy: false } : undefined;
};

export type InactiveCustomerDecision =
  | {
      eligible: true;
      reason: 'eligible';
      completedCount: number;
      lastCompletedAppointment: InactiveCustomerAppointment;
      cycleKey: string;
      deduplicationKey: string;
    }
  | {
      eligible: false;
      reason:
        | 'no_completed_service'
        | 'minimum_services_not_reached'
        | 'inactivity_period_not_reached'
        | 'future_appointment'
        | 'active_service';
      completedCount: number;
    };

export const evaluateInactiveCustomer = (input: {
  customerId: string;
  appointments: InactiveCustomerAppointment[];
  inactiveDays: number;
  minServices: number;
  now?: Date;
}): InactiveCustomerDecision => {
  const nowTimestamp = (input.now || new Date()).getTime();
  const inactiveDays = Math.max(1, Math.trunc(input.inactiveDays || 30));
  const minServices = Math.max(0, Math.trunc(input.minServices || 0));

  const completedAppointments = input.appointments
    .filter(appointment => {
      const status = normalizeStatus(appointment.status);
      const timestamp = getAppointmentTimestamp(appointment);
      return ['finalizado', 'entregue'].includes(status)
        && Number.isFinite(timestamp)
        && timestamp <= nowTimestamp;
    })
    .sort((left, right) => getAppointmentTimestamp(right) - getAppointmentTimestamp(left));

  if (completedAppointments.length === 0) {
    return {
      eligible: false,
      reason: 'no_completed_service',
      completedCount: 0
    };
  }

  if (completedAppointments.length < minServices) {
    return {
      eligible: false,
      reason: 'minimum_services_not_reached',
      completedCount: completedAppointments.length
    };
  }

  const hasActiveService = input.appointments.some(appointment =>
    [
      'cliente_chegou',
      'em_andamento',
      'aguardando_aprovacao',
      'aguardando_peca'
    ].includes(normalizeStatus(appointment.status))
  );
  if (hasActiveService) {
    return {
      eligible: false,
      reason: 'active_service',
      completedCount: completedAppointments.length
    };
  }

  const hasFutureAppointment = input.appointments.some(appointment => {
    const timestamp = parseInactiveCustomerDateTime(appointment.dateTime);
    return ['agendado', 'confirmado'].includes(normalizeStatus(appointment.status))
      && Number.isFinite(timestamp)
      && timestamp >= nowTimestamp;
  });
  if (hasFutureAppointment) {
    return {
      eligible: false,
      reason: 'future_appointment',
      completedCount: completedAppointments.length
    };
  }

  const lastCompletedAppointment = completedAppointments[0];
  const inactiveSince = getAppointmentTimestamp(lastCompletedAppointment);
  if (nowTimestamp - inactiveSince < inactiveDays * DAY_IN_MILLISECONDS) {
    return {
      eligible: false,
      reason: 'inactivity_period_not_reached',
      completedCount: completedAppointments.length
    };
  }

  const cycleKey = buildInactiveCustomerCycleKey(
    input.customerId,
    lastCompletedAppointment.id
  );
  const deduplicationKey = buildInactiveCustomerDeduplicationKey(
    input.customerId,
    lastCompletedAppointment.id,
    1
  );
  if (!cycleKey || !deduplicationKey) {
    return {
      eligible: false,
      reason: 'no_completed_service',
      completedCount: completedAppointments.length
    };
  }

  return {
    eligible: true,
    reason: 'eligible',
    completedCount: completedAppointments.length,
    lastCompletedAppointment,
    cycleKey,
    deduplicationKey
  };
};

export type InactiveCustomerCadenceDecision =
  | {
      action: 'queue';
      reason: 'stage_due';
      stage: InactiveCustomerStage;
      deduplicationKey: string;
    }
  | {
      action: 'wait';
      reason:
        | 'legacy_cycle'
        | 'stage_already_exists'
        | 'previous_stage_not_accepted'
        | 'accepted_timestamp_invalid'
        | 'follow_up_not_due'
        | 'appointment_after_first_message'
        | 'sequence_complete';
    };

const acceptedAt = (execution?: InactiveCustomerExecution): number => {
  if (!execution || execution.status !== 'sucesso') return Number.NaN;
  return Date.parse(execution.updated_at || execution.created_at);
};

const hasAppointmentAfterFirstMessage = (
  appointments: InactiveCustomerAppointment[],
  lastCompletedAppointmentId: string,
  firstAcceptedAt: number
): boolean => appointments.some(appointment => {
  if (appointment.id === lastCompletedAppointmentId) return false;
  const createdAt = Date.parse(String(appointment.createdAt || ''));
  return Number.isFinite(createdAt) && createdAt > firstAcceptedAt;
});

export const evaluateInactiveCustomerCadence = (input: {
  customerDecision: Extract<InactiveCustomerDecision, { eligible: true }>;
  appointments: InactiveCustomerAppointment[];
  executions: InactiveCustomerExecution[];
  now?: Date;
}): InactiveCustomerCadenceDecision => {
  const { customerDecision } = input;
  const cycleExecutions = input.executions
    .map(execution => ({
      execution,
      parsed: parseInactiveCustomerStage(
        execution.deduplication_key,
        customerDecision.cycleKey
      )
    }))
    .filter(item => Boolean(item.parsed));

  if (cycleExecutions.some(item => item.parsed?.legacy)) {
    return { action: 'wait', reason: 'legacy_cycle' };
  }

  const byStage = (stage: InactiveCustomerStage): InactiveCustomerExecution | undefined =>
    cycleExecutions.find(item => item.parsed?.stage === stage)?.execution;
  const first = byStage(1);
  if (!first) {
    return {
      action: 'queue',
      reason: 'stage_due',
      stage: 1,
      deduplicationKey: customerDecision.deduplicationKey
    };
  }

  if (first.status !== 'sucesso') {
    return { action: 'wait', reason: 'stage_already_exists' };
  }

  const firstAcceptedAt = acceptedAt(first);
  if (!Number.isFinite(firstAcceptedAt)) {
    return { action: 'wait', reason: 'accepted_timestamp_invalid' };
  }

  if (hasAppointmentAfterFirstMessage(
    input.appointments,
    customerDecision.lastCompletedAppointment.id,
    firstAcceptedAt
  )) {
    return { action: 'wait', reason: 'appointment_after_first_message' };
  }

  const second = byStage(2);
  const nowTimestamp = (input.now || new Date()).getTime();
  if (!second) {
    if (nowTimestamp < firstAcceptedAt + FOLLOW_UP_DAYS[2] * DAY_IN_MILLISECONDS) {
      return { action: 'wait', reason: 'follow_up_not_due' };
    }
    return {
      action: 'queue',
      reason: 'stage_due',
      stage: 2,
      deduplicationKey: `${customerDecision.cycleKey}:etapa:2`
    };
  }

  if (second.status !== 'sucesso') {
    return { action: 'wait', reason: 'previous_stage_not_accepted' };
  }

  const secondAcceptedAt = acceptedAt(second);
  if (!Number.isFinite(secondAcceptedAt)) {
    return { action: 'wait', reason: 'accepted_timestamp_invalid' };
  }

  const third = byStage(3);
  if (third) {
    return { action: 'wait', reason: 'sequence_complete' };
  }
  const thirdDueAt = Math.max(
    firstAcceptedAt + FOLLOW_UP_DAYS[3] * DAY_IN_MILLISECONDS,
    secondAcceptedAt + FOLLOW_UP_DAYS[2] * DAY_IN_MILLISECONDS
  );
  if (nowTimestamp < thirdDueAt) {
    return { action: 'wait', reason: 'follow_up_not_due' };
  }
  return {
    action: 'queue',
    reason: 'stage_due',
    stage: 3,
    deduplicationKey: `${customerDecision.cycleKey}:etapa:3`
  };
};

export type InactiveCustomerExecutionDecision =
  | { action: 'send'; reason: 'eligible' }
  | { action: 'retry'; reason: 'appointments_load_failed' }
  | {
      action: 'cancel';
      reason:
        | Exclude<InactiveCustomerDecision['reason'], 'eligible'>
        | 'inactivity_episode_changed'
        | 'invalid_sequence_stage'
        | 'previous_stage_not_accepted'
        | 'accepted_timestamp_invalid'
        | 'follow_up_not_due'
        | 'appointment_after_first_message';
    };

export const evaluateInactiveCustomerExecution = (input: {
  appointmentLoadFailed?: boolean;
  executionDeduplicationKey?: string | null;
  customerDecision?: InactiveCustomerDecision;
  appointments?: InactiveCustomerAppointment[];
  executions?: InactiveCustomerExecution[];
  now?: Date;
}): InactiveCustomerExecutionDecision => {
  if (input.appointmentLoadFailed) {
    return { action: 'retry', reason: 'appointments_load_failed' };
  }

  if (!input.customerDecision) {
    return { action: 'cancel', reason: 'no_completed_service' };
  }

  if (input.customerDecision.eligible === false) {
    return {
      action: 'cancel',
      reason: input.customerDecision.reason
    };
  }
  const customerDecision = input.customerDecision;

  const parsedStage = parseInactiveCustomerStage(
    input.executionDeduplicationKey,
    customerDecision.cycleKey
  );
  if (!parsedStage) {
    return { action: 'cancel', reason: 'inactivity_episode_changed' };
  }

  if (parsedStage.stage === 1) {
    return { action: 'send', reason: 'eligible' };
  }

  if (parsedStage.legacy) {
    return { action: 'cancel', reason: 'invalid_sequence_stage' };
  }

  const executions = input.executions || [];
  const first = executions.find(execution =>
    parseInactiveCustomerStage(
      execution.deduplication_key,
      customerDecision.cycleKey
    )?.stage === 1
    && execution.deduplication_key !== customerDecision.cycleKey
  );
  if (!first || first.status !== 'sucesso') {
    return { action: 'cancel', reason: 'previous_stage_not_accepted' };
  }

  const firstAcceptedAt = acceptedAt(first);
  if (!Number.isFinite(firstAcceptedAt)) {
    return { action: 'cancel', reason: 'accepted_timestamp_invalid' };
  }

  if (hasAppointmentAfterFirstMessage(
    input.appointments || [],
    customerDecision.lastCompletedAppointment.id,
    firstAcceptedAt
  )) {
    return { action: 'cancel', reason: 'appointment_after_first_message' };
  }

  const nowTimestamp = (input.now || new Date()).getTime();
  if (
    nowTimestamp
    < firstAcceptedAt + FOLLOW_UP_DAYS[parsedStage.stage] * DAY_IN_MILLISECONDS
  ) {
    return { action: 'cancel', reason: 'follow_up_not_due' };
  }

  if (parsedStage.stage === 3) {
    const second = executions.find(execution =>
      parseInactiveCustomerStage(
        execution.deduplication_key,
        customerDecision.cycleKey
      )?.stage === 2
    );
    if (!second || second.status !== 'sucesso') {
      return { action: 'cancel', reason: 'previous_stage_not_accepted' };
    }
    const secondAcceptedAt = acceptedAt(second);
    if (!Number.isFinite(secondAcceptedAt)) {
      return { action: 'cancel', reason: 'accepted_timestamp_invalid' };
    }
    if (
      nowTimestamp
      < secondAcceptedAt + FOLLOW_UP_DAYS[2] * DAY_IN_MILLISECONDS
    ) {
      return { action: 'cancel', reason: 'follow_up_not_due' };
    }
  }

  return { action: 'send', reason: 'eligible' };
};
