/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { LogIn, Car, Key, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';
import { dbInstance } from '../db/localDb';

interface LoginScreenProps {
  authError?: string;
  onGoToPortal?: () => void;
}

export default function LoginScreen({ authError, onGoToPortal }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem('sl_remembered_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberEmail(true);
    }

    // Remove credentials left by the legacy local-login implementation.
    localStorage.removeItem('sl_remembered_password');
    localStorage.removeItem('sl_remember_me');
  }, []);

  useEffect(() => {
    if (authError) setError(authError);
  }, [authError]);

  const saveRememberedEmail = () => {
    if (rememberEmail && email.trim()) {
      localStorage.setItem('sl_remembered_email', email.trim());
    } else {
      localStorage.removeItem('sl_remembered_email');
    }
  };

  const handleForgotPassword = (e: React.MouseEvent) => {
    e.preventDefault();
    setError('Para recuperar sua senha, entre em contato com o administrador do sistema.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const supabase = dbInstance.getSupabaseClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError(`Erro de autenticação: ${signInError.message}`);
        return;
      }

      saveRememberedEmail();
    } catch (err: any) {
      setError(`Erro de conexão com o serviço de autenticação: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden" id="login-container">
      {/* Decorative background gradients */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-slate-500/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="flex justify-center items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-sky-500 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
            <Car size={26} className="animate-pulse" />
          </div>
          <div>
            <span className="text-xs uppercase tracking-widest font-mono text-sky-400 font-bold">Aesthetics Tech</span>
            <h1 className="text-xl font-bold text-slate-100 tracking-tight leading-none">Senhora Limpeza</h1>
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-100 tracking-tight">
          Acesse a sua conta
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          Painel de Gestão e Automações de Estética Automotiva
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10"
      >
        <div className="bg-slate-900 py-8 px-4 shadow-2xl rounded-2xl border border-slate-800 sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl p-3 flex items-start gap-2 animate-shake" id="login-error">
                <ShieldCheck size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300">
                Endereço de E-mail
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <LogIn size={18} />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm transition-all"
                  placeholder="exemplo@senhoralimpeza.com.br"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                Senha
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Key size={18} />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm transition-all"
                  placeholder="Digite sua senha"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-100 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-email"
                  name="remember-email"
                  type="checkbox"
                  checked={rememberEmail}
                  onChange={(e) => setRememberEmail(e.target.checked)}
                  className="h-4 w-4 text-sky-600 focus:ring-sky-500 border-slate-800 rounded bg-slate-950 cursor-pointer"
                />
                <label htmlFor="remember-email" className="ml-2 block text-sm text-slate-300 cursor-pointer select-none">
                  Lembrar e-mail
                </label>
              </div>

              <div className="text-sm">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="font-medium text-sky-400 hover:text-sky-300 transition-colors bg-transparent border-none p-0 cursor-pointer"
                >
                  Esqueceu a senha?
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-semibold text-white bg-sky-500 hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 focus:ring-offset-slate-950 transition-all disabled:opacity-55 disabled:cursor-not-allowed"
                id="btn-login"
              >
                {loading ? 'Autenticando...' : 'Entrar no Sistema'}
              </button>
            </div>
          </form>

          {onGoToPortal && (
            <div className="mt-6 border-t border-slate-800 pt-5 flex flex-col items-center">
              <span className="text-[11px] text-slate-400 mb-2">Quer agendar seu próprio serviço?</span>
              <button
                type="button"
                onClick={onGoToPortal}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 hover:text-sky-300 font-bold rounded-xl border border-sky-500/20 hover:border-sky-500/30 transition-all text-[11px] cursor-pointer"
              >
                Acessar Portal do Cliente
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
