import {
  getIntegrationSecrets,
  hasZapiCredentials,
  PrivateIntegrationConfig
} from './integrationSecrets';
import { safeLog } from '../security/safeOutput';
import {
  AutomationProvider,
  AutomationProviderOutcome,
  classifyProviderHttpResponse,
  describeProviderOutcome,
  parseRetryAfterSeconds
} from '../db/automationProviderPolicy';

export interface AutomationTransportPayload {
  executionId: string;
  event: string;
  appointmentId: string | null;
  companyId: string;
  phone: string;
  message: string;
  customer: {
    id: string;
    name: string;
    phone: string;
  };
}

export interface AutomationTransportResult {
  success: boolean;
  apiResponse: string;
  provider: AutomationProvider;
  outcome: AutomationProviderOutcome;
  confirmation: 'make_queued' | 'zapi_queued' | 'none';
  statusCode?: number;
  retryAfterSeconds?: number;
}

interface AutomationTransportDependencies {
  secrets?: PrivateIntegrationConfig;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const PROVIDER_REQUEST_TIMEOUT_MS = 30_000;
const MAX_PROVIDER_RESPONSE_BYTES = 4_096;

const buildTransportResult = (input: {
  provider: AutomationProvider;
  outcome: AutomationProviderOutcome;
  confirmation?: AutomationTransportResult['confirmation'];
  statusCode?: number;
  retryAfterSeconds?: number;
}): AutomationTransportResult => ({
  success: input.outcome === 'accepted',
  apiResponse: describeProviderOutcome(input),
  provider: input.provider,
  outcome: input.outcome,
  confirmation: input.confirmation || 'none',
  statusCode: input.statusCode,
  retryAfterSeconds: input.retryAfterSeconds
});

const readBoundedResponseText = async (
  response: Response,
  maxBytes = MAX_PROVIDER_RESPONSE_BYTES
): Promise<string | null> => {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) return null;
  if (!response.body) return '';

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
};

const hasZapiMessageIdentifier = async (response: Response): Promise<boolean> => {
  try {
    const responseText = await readBoundedResponseText(response);
    if (responseText === null) return false;
    const body = JSON.parse(responseText) as Record<string, unknown>;
    return typeof body.messageId === 'string' && body.messageId.trim().length > 0;
  } catch {
    return false;
  }
};

const sendToZapi = async (
  payload: AutomationTransportPayload,
  secrets: PrivateIntegrationConfig,
  fetchImpl: typeof fetch,
  timeoutMs: number,
  fallbackReason?: string
): Promise<AutomationTransportResult> => {
  const zapiUrl = `https://api.z-api.io/instances/${encodeURIComponent(secrets.zapiInstanceId)}/token/${encodeURIComponent(secrets.zapiToken)}/send-text`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secrets.zapiClientToken) headers['Client-Token'] = secrets.zapiClientToken;

  safeLog('info', 'automation.provider.selected', 'success', {
    entityId: payload.executionId,
    operation: 'Z-API',
    reason: fallbackReason || 'make_unconfigured'
  });
  safeLog('info', 'automation.trace.4.zapi_send', 'success', {
    entityId: payload.executionId,
    phone: payload.phone
  });

  try {
    const response = await fetchImpl(zapiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ phone: payload.phone, message: payload.message }),
      signal: AbortSignal.timeout(timeoutMs)
    });
    let outcome = classifyProviderHttpResponse('zapi', response.status);
    if (outcome === 'accepted' && !await hasZapiMessageIdentifier(response)) {
      outcome = 'ambiguous_failure';
    }
    safeLog('info', 'automation.trace.5.confirmation', outcome === 'accepted' ? 'success' : 'error', {
      operation: 'Z-API',
      statusCode: response.status,
      entityId: payload.executionId
    });
    return buildTransportResult({
      provider: 'zapi',
      outcome,
      confirmation: outcome === 'accepted' ? 'zapi_queued' : 'none',
      statusCode: response.status,
      retryAfterSeconds: parseRetryAfterSeconds(response.headers.get('retry-after'))
    });
  } catch {
    return buildTransportResult({ provider: 'zapi', outcome: 'ambiguous_failure' });
  }
};

export const sendAutomationPayload = async (
  payload: AutomationTransportPayload,
  dependencies: AutomationTransportDependencies = {}
): Promise<AutomationTransportResult> => {
  const secrets = dependencies.secrets || getIntegrationSecrets();
  const fetchImpl = dependencies.fetchImpl || fetch;
  const timeoutMs = dependencies.timeoutMs || PROVIDER_REQUEST_TIMEOUT_MS;

  if (secrets.makeWebhookUrl) {
    safeLog('info', 'automation.provider.selected', 'success', {
      entityId: payload.executionId,
      operation: 'Make',
      reason: 'primary_provider'
    });
    safeLog('info', 'automation.trace.3.make_before_send', 'success', {
      entityId: payload.executionId,
      eventType: payload.event
    });

    try {
      const response = await fetchImpl(secrets.makeWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          // Aliases temporários preservados para o cenário Make já publicado.
          telefone: payload.phone,
          formattedMessage: payload.message
        }),
        signal: AbortSignal.timeout(timeoutMs)
      });
      safeLog('info', 'automation.trace.5.confirmation', response.ok ? 'success' : 'error', {
        operation: 'Make',
        statusCode: response.status,
        entityId: payload.executionId
      });

      if (response.ok) {
        return buildTransportResult({
          provider: 'make',
          outcome: 'accepted',
          confirmation: 'make_queued',
          statusCode: response.status
        });
      }
      const makeEndpointUnavailable = response.status === 404 || response.status === 410;
      if (makeEndpointUnavailable && hasZapiCredentials(secrets)) {
        return sendToZapi(payload, secrets, fetchImpl, timeoutMs, `make_http_${response.status}`);
      }
      const makeErrorBody = response.status === 400
        ? await readBoundedResponseText(response, 128)
        : null;
      const makeQueueFull = makeErrorBody?.trim().toLowerCase() === 'queue is full';
      return buildTransportResult({
        provider: 'make',
        outcome: makeQueueFull
          ? 'retryable_failure'
          : classifyProviderHttpResponse('make', response.status),
        statusCode: response.status,
        retryAfterSeconds: parseRetryAfterSeconds(response.headers.get('retry-after'))
      });
    } catch {
      // Falha de comunicação é ambígua: o Make pode ter aceitado a requisição
      // antes da conexão cair. Não há fallback para evitar envio duplicado.
      return buildTransportResult({ provider: 'make', outcome: 'ambiguous_failure' });
    }
  }

  if (hasZapiCredentials(secrets)) {
    return sendToZapi(payload, secrets, fetchImpl, timeoutMs);
  }

  safeLog('error', 'automation.trace.3_4.unconfigured', 'error', {
    entityId: payload.executionId,
    phone: payload.phone
  });
  return buildTransportResult({
    provider: 'unconfigured',
    outcome: 'permanent_failure'
  });
};
