const REMINDER_DEDUPLICATION_PREFIX = 'lembrete_agendamento';

const normalizeAppointmentStatus = (status?: string | null): string =>
  String(status || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

export const canonicalizeReminderSchedule = (value?: string | null): string | null => {
  const match = String(value || '').match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  return match ? `${match[1]}T${match[2]}:${match[3]}` : null;
};

export const buildReminderScheduleFromDatabase = (
  date?: string | null,
  time?: string | null
): string | null => canonicalizeReminderSchedule(
  date && time ? `${date}T${time}` : null
);

export const buildReminderDeduplicationKey = (
  appointmentId?: string | null,
  schedule?: string | null
): string | undefined => {
  const canonicalSchedule = canonicalizeReminderSchedule(schedule);
  return appointmentId && canonicalSchedule
    ? `${REMINDER_DEDUPLICATION_PREFIX}:${appointmentId}:${canonicalSchedule}`
    : undefined;
};

export const isReminderAppointmentEligible = (status?: string | null): boolean =>
  ['agendado', 'confirmado'].includes(normalizeAppointmentStatus(status));

export type ReminderGuardDecision =
  | { action: 'send'; reason: 'eligible' }
  | { action: 'cancel'; reason: 'appointment_missing' | 'appointment_not_eligible' | 'schedule_changed' }
  | { action: 'retry'; reason: 'appointment_load_failed' };

export const evaluateReminderExecution = (input: {
  appointmentId?: string | null;
  executionDeduplicationKey?: string | null;
  appointmentFound: boolean;
  appointmentLoadFailed?: boolean;
  appointmentStatus?: string | null;
  currentSchedule?: string | null;
}): ReminderGuardDecision => {
  if (input.appointmentLoadFailed) {
    return { action: 'retry', reason: 'appointment_load_failed' };
  }

  if (!input.appointmentFound) {
    return { action: 'cancel', reason: 'appointment_missing' };
  }

  if (!isReminderAppointmentEligible(input.appointmentStatus)) {
    return { action: 'cancel', reason: 'appointment_not_eligible' };
  }

  const currentKey = buildReminderDeduplicationKey(
    input.appointmentId,
    input.currentSchedule
  );
  if (!currentKey || input.executionDeduplicationKey !== currentKey) {
    return { action: 'cancel', reason: 'schedule_changed' };
  }

  return { action: 'send', reason: 'eligible' };
};
