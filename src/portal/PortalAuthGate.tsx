import React, { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  AlertCircle,
  ChevronLeft,
  LockKeyhole,
  Mail,
  ShieldCheck
} from 'lucide-react';
import { safeLog } from '../security/safeOutput';
import { activePortalAuthProvider } from './auth/emailPasswordAuthProvider';
import {
  claimExistingPortalCustomer,
  getPortalSupabaseClient,
  loadPortalData,
  type PortalData
} from './portalSupabase';

type AuthMode =
  | 'login'
  | 'signup'
  | 'recovery'
  | 'confirmation-sent'
  | 'recovery-sent'
  | 'new-password';

interface PortalAuthGateProps {
  onBackToAdmin?: () => void;
  children: (session: Session, data: PortalData) => React.ReactNode;
}

const friendlyAuthError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : '';
  if (/invalid login|invalid credentials/i.test(message)) {
    return 'E-mail ou senha incorretos.';
  }
  if (/email not confirmed/i.test(message)) {
    return 'Confirme seu e-mail antes de entrar.';
  }
  if (/already registered|already exists|user already/i.test(message)) {
    return 'Este e-mail já possui uma conta. Entre com sua senha.';
  }
  if (/rate|too many|over.*limit/i.test(message)) {
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  }
  return message || 'Não foi possível concluir a autenticação.';
};

