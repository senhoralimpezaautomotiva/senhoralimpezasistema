import { AgendaConfig, Appointment, AppointmentRecurrenceFrequency, Service } from '../types';
import { isAgendaStartTimeAvailable } from './agendaAvailability';

export type RecurrenceEndMode = 'count' | 'date';

export interface AppointmentRecurrenceOptions {
  enabled: boolean;
  frequency: AppointmentRecurrenceFrequency;
  endMode: RecurrenceEndMode;
  count: number;
  endDate: string;
}

export interface RecurrenceConflict {
  date: string;
  time: string;
  reason: string;
}

const MAX_RECURRENCE_OCCURRENCES = 52;

const toIsoDate = (date: Date): string => (
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
);

const parseIsoDate = (date: string): Date => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

const addFrequency = (date: Date, frequency: AppointmentRecurrenceFrequency, sequence: number): Date => {
  const next = new Date(date.getTime());
  if (frequency === 'weekly') {
    next.setDate(next.getDate() + 7 * sequence);
    return next;
  }
  if (frequency === 'biweekly') {
    next.setDate(next.getDate() + 14 * sequence);
    return next;
  }

  const originalDay = date.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + sequence);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(originalDay, lastDay));
  return next;
};

export const createRecurrenceId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `rec_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

export function buildRecurringAppointments(
  baseAppointment: Omit<Appointment, 'id'>,
  options: AppointmentRecurrenceOptions,
  recurrenceId = createRecurrenceId()
): Array<Omit<Appointment, 'id'>> {
  if (!options.enabled) return [baseAppointment];

  const [baseDate, baseTime = '09:00'] = baseAppointment.dateTime.split('T');
  const total = options.endMode === 'count'
    ? Math.max(1, Math.min(MAX_RECURRENCE_OCCURRENCES, Math.floor(options.count || 1)))
    : MAX_RECURRENCE_OCCURRENCES;
  const endDate = options.endMode === 'date' && options.endDate ? parseIsoDate(options.endDate) : null;
  const startDate = parseIsoDate(baseDate);
  const occurrences: Array<Omit<Appointment, 'id'>> = [];

  for (let index = 0; index < total; index++) {
    const occurrenceDate = addFrequency(startDate, options.frequency, index);
    if (endDate && occurrenceDate > endDate) break;
    occurrences.push({
      ...baseAppointment,
      dateTime: `${toIsoDate(occurrenceDate)}T${baseTime.slice(0, 5)}`,
      recurrenceId,
      recurrenceSequence: index + 1,
      recurrenceFrequency: options.frequency,
      recurrenceTotal: 0
    });
  }

  const recurrenceTotal = occurrences.length;
  return occurrences.map(occurrence => ({
    ...occurrence,
    recurrenceTotal
  }));
}

export function validateRecurringAppointments(params: {
  agenda: AgendaConfig;
  existingAppointments: Appointment[];
  occurrences: Array<Omit<Appointment, 'id'>>;
  services: Service[];
  serviceDuration: number;
  now?: Date;
}): RecurrenceConflict[] {
  const { agenda, existingAppointments, occurrences, services, serviceDuration, now = new Date() } = params;
  const stagedAppointments: Appointment[] = [...existingAppointments];
  const conflicts: RecurrenceConflict[] = [];

  for (const occurrence of occurrences) {
    const [date, time = '09:00'] = occurrence.dateTime.split('T');
    const [hours, minutes] = time.slice(0, 5).split(':').map(Number);
    const occurrenceDate = parseIsoDate(date);
    occurrenceDate.setHours(hours || 0, minutes || 0, 0, 0);
    const diffDays = (occurrenceDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > agenda.maxAdvanceDays) {
      conflicts.push({
        date,
        time: time.slice(0, 5),
        reason: 'Data excede a antecedencia maxima da agenda'
      });
      continue;
    }

    const available = isAgendaStartTimeAvailable({
      agenda,
      appointments: stagedAppointments,
      services,
      date,
      serviceDuration,
      time: time.slice(0, 5),
      now
    });

    if (!available) {
      conflicts.push({
        date,
        time: time.slice(0, 5),
        reason: 'Horario indisponivel ou fora das regras da agenda'
      });
      continue;
    }

    stagedAppointments.push({
      ...occurrence,
      id: `pending-${occurrence.recurrenceId}-${occurrence.recurrenceSequence}`
    });
  }

  return conflicts;
}
