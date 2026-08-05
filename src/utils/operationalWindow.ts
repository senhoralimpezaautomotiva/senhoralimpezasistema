/**
 * Utilitário de janela operacional e fuso horário America/Sao_Paulo.
 * Evita dependências circulares entre localDb e automationEngine.
 */

export function getPartsInTimezone(date = new Date(), timeZone = 'America/Sao_Paulo') {
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
  timeZone = 'America/Sao_Paulo'
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
  timeZone = 'America/Sao_Paulo'
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
