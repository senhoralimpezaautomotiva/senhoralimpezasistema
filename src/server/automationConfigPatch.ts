import { AutomationTrigger } from '../types';

export type AutomationConfigPatch = Pick<
  AutomationTrigger,
  'isActive' | 'template' | 'inactiveDays' | 'minServices'
>;

export const sanitizeAutomationConfigPatch = (
  input: unknown
): Partial<AutomationConfigPatch> | null => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const source = input as Record<string, unknown>;
  const allowedKeys = new Set(['isActive', 'template', 'inactiveDays', 'minServices']);
  if (Object.keys(source).some(key => !allowedKeys.has(key))) return null;

  const patch: Partial<AutomationConfigPatch> = {};
  if ('isActive' in source) {
    if (typeof source.isActive !== 'boolean') return null;
    patch.isActive = source.isActive;
  }
  if ('template' in source) {
    if (
      typeof source.template !== 'string'
      || source.template.trim().length === 0
      || source.template.trim().length > 2000
    ) return null;
    patch.template = source.template.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  }
  for (const field of ['inactiveDays', 'minServices'] as const) {
    if (field in source) {
      const value = source[field];
      if (
        typeof value !== 'number'
        || !Number.isInteger(value)
        || value < (field === 'inactiveDays' ? 1 : 0)
      ) return null;
      patch[field] = value;
    }
  }
  return Object.keys(patch).length > 0 ? patch : null;
};

export const applyAutomationConfigPatch = (
  automations: AutomationTrigger[],
  id: string,
  patch: Partial<AutomationConfigPatch>
): AutomationTrigger[] | null => {
  const index = automations.findIndex(item => item.id === id);
  if (index < 0) return null;
  return automations.map((item, itemIndex) =>
    itemIndex === index ? { ...item, ...patch } : { ...item }
  );
};