export default function PortalAuthGate({
  onBackToAdmin,
  children
}: PortalAuthGateProps) {
  const authProvider = activePortalAuthProvider;
  const [session, setSession] = useState<Session | null>(null);
  const [portalData, setPortalData] = useState<PortalData | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [mode, setMode] = useState<AuthMode>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const prepareAuthenticatedPortal = async (activeSession: Session) => {
    await claimExistingPortalCustomer();
    const data = await loadPortalData();
    setPortalData(data);
    setSession(activeSession);
  };

  useEffect(() => {
    const client = getPortalSupabaseClient();
    let disposed = false;
    let requestId = 0;

    const restore = async () => {
      const currentRequest = ++requestId;
      try {
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        if (!data.session) {
          if (!disposed) {
            setSession(null);
            setPortalData(null);
          }
          return;
        }

        const isRecoveryCallback =
          typeof window !== 'undefined' &&
          new URL(window.location.href).searchParams.get('recovery') === 'true';
        if (isRecoveryCallback) {
          if (!disposed && currentRequest === requestId) {
            setSession(data.session);
            setPortalData(null);
            setMode('new-password');
          }
          return;
        }

        await claimExistingPortalCustomer();
        const restoredData = await loadPortalData();
        if (!disposed && currentRequest === requestId) {
          setSession(data.session);
          setPortalData(restoredData);
        }
      } catch (error) {
        safeLog('error', 'client_portal.auth.restore', 'error', { error });
        if (!disposed) {
          setSession(null);
          setPortalData(null);
          setErrorMessage('Não foi possível restaurar a sessão. Entre novamente.');
        }
      } finally {
        if (!disposed) setInitializing(false);
      }
    };

    const { data: listener } = client.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY' && nextSession && !disposed) {
        requestId++;
        setSession(nextSession);
        setPortalData(null);
        setMode('new-password');
        setInitializing(false);
      }
      if (event === 'SIGNED_OUT' && !disposed) {
        requestId++;
        setSession(null);
        setPortalData(null);
        setMode('login');
        setInitializing(false);
      }
    });

    void restore();
    return () => {
      disposed = true;
      requestId++;
      listener.subscription.unsubscribe();
    };
  }, []);

  const submitLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setErrorMessage('');
    try {
      const activeSession = await authProvider.signIn(identifier, password);
      await prepareAuthenticatedPortal(activeSession);
    } catch (error) {
      safeLog('warn', 'client_portal.auth.login', 'error', { error });
      setErrorMessage(friendlyAuthError(error));
    } finally {
      setLoading(false);
      setInitializing(false);
    }
  };

  const submitSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage('');
    if (password !== passwordConfirmation) {
      setErrorMessage('As senhas não coincidem.');
      return;
    }
    setLoading(true);
    try {
      const activeSession = await authProvider.signUp(identifier, password);
      if (activeSession) {
        await prepareAuthenticatedPortal(activeSession);
      } else {
        setMode('confirmation-sent');
      }
    } catch (error) {
      safeLog('warn', 'client_portal.auth.signup', 'error', { error });
      setErrorMessage(friendlyAuthError(error));
    } finally {
      setLoading(false);
    }
  };

  const submitRecovery = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setErrorMessage('');
    try {
      await authProvider.requestPasswordRecovery(identifier);
      setMode('recovery-sent');
    } catch (error) {
      safeLog('warn', 'client_portal.auth.recovery.request', 'error', { error });
      setErrorMessage(friendlyAuthError(error));
    } finally {
      setLoading(false);
    }
  };

  const submitNewPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage('');
    if (password !== passwordConfirmation) {
      setErrorMessage('As senhas não coincidem.');
      return;
    }
    setLoading(true);
    try {
      await authProvider.updatePassword(password);
      const activeSession =
        session || (await getPortalSupabaseClient().auth.getSession()).data.session;
      if (!activeSession) throw new Error('Sessão de recuperação expirada.');

      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('recovery');
        window.history.replaceState({}, '', url);
      }
      await prepareAuthenticatedPortal(activeSession);
    } catch (error) {
      safeLog('warn', 'client_portal.auth.recovery.update', 'error', { error });
      setErrorMessage(friendlyAuthError(error));
    } finally {
      setLoading(false);
    }
  };

  if (session && portalData && mode !== 'new-password') {
    return <>{children(session, portalData)}</>;
  }

  const title =
    mode === 'signup' ? 'Criar conta segura' :
    mode === 'recovery' ? 'Recuperar senha' :
    mode === 'new-password' ? 'Definir nova senha' :
    mode === 'confirmation-sent' ? 'Confirme seu e-mail' :
    mode === 'recovery-sent' ? 'Verifique seu e-mail' :
    'Portal do Cliente';

  const informationalMode =
    mode === 'confirmation-sent' || mode === 'recovery-sent';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4 py-8">
      <main className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="w-11 h-11 rounded-2xl bg-sky-500/10 border border-sky-500/25 flex items-center justify-center mb-4">
              <ShieldCheck className="text-sky-400" size={23} />
            </div>
            <h1 className="text-xl font-black">{title}</h1>
            <p className="text-xs text-slate-400 mt-1">
              Acesso protegido pelo Supabase Auth.
            </p>
          </div>
          {onBackToAdmin && (
            <button
              type="button"
              onClick={onBackToAdmin}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
            >
              <ChevronLeft size={14} /> Administração
            </button>
          )}
        </div>

        {initializing ? (
          <div className="py-12 flex items-center justify-center gap-3 text-slate-400 text-sm">
            <span className="w-5 h-5 rounded-full border-2 border-slate-700 border-t-sky-500 animate-spin" />
            Restaurando sessão...
          </div>
        ) : (
          <>
            {errorMessage && (
              <div className="mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-2xl p-3 flex gap-2 text-xs">
                <AlertCircle size={15} className="shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {informationalMode ? (
              <div className="space-y-5">
                <div className="bg-sky-500/10 border border-sky-500/20 text-sky-200 rounded-2xl p-4 text-sm leading-relaxed">
                  {mode === 'confirmation-sent'
                    ? 'Enviamos um link de confirmação. Abra-o no mesmo navegador e depois entre com sua senha.'
                    : 'Se o e-mail estiver cadastrado, você receberá um link seguro para definir uma nova senha.'}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMessage('');
                  }}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl py-3.5 text-sm"
                >
                  Voltar ao login
                </button>
              </div>
            ) : (
              <>
                <form
                  onSubmit={
                    mode === 'login' ? submitLogin :
                    mode === 'signup' ? submitSignup :
                    mode === 'recovery' ? submitRecovery :
                    submitNewPassword
                  }
                  className="space-y-4"
                >
                  {mode !== 'new-password' && (
                    <label className="block">
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                        {authProvider.identifierLabel}
                      </span>
                      <span className="relative block">
                        <Mail size={16} className="absolute left-3.5 top-3.5 text-slate-500" />
                        <input
                          type={authProvider.identifierType}
                          autoComplete={authProvider.identifierAutoComplete}
                          required
                          value={identifier}
                          onChange={event => setIdentifier(event.target.value)}
                          placeholder="cliente@exemplo.com"
                          className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 outline-none rounded-2xl pl-10 pr-4 py-3 text-sm"
                        />
                      </span>
                    </label>
                  )}

                  {(mode === 'login' || mode === 'signup' || mode === 'new-password') && (
                    <label className="block">
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                        {mode === 'new-password' ? 'Nova senha' : 'Senha'}
                      </span>
                      <span className="relative block">
                        <LockKeyhole size={16} className="absolute left-3.5 top-3.5 text-slate-500" />
                        <input
                          type="password"
                          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                          required
                          value={password}
                          onChange={event => setPassword(event.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 outline-none rounded-2xl pl-10 pr-4 py-3 text-sm"
                        />
                      </span>
                    </label>
                  )}

                  {(mode === 'signup' || mode === 'new-password') && (
                    <label className="block">
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                        Confirmar senha
                      </span>
                      <input
                        type="password"
                        autoComplete="new-password"
                        required
                        value={passwordConfirmation}
                        onChange={event => setPasswordConfirmation(event.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 outline-none rounded-2xl px-4 py-3 text-sm"
                      />
                      <span className="block text-[10px] text-slate-500 mt-1.5">
                        Mínimo de 8 caracteres, com maiúscula, minúscula e número.
                      </span>
                    </label>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-black rounded-2xl py-3.5 text-sm"
                  >
                    {loading ? 'Aguarde...' :
                      mode === 'login' ? 'Entrar' :
                      mode === 'signup' ? 'Criar conta' :
                      mode === 'recovery' ? 'Enviar link' :
                      'Salvar nova senha'}
                  </button>
                </form>

                <div className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs">
                  {mode !== 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login');
                        setErrorMessage('');
                      }}
                      className="text-slate-400 hover:text-white"
                    >
                      Voltar ao login
                    </button>
                  )}
                  {mode === 'login' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setMode('signup');
                          setErrorMessage('');
                        }}
                        className="text-sky-400 hover:text-sky-300"
                      >
                        Criar minha conta
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMode('recovery');
                          setErrorMessage('');
                        }}
                        className="text-slate-400 hover:text-white"
                      >
                        Esqueci a senha
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
