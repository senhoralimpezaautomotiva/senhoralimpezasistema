import { AutomationExecution } from '../types';

export type AutomationOperationalStatus = 'healthy' | 'attention' | 'critical';

export type AutomationExecutionOperationalState =
  | 'accepted'
  | 'scheduled'
  | 'retry_scheduled'
  | 'stalled'
  | 'active_claim'
  | 'abandoned_claim'
  | 'ambiguous'
  | 'permanent_error'
  | 'cancelled';

export interface AutomationOperationalSummary {
  operationalStatus: AutomationOperationalStatus;
  stalledPendingCount: number;
  activeClaimCount: number;
  abandonedClaimCount: number;
  ambiguousCount: number;
  retryScheduledCount: number;
  reconciliationRequiredCount: number;
}

const STALLED_QUEUE_AFTER_MS = 5 * 60 * 1000;
const LEGACY_CLAIM_ABANDONED_AFTER_MS = 15 * 60 * 1000;

const timestamp = (value?: string): number | undefined => {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const isAmbiguousResponse = (response?: string): boolean =>
  /resultado ambíguo|claim abandonado|reconciliação necessária|persistência (?:no banco )?não confirmada/i
    .test(response || '');

const isAbandonedClaim = (execution: AutomationExecution, nowMs: number): boolean => {
  if (execution.status !== 'processando') return false;
  const expiresAt = timestamp(execution.claim_expires_at);
  if (expiresAt !== undefined) return expiresAt <= nowMs;
  const updatedAt = timestamp(execution.updated_at);
  return updatedAt === undefined || updatedAt <= nowMs - LEGACY_CLAIM_ABANDONED_AFTER_MS;
};

export const classifyAutomationExecutionOperationalState = (
  execution: AutomationExecution,
  now = new Date()
): AutomationExecutionOperationalState => {
  const nowMs = now.getTime();

  if (isAbandonedClaim(execution, nowMs)) return 'abandoned_claim';
  if (execution.status === 'processando') return 'active_claim';
  if (isAmbiguousResponse(execution.resposta_api)) return 'ambiguous';
  if (execution.status === 'erro_definitivo') return 'permanent_error';
  if (execution.status === 'cancelada') return 'cancelled';
  if (execution.status === 'sucesso') return 'accepted';

  const executionAt = timestamp(execution.data_execucao);
  if (executionAt === undefined || executionAt <= nowMs - STALLED_QUEUE_AFTER_MS) {
    return 'stalled';
  }
  const retryAt = timestamp(execution.data_proxima_tentativa);
  return retryAt !== undefined ? 'retry_scheduled' : 'scheduled';
};

export const summarizeAutomationOperations = (
  executions: AutomationExecution[],
  now = new Date()
): AutomationOperationalSummary => {
  const states = executions.map(execution =>
    classifyAutomationExecutionOperationalState(execution, now)
  );
  const count = (state: AutomationExecutionOperationalState): number =>
    states.filter(item => item === state).length;

  const stalledPendingCount = count('stalled');
  const abandonedClaimCount = count('abandoned_claim');
  const ambiguousCount = count('ambiguous');
  const reconciliationRequiredCount = abandonedClaimCount + ambiguousCount;
  const operationalStatus: AutomationOperationalStatus =
    stalledPendingCount > 0 || abandonedClaimCount > 0
      ? 'critical'
      : ambiguousCount > 0 || count('permanent_error') > 0
        ? 'attention'
        : 'healthy';

  return {
    operationalStatus,
    stalledPendingCount,
    activeClaimCount: count('active_claim'),
    abandonedClaimCount,
    ambiguousCount,
    retryScheduledCount: count('retry_scheduled'),
    reconciliationRequiredCount
  };
};
