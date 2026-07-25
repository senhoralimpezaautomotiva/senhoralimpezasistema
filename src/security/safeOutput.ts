export type SafeLogLevel = 'info' | 'warn' | 'error';
export type SafeLogStatus = 'started' | 'success' | 'ignored' | 'denied' | 'error';

export interface SafeLogDetails {
  correlationId?: string;
  entityId?: string;
  relatedEntityId?: string;
  eventType?: string;
  operation?: string;
  reason?: string;
  phone?: unknown;
  count?: number;
  durationMs?: number;
  statusCode?: number;
  attempt?: number;
  error?: unknown;
}

const MAX_IDENTIFIER_LENGTH = 160;

const safeIdentifier = (value: unknown, fallback = 'unassigned'): string => {
  if (typeof value !== 'string') return fallback;
  const normalized = value
    .slice(0, MAX_IDENTIFIER_LENGTH)
    .replace(/[^A-Za-z0-9_.:/-]/g, '_');
  return normalized || fallback;
};

export const createCorrelationId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `corr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

export const maskPhone = (value: unknown): string => {
  const digits = typeof value === 'string' ? value.replace(/\D/g, '') : '';
  if (digits.length < 4) return '***';
  return `***${digits.slice(-4)}`;
};

export const getSafeErrorCode = (error: unknown): string => {
  if (error && typeof error === 'object') {
    const candidate = (error as { code?: unknown }).code;
    if (typeof candidate === 'string' && /^[A-Za-z0-9_.-]{1,64}$/.test(candidate)) {
      return candidate;
    }
    const name = (error as { name?: unknown }).name;
    if (typeof name === 'string' && /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(name)) {
      return name.toUpperCase();
    }
  }
  return 'UNEXPECTED_ERROR';
};

export const buildSafeLogEntry = (
  level: SafeLogLevel,
  event: string,
  status: SafeLogStatus,
  details: SafeLogDetails = {}
): Record<string, string | number> => {
  const entry: Record<string, string | number> = {
    type: 'application_event',
    timestamp: new Date().toISOString(),
    correlationId: safeIdentifier(details.correlationId || createCorrelationId()),
    level,
    event: safeIdentifier(event, 'application.unknown'),
    status
  };

  if (details.entityId) entry.entityId = safeIdentifier(details.entityId);
  if (details.relatedEntityId) {
    entry.relatedEntityId = safeIdentifier(details.relatedEntityId);
  }
  if (details.eventType) entry.eventType = safeIdentifier(details.eventType);
  if (details.operation) entry.operation = safeIdentifier(details.operation);
  if (details.reason) entry.reason = safeIdentifier(details.reason);
  if (details.phone !== undefined) entry.maskedPhone = maskPhone(details.phone);
  if (Number.isFinite(details.count)) entry.count = Number(details.count);
  if (Number.isFinite(details.durationMs)) entry.durationMs = Number(details.durationMs);
  if (Number.isFinite(details.statusCode)) entry.statusCode = Number(details.statusCode);
  if (Number.isFinite(details.attempt)) entry.attempt = Number(details.attempt);
  if (details.error !== undefined) entry.errorCode = getSafeErrorCode(details.error);

  return entry;
};

export const safeLog = (
  level: SafeLogLevel,
  event: string,
  status: SafeLogStatus,
  details: SafeLogDetails = {}
): void => {
  const serialized = JSON.stringify(buildSafeLogEntry(level, event, status, details));
  if (level === 'error') {
    console.error(serialized);
    return;
  }
  if (level === 'warn') {
    console.warn(serialized);
    return;
  }
  console.info(serialized);
};

export const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const setSafeText = (
  target: { textContent: string | null },
  value: unknown
): void => {
  target.textContent = String(value ?? '');
};

export const neutralizeCsvFormula = (value: unknown): string => {
  const text = String(value ?? '');
  return /^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text;
};

export const toCsvCell = (value: unknown): string =>
  `"${neutralizeCsvFormula(value).replace(/"/g, '""')}"`;

export const redactExternalResponse = (value: unknown): string => {
  const response = typeof value === 'string' ? value : '';
  if (/nenhum provedor configurado/i.test(response)) {
    return 'Envio simulado: nenhum provedor configurado';
  }

  const statuses = Array.from(response.matchAll(/Status HTTP:\s*(\d{3})/gi))
    .map(match => Number(match[1]))
    .filter(status => status >= 100 && status <= 599);
  if (statuses.length > 0) {
    return statuses.map(status => `Provedor externo: HTTP ${status}`).join('\n');
  }
  if (/falha de comunica[cç][aã]o/i.test(response)) {
    return 'Provedor externo: falha de comunicação';
  }
  return response ? 'Resposta externa redigida' : '';
};
