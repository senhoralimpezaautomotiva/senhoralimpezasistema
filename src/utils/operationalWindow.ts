/**
 * Utilitário de janela operacional e fuso horário America/Sao_Paulo.
 * Evita dependências circulares entre localDb e automationEngine.
 */

export const AUTOMATION_TIME_ZONE = 'America/Sao_Paulo';

export function getPartsInTimezone(date = new Date(), timeZone = AUTOMATION_TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '00';
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hours: get('hour'),
    minutes: get('minute'),
    seconds: get('second')
  };
}

export function isWithinOperationalWindow(
  startHour: string,
  endHour: string,
  date = new Date(),
  timeZone = AUTOMATION_TIME_ZONE
): boolean {
  const parts = getPartsInTimezone(date, timeZone);
  const currentTime = `${parts.hours.padStart(2, '0')}:${parts.minutes.padStart(2, '0')}`;

  if (startHour <= endHour) {
    return currentTime >= startHour && currentTime <= endHour;
  } else {
    return currentTime >= startHour || currentTime <= endHour;
  }
}

export function getNextStartTime(
  startHour: string,
  endHour: string = '20:00',
  date = new Date(),
  timeZone = AUTOMATION_TIME_ZONE
): string {
  const parts = getPartsInTimezone(date, timeZone);
  const currentTime = `${parts.hours.padStart(2, '0')}:${parts.minutes.padStart(2, '0')}`;

  let isNextDay = false;
  if (startHour <= endHour) {
    if (currentTime > endHour) {
      isNextDay = true;
    }
  } else {
    isNextDay = false;
  }

  const baseUtc = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), 12, 0, 0));
  if (isNextDay) {
    baseUtc.setUTCDate(baseUtc.getUTCDate() + 1);
  }

  const targetParts = getPartsInTimezone(baseUtc, timeZone);
  const [sh, sm] = startHour.split(':').map(v => v.padStart(2, '0'));

  const localIsoStr = `${targetParts.year}-${targetParts.month.padStart(2, '0')}-${targetParts.day.padStart(2, '0')}T${sh}:${sm || '00'}:00-03:00`;
  return new Date(localIsoStr).toISOString();
}

/**
 * Converte o valor sem fuso salvo por `datetime-local` em um instante real.
 * Valores que já possuem `Z` ou offset explícito são preservados.
 */
export function parseAppointmentDateTime(
  value: string,
  timeZone = AUTOMATION_TIME_ZONE
): Date {
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(value)) {
    return new Date(value);
  }

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/
  );
  if (!match) return new Date(Number.NaN);

  const [, year, month, day, hour, minute, second = '00'] = match;
  const desiredWallTimeUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );
  let instant = desiredWallTimeUtc;

  // Duas iterações também cobrem transições de horário de verão em fusos que
  // ainda as utilizem, sem assumir um offset fixo para São Paulo.
  for (let attempt = 0; attempt < 2; attempt++) {
    const parts = getPartsInTimezone(new Date(instant), timeZone);
    const renderedWallTimeUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hours),
      Number(parts.minutes),
      Number(parts.seconds)
    );
    instant += desiredWallTimeUtc - renderedWallTimeUtc;
  }

  return new Date(instant);
}

export function isWithinReminderWindow(
  appointmentDateTime: string,
  now = new Date(),
  advanceHours = 1,
  timeZone = AUTOMATION_TIME_ZONE
): boolean {
  if (!Number.isInteger(advanceHours) || advanceHours < 1 || advanceHours > 168) {
    return false;
  }
  const appointment = parseAppointmentDateTime(appointmentDateTime, timeZone);
  if (Number.isNaN(appointment.getTime())) return false;

  const differenceMs = appointment.getTime() - now.getTime();
  return differenceMs > 0 && differenceMs <= advanceHours * 60 * 60 * 1000;
}
