export type AutomationProvider = 'make' | 'zapi' | 'unconfigured';

export type AutomationProviderOutcome =
  | 'accepted'
  | 'retryable_failure'
  | 'permanent_failure'
  | 'ambiguous_failure';

export type ProviderExecutionDecision =
  | { action: 'accepted'; reason: 'provider_accepted' }
  | { action: 'retry'; reason: 'retryable_failure'; delaySeconds: number }
  | {
      action: 'stop';
      reason: 'permanent_failure' | 'ambiguous_failure' | 'retry_exhausted';
    };

const MAX_RETRY_AFTER_SECONDS = 60 * 60;

export function parseRetryAfterSeconds(
  value: string | null,
  now = new Date()
): number | undefined {
  if (!value) return undefined;

  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 0) {
    return Math.min(Math.ceil(numeric), MAX_RETRY_AFTER_SECONDS);
  }

  const retryDate = new Date(value);
  if (Number.isNaN(retryDate.getTime())) return undefined;
  return Math.min(
    Math.max(0, Math.ceil((retryDate.getTime() - now.getTime()) / 1000)),
    MAX_RETRY_AFTER_SECONDS
  );
}

export function classifyProviderHttpResponse(
  provider: Exclude<AutomationProvider, 'unconfigured'>,
  statusCode: number
): AutomationProviderOutcome {
  if (statusCode >= 200 && statusCode < 300) return 'accepted';

  if (provider === 'make' && statusCode === 429) {
    return 'retryable_failure';
  }
  if (provider === 'zapi' && statusCode === 429) {
    return 'retryable_failure';
  }
  if (statusCode === 408 || statusCode >= 500) {
    return 'ambiguous_failure';
  }
  return 'permanent_failure';
}

export function decideProviderExecution(input: {
  outcome: AutomationProviderOutcome;
  attempts: number;
  retryAfterSeconds?: number;
}): ProviderExecutionDecision {
  if (input.outcome === 'accepted') {
    return { action: 'accepted', reason: 'provider_accepted' };
  }
  if (input.outcome === 'ambiguous_failure') {
    return { action: 'stop', reason: 'ambiguous_failure' };
  }
  if (input.outcome === 'permanent_failure') {
    return { action: 'stop', reason: 'permanent_failure' };
  }
  if (input.attempts >= 3) {
    return { action: 'stop', reason: 'retry_exhausted' };
  }

  const defaultDelaySeconds = input.attempts <= 1 ? 5 * 60 : 15 * 60;
  return {
    action: 'retry',
    reason: 'retryable_failure',
    delaySeconds: input.retryAfterSeconds === undefined
      ? defaultDelaySeconds
      : Math.max(1, Math.min(input.retryAfterSeconds, MAX_RETRY_AFTER_SECONDS))
  };
}

export function describeProviderOutcome(input: {
  provider: AutomationProvider;
  outcome: AutomationProviderOutcome;
  statusCode?: number;
  confirmation?: 'make_queued' | 'zapi_queued' | 'none';
}): string {
  const providerName = input.provider === 'make'
    ? 'Make'
    : input.provider === 'zapi'
      ? 'Z-API'
      : 'não configurado';
  const http = input.statusCode ? ` HTTP ${input.statusCode}.` : '';

  if (input.outcome === 'accepted') {
    const acceptance = input.confirmation === 'make_queued'
      ? 'webhook aceito na fila do Make'
      : 'mensagem aceita na fila da Z-API';
    return `Provedor ${providerName}: ${acceptance}; entrega ainda não confirmada.${http}`;
  }
  if (input.outcome === 'retryable_failure') {
    return `Provedor ${providerName}: requisição rejeitada antes da aceitação; nova tentativa permitida.${http}`;
  }
  if (input.outcome === 'ambiguous_failure') {
    return `Provedor ${providerName}: resultado ambíguo; repetição automática bloqueada para evitar duplicidade.${http}`;
  }
  return `Provedor ${providerName}: configuração ausente ou requisição rejeitada definitivamente.${http}`;
}
