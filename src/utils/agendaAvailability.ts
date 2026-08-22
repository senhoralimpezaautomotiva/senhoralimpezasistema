import { AgendaConfig, Appointment, Service } from '../types';

export interface AvailableStartOption {
  time: string;
  capacity: number;
  occupancy: number;
}

export const timeToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.slice(0, 5).split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

export const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const overlaps = (startA: number, endA: number, startB: number, endB: number): boolean =>
  startA < endB && endA > startB;

const getAppointmentDuration = (appointment: Appointment, services: Service[]): number => {
  const service = services.find(s => s.id === appointment.serviceId);
  return appointment.durationTotal || service?.estimatedTime || 60;
};

export function getAvailableAgendaStartTimes(params: {
  agenda: AgendaConfig;
  appointments: Appointment[];
  services: Service[];
  date: string;
  serviceDuration: number;
  excludeAppointmentId?: string;
  now?: Date;
}): AvailableStartOption[] {
  const { agenda, appointments, services, date, serviceDuration, excludeAppointmentId, now = new Date() } = params;
  if (!date || serviceDuration <= 0) return [];

  const dayOfWeek = new Date(`${date}T00:00:00`).getDay();
  const dayConfig = agenda.days.find(day => day.dayOfWeek === dayOfWeek);
  if (!dayConfig?.isActive) return [];

  const baseSlots = [...agenda.timeSlots]
    .filter(slot => slot.time >= dayConfig.openTime && slot.time < dayConfig.closeTime)
    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

  const baseCapacity = (start: number): number => {
    const slot = [...baseSlots].reverse().find(candidate => timeToMinutes(candidate.time) <= start);
    return slot?.maxCapacity || 1;
  };

  const boundaries = new Set<number>([
    timeToMinutes(dayConfig.openTime),
    timeToMinutes(dayConfig.closeTime),
    ...baseSlots.map(slot => timeToMinutes(slot.time))
  ]);

  if (dayConfig.hasLunchBreak) {
    boundaries.add(timeToMinutes(dayConfig.lunchStart));
    boundaries.add(timeToMinutes(dayConfig.lunchEnd));
  }

  const dayAppointments = appointments.filter(appointment => (
    appointment.dateTime.startsWith(date) &&
    appointment.id !== excludeAppointmentId &&
    appointment.status !== 'cancelado'
  ));

  const appointmentIntervals = dayAppointments.map(appointment => {
    const start = timeToMinutes(appointment.dateTime.split('T')[1] || '00:00');
    const end = start + getAppointmentDuration(appointment, services);
    boundaries.add(start);
    boundaries.add(end);
    return { start, end };
  });

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const minStart = date === todayStr
    ? now.getHours() * 60 + now.getMinutes() + (agenda.minAdvanceHours || 0) * 60
    : 0;

  return [...boundaries]
    .filter(start => {
      const end = start + serviceDuration;
      if (start < timeToMinutes(dayConfig.openTime) || end > timeToMinutes(dayConfig.closeTime)) return false;
      if (start < minStart) return false;
      if (dayConfig.hasLunchBreak && overlaps(start, end, timeToMinutes(dayConfig.lunchStart), timeToMinutes(dayConfig.lunchEnd))) return false;
      const capacity = baseCapacity(start);
      const occupancy = appointmentIntervals.filter(interval => overlaps(start, end, interval.start, interval.end)).length;
      return occupancy < capacity;
    })
    .sort((a, b) => a - b)
    .map(start => ({
      time: minutesToTime(start),
      capacity: baseCapacity(start),
      occupancy: appointmentIntervals.filter(interval => overlaps(start, start + serviceDuration, interval.start, interval.end)).length
    }));
}

export function isAgendaStartTimeAvailable(params: Parameters<typeof getAvailableAgendaStartTimes>[0] & { time: string }): boolean {
  return getAvailableAgendaStartTimes(params).some(option => option.time === params.time);
}
