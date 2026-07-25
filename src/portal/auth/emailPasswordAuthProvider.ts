import type { Session } from '@supabase/supabase-js';
import { getPortalSupabaseClient } from '../portalSupabase';
import {
  validatePortalPassword,
  type PortalAuthProvider
} from './portalAuthProvider';

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const validateEmail = (value: string): string | null => {
  const email = normalizeEmail(value);
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Informe um e-mail válido.';
  }
  return null;
};

const portalRedirectUrl = (recovery = false): string => {
  if (typeof window === 'undefined') return '';
  const url = new URL('/', window.location.origin);
  url.searchParams.set('portal', 'true');
  if (recovery) {
    url.searchParams.set('recovery', 'true');
  } else {
    url.searchParams.delete('recovery');
  }
  return url.toString();
};

const assertNoError = (error: { message?: string } | null, fallback: string): void => {
  if (error) throw new Error(error.message || fallback);
};

export const emailPasswordAuthProvider: PortalAuthProvider = {
  id: 'email_password',
  identifierLabel: 'E-mail',
  identifierType: 'email',
  identifierAutoComplete: 'email',
  normalizeIdentifier: normalizeEmail,
  validateIdentifier: validateEmail,

  async signUp(identifier: string, password: string): Promise<Session | null> {
    const email = normalizeEmail(identifier);
    const emailError = validateEmail(email);
    if (emailError) throw new Error(emailError);
    const passwordError = validatePortalPassword(password);
    if (passwordError) throw new Error(passwordError);

    const { data, error } = await getPortalSupabaseClient().auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: portalRedirectUrl(false)
      }
    });
    assertNoError(error, 'Não foi possível criar a conta.');
    return data.session;
  },

  async signIn(identifier: string, password: string): Promise<Session> {
    const email = normalizeEmail(identifier);
    const emailError = validateEmail(email);
    if (emailError) throw new Error(emailError);

    const { data, error } = await getPortalSupabaseClient().auth.signInWithPassword({
      email,
      password
    });
    assertNoError(error, 'Não foi possível entrar.');
    if (!data.session) throw new Error('Sessão não criada.');
    return data.session;
  },

  async requestPasswordRecovery(identifier: string): Promise<void> {
    const email = normalizeEmail(identifier);
    const emailError = validateEmail(email);
    if (emailError) throw new Error(emailError);

    const { error } = await getPortalSupabaseClient().auth.resetPasswordForEmail(
      email,
      { redirectTo: portalRedirectUrl(true) }
    );
    assertNoError(error, 'Não foi possível enviar o e-mail de recuperação.');
  },

  async updatePassword(password: string): Promise<void> {
    const passwordError = validatePortalPassword(password);
    if (passwordError) throw new Error(passwordError);
    const { error } = await getPortalSupabaseClient().auth.updateUser({ password });
    assertNoError(error, 'Não foi possível atualizar a senha.');
  },

  async signOut(): Promise<void> {
    const { error } = await getPortalSupabaseClient().auth.signOut();
    assertNoError(error, 'Não foi possível encerrar a sessão.');
  }
};

// Ponto único de seleção. Um futuro adapter phoneOtpAuthProvider implementará
// o mesmo contrato sem alterar o PortalAuthGate nem o repositório de dados.
export const activePortalAuthProvider: PortalAuthProvider =
  emailPasswordAuthProvider;
