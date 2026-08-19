import type {
  AgendaConfig,
  AgendaDayConfig,
  AgendaTimeSlot,
  PublicSystemConfig
} from '../types';

export const PUBLIC_SYSTEM_CONFIG_KEYS = [
  'companyName',
  'phone',
  'email',
  'cnpj',
  'address',
  'hoursOfOperation',
  'logoUrl',
  'primaryColor',
  'accentColor',
  'supabaseUrl',
  'supabaseAnonKey',
  'useRealSupabase',
  'automationStartHour',
  'automationEndHour',
  'automation24Hours',
  'instagramUrl',
  'googleMapsUrl',
  'agenda',
  'theme'
] as const satisfies readonly (keyof PublicSystemConfig)[];

export const LEGACY_PRIVATE_CONFIG_KEYS = [
  'zapiInstanceId',
  'zapiToken',
  'zapiClientToken',
  'makeWebhookUrl'
] as const;

interface BrowserStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const sanitizeAgendaDay = (value: unknown): AgendaDayConfig | null => {
  if (!isRecord(value)) return null;
  const {
    dayOfWeek,
    dayName,
    isActive,
    openTime,
    closeTime,
    hasLunchBreak,
    lunchStart,
    lunchEnd
  } = value;
  if (
    typeof dayOfWeek !== 'number' ||
    typeof dayName !== 'string' ||
    typeof isActive !== 'boolean' ||
    typeof openTime !== 'string' ||
    typeof closeTime !== 'string' ||
    typeof hasLunchBreak !== 'boolean' ||
    typeof lunchStart !== 'string' ||
    typeof lunchEnd !== 'string'
  ) {
    return null;
  }
  return {
    dayOfWeek,
    dayName,
    isActive,
    openTime,
    closeTime,
    hasLunchBreak,
    lunchStart,
    lunchEnd
  };
};

const sanitizeTimeSlot = (value: unknown): AgendaTimeSlot | null => {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== 'string' ||
    typeof value.time !== 'string' ||
    typeof value.maxCapacity !== 'number'
  ) {
    return null;
  }
  return {
    id: value.id,
    time: value.time,
    maxCapacity: value.maxCapacity
  };
};

const sanitizeAgenda = (value: unknown): AgendaConfig | undefined => {
  if (!isRecord(value) || !Array.isArray(value.days) || !Array.isArray(value.timeSlots)) {
    return undefined;
  }
  if (
    typeof value.minAdvanceHours !== 'number' ||
    typeof value.maxAdvanceDays !== 'number' ||
    typeof value.autoBlockDuration !== 'boolean'
  ) {
    return undefined;
  }

  const days = value.days.map(sanitizeAgendaDay).filter((day): day is AgendaDayConfig => Boolean(day));
  const timeSlots = value.timeSlots.map(sanitizeTimeSlot).filter((slot): slot is AgendaTimeSlot => Boolean(slot));
  return {
    days,
    timeSlots,
    minAdvanceHours: value.minAdvanceHours,
    maxAdvanceDays: value.maxAdvanceDays,
    autoBlockDuration: value.autoBlockDuration
  };
};

export const toPublicSystemConfig = (value: unknown): Partial<PublicSystemConfig> => {
  if (!isRecord(value)) return {};
  const result: Partial<PublicSystemConfig> = {};

  const stringKeys = [
    'companyName',
    'phone',
    'email',
    'cnpj',
    'address',
    'hoursOfOperation',
    'logoUrl',
    'primaryColor',
    'accentColor',
    'supabaseUrl',
    'supabaseAnonKey',
    'instagramUrl',
    'googleMapsUrl',
    'automationStartHour',
    'automationEndHour'
  ] as const;
  for (const key of stringKeys) {
    if (typeof value[key] === 'string') result[key] = value[key];
  }

  if (typeof value.useRealSupabase === 'boolean') result.useRealSupabase = value.useRealSupabase;
  if (value.theme === 'light' || value.theme === 'dark') result.theme = value.theme;

  const agenda = sanitizeAgenda(value.agenda);
  if (agenda) result.agenda = agenda;

  return result;
};

export const sanitizeLegacyConfigStorage = (
  storage: BrowserStorageLike,
  preservePublicCache: boolean
): void => {
  try {
    const mergedConfig: Record<string, unknown> = {};
    for (const key of ['sl_config_cache', 'sl_config']) {
      const rawValue = storage.getItem(key);
      if (!rawValue) continue;
      try {
        Object.assign(mergedConfig, toPublicSystemConfig(JSON.parse(rawValue)));
      } catch {
        // Invalid legacy data is discarded.
      }
    }

    if (preservePublicCache && Object.keys(mergedConfig).length > 0) {
      storage.setItem('sl_config_cache', JSON.stringify(mergedConfig));
    } else {
      storage.removeItem('sl_config_cache');
    }

    storage.removeItem('sl_config');
    storage.removeItem('sl_admin_password');
    storage.removeItem('sl_logs');
    storage.removeItem('sl_executions');
  } catch {
    // Storage can be unavailable in privacy mode; the in-memory public config remains safe.
  }
};
