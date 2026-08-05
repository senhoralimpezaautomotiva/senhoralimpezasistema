import { getPartsInTimezone } from '../utils/operationalWindow';

const AUTOMATION_TIME_ZONE = 'America/Sao_Paulo';

type BirthdayDate = {
  year: number;
  month: number;
  day: number;
};

export type BirthdayEligibility =
  | {
      eligible: true;
      reason: 'eligible';
      deduplicationKey: string;
      referenceYear: string;
    }
  | {
      eligible: false;
      reason: 'missing_birth_date' | 'invalid_birth_date' | 'not_birthday_today';
    };

export type BirthdayExecutionDecision = {
  action: 'send' | 'retry' | 'cancel';
  reason:
    | 'eligible'
    | 'customer_load_failed'
    | 'customer_missing'
    | 'missing_birth_date'
    | 'invalid_birth_date'
    | 'not_birthday_today'
    | 'deduplication_key_mismatch';
};

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return days[month - 1] || 0;
}

export function parseBirthdayDate(value?: string | null): BirthdayDate | null {
  if (!value) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return null;
  }

  return { year, month, day };
}

export function buildBirthdayDeduplicationKey(
  customerId?: string,
  referenceDate = new Date()
): string | undefined {
  if (!customerId) return undefined;
  const { year } = getPartsInTimezone(referenceDate, AUTOMATION_TIME_ZONE);
  return `aniversario:${customerId}:${year}`;
}

export function evaluateBirthday(input: {
  customerId: string;
  birthDate?: string | null;
  now?: Date;
}): BirthdayEligibility {
  if (!input.birthDate) {
    return { eligible: false, reason: 'missing_birth_date' };
  }

  const birthday = parseBirthdayDate(input.birthDate);
  if (!birthday) {
    return { eligible: false, reason: 'invalid_birth_date' };
  }

  const now = input.now || new Date();
  const current = getPartsInTimezone(now, AUTOMATION_TIME_ZONE);
  const currentDateNumber = Number(`${current.year}${current.month}${current.day}`);
  const birthdayDateNumber = Number(
    `${String(birthday.year).padStart(4, '0')}${String(birthday.month).padStart(2, '0')}${String(birthday.day).padStart(2, '0')}`
  );
  if (birthdayDateNumber > currentDateNumber) {
    return { eligible: false, reason: 'invalid_birth_date' };
  }
  if (birthday.month !== Number(current.month) || birthday.day !== Number(current.day)) {
    return { eligible: false, reason: 'not_birthday_today' };
  }

  return {
    eligible: true,
    reason: 'eligible',
    deduplicationKey: `aniversario:${input.customerId}:${current.year}`,
    referenceYear: current.year
  };
}

export function evaluateBirthdayExecution(input: {
  customerLoadFailed?: boolean;
  customerFound?: boolean;
  customerId: string;
  birthDate?: string | null;
  executionDeduplicationKey?: string;
  now?: Date;
}): BirthdayExecutionDecision {
  if (input.customerLoadFailed) {
    return { action: 'retry', reason: 'customer_load_failed' };
  }
  if (!input.customerFound) {
    return { action: 'cancel', reason: 'customer_missing' };
  }

  const eligibility = evaluateBirthday({
    customerId: input.customerId,
    birthDate: input.birthDate,
    now: input.now
  });
  if (!eligibility.eligible) {
    return { action: 'cancel', reason: eligibility.reason };
  }
  if (input.executionDeduplicationKey !== eligibility.deduplicationKey) {
    return { action: 'cancel', reason: 'deduplication_key_mismatch' };
  }

  return { action: 'send', reason: 'eligible' };
}
