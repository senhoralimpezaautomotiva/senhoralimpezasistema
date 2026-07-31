import { AppointmentStatus } from '../types';
import { isWithinReminderWindow } from '../utils/operationalWindow';

export type ReminderDeliveryDecision =
  | { action: 'send' }
  | {
      action: 'cancel';
      reason:
        | 'missing_appointment_id'
        | 'legacy_deduplication_key'
        | 'appointment_not_found'
        | 'appointment_not_active'
        | 'appointment_rescheduled'
        | 'outside_reminder_window';
    }
  | { action: 'retry'; reason: 'appointment_load_failed' };

export const buildReminderDeduplicationKey = (
  appointmentId: string,
  appointmentDateTime: string
): string => `lembrete_agendamento:${appointmentId}:${appointmentDateTime}`;

export const getReminderScheduleFromDeduplicationKey = (
  deduplicationKey: string | undefined,
  appointmentId: string
): string | null => {
  const prefix = `lembrete_agendamento:${appointmentId}:`;
  if (!deduplicationKey?.startsWith(prefix)) return null;
  const scheduledFor = deduplicationKey.slice(prefix.length);
  return scheduledFor || null;
};

export const classifyReminderDelivery = (input: {
  appointmentId?: string;
  deduplicationKey?: string;
  appointmentFound: boolean;
  appointmentLoadFailed?: boolean;
  appointmentStatus?: AppointmentStatus;
  appointmentDateTime?: string;
  now: Date;
  advanceHours: number;
}): ReminderDeliveryDecision => {
  if (!input.appointmentId) {
    return { action: 'cancel', reason: 'missing_appointment_id' };
  }
  if (input.appointmentLoadFailed) {
    return { action: 'retry', reason: 'appointment_load_failed' };
  }

  const expectedDateTime = getReminderScheduleFromDeduplicationKey(
    input.deduplicationKey,
    input.appointmentId
  );
  if (!expectedDateTime) {
    return { action: 'cancel', reason: 'legacy_deduplication_key' };
  }
  if (!input.appointmentFound || !input.appointmentDateTime || !input.appointmentStatus) {
    return { action: 'cancel', reason: 'appointment_not_found' };
  }
  if (!['agendado', 'confirmado'].includes(input.appointmentStatus)) {
    return { action: 'cancel', reason: 'appointment_not_active' };
  }
  if (input.appointmentDateTime !== expectedDateTime) {
    return { action: 'cancel', reason: 'appointment_rescheduled' };
  }
  if (
    !isWithinReminderWindow(
      input.appointmentDateTime,
      input.now,
      input.advanceHours
    )
  ) {
    return { action: 'cancel', reason: 'outside_reminder_window' };
  }
  return { action: 'send' };
};
