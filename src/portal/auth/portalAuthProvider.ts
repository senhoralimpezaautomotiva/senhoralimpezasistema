import type { Session } from '@supabase/supabase-js';

export type PortalAuthProviderId = 'email_password' | 'phone_otp';

export interface PortalAuthProvider {
  id: PortalAuthProviderId;
  identifierLabel: string;
  identifierType: 'email' | 'tel';
  identifierAutoComplete: 'email' | 'tel';
  normalizeIdentifier(value: string): string;
  validateIdentifier(value: string): string | null;
  signUp(identifier: string, password: string): Promise<Session | null>;
  signIn(identifier: string, password: string): Promise<Session>;
  requestPasswordRecovery(identifier: string): Promise<void>;
  updatePassword(password: string, options?: { clearForcePasswordChange?: boolean }): Promise<void>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  signOut(): Promise<void>;
}

export const PORTAL_FORCE_PASSWORD_CHANGE_FLAG = 'force_password_change';

export function validatePortalPassword(password: string): string | null {
  if (password.length < 8) return 'A senha deve ter pelo menos 8 caracteres.';
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return 'Use letras maiúsculas, minúsculas e pelo menos um número.';
  }
  return null;
}
