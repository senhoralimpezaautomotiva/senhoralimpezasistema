import { AutomationTrigger } from '../types';

export type QueuedAutomationDecision =
  | { action: 'send' }
  | { action: 'cancel'; reason: 'missing_or_inactive' }
  | { action: 'error'; reason: 'empty_message' };

export const classifyQueuedAutomation = (
  trigger: AutomationTrigger | undefined,
  message: string
): QueuedAutomationDecision => {
  if (!trigger || !trigger.isActive) {
    return { action: 'cancel', reason: 'missing_or_inactive' };
  }
  if (!message.trim()) {
    return { action: 'error', reason: 'empty_message' };
  }
  return { action: 'send' };
};
