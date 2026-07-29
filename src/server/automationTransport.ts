import {
  getIntegrationSecrets,
  hasZapiCredentials,
  PrivateIntegrationConfig
} from './integrationSecrets';
import { safeLog } from '../security/safeOutput';

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
  provider: 'make' | 'zapi' | 'simulated';
}

interface AutomationTransportDependencies {
  secrets?: PrivateIntegrationConfig;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const PROVIDER_REQUEST_TIMEOUT_MS = 30_000;

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
    safeLog('info', 'automation.trace.5.confirmation', response.ok ? 'success' : 'error', {
      operation: 'Z-API',
      statusCode: response.status,
      entityId: payload.executionId
    });
    return {
      success: response.ok,
      apiResponse: `[Z-API] Status HTTP: ${response.status}`,
      provider: 'zapi'
    };
  } catch {
    return {
      success: false,
      apiResponse: '[Z-API] Falha de comunicação com o provedor',
      provider: 'zapi'
    };
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
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs)
      });
      safeLog('info', 'automation.trace.5.confirmation', response.ok ? 'success' : 'error', {
        operation: 'Make',
        statusCode: response.status,
        entityId: payload.executionId
      });

      if (response.ok) {
        return {
          success: true,
          apiResponse: `[Make Webhook] Status HTTP: ${response.status}`,
          provider: 'make'
        };
      }
      const makeEndpointUnavailable = response.status === 404 || response.status === 410;
      if (makeEndpointUnavailable && hasZapiCredentials(secrets)) {
        return sendToZapi(payload, secrets, fetchImpl, timeoutMs, `make_http_${response.status}`);
      }
      return {
        success: false,
        apiResponse: `[Make Webhook] Status HTTP: ${response.status}`,
        provider: 'make'
      };
    } catch {
      // Falha de comunicação é ambígua: o Make pode ter aceitado a requisição
      // antes da conexão cair. Não há fallback para evitar envio duplicado.
      return {
        success: false,
        apiResponse: '[Make Webhook] Falha de comunicação com o provedor',
        provider: 'make'
      };
    }
  }

  if (hasZapiCredentials(secrets)) {
    return sendToZapi(payload, secrets, fetchImpl, timeoutMs);
  }

  safeLog('info', 'automation.trace.3_4.unconfigured', 'success', {
    entityId: payload.executionId,
    phone: payload.phone
  });
  return {
    success: true,
    apiResponse: 'Envio simulado: nenhum provedor configurado no ambiente do servidor',
    provider: 'simulated'
  };
};
