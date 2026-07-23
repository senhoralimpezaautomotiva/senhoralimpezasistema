/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Globe, 
  MessageSquare, 
  Check, 
  Save, 
  Key, 
  Layout, 
  Smartphone,
  Phone,
  Building,
  Mail,
  Zap,
  Gift,
  Lock,
  Shield,
  LogOut,
  Monitor,
  Laptop,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
  Clock,
  Sliders,
  Calendar,
  Plus,
  X
} from 'lucide-react';
import { SystemConfig } from '../types';
import { dbInstance, hasModulePermission } from '../db/localDb';

interface ConfiguracoesModuleProps {
  config: SystemConfig;
  onUpdateConfig: (updated: Partial<SystemConfig>) => void;
  currentUser?: { name: string; email: string; role: string; authProvider?: 'supabase' | 'local' } | null;
  onUpdateCurrentUser?: (user: { name: string; email: string; role: string; authProvider?: 'supabase' | 'local' }) => void;
}

export default function ConfiguracoesModule({ 
  config, 
  onUpdateConfig, 
  currentUser, 
  onUpdateCurrentUser 
}: ConfiguracoesModuleProps) {
  const canEdit = hasModulePermission(currentUser as any, 'configuracoes', 'edit');
  // Navigation active sub-tab
  const [activeSubTab, setActiveSubTab] = useState<'gerais' | 'acesso' | 'agenda'>('gerais');

  // General tab states
  const [formData, setFormData] = useState<any>({ ...config });
  const [showSuccess, setShowSuccess] = useState(false);

  // Access tab states
  const [currentEmail, setCurrentEmail] = useState(currentUser?.email || 'contato@senhoralimpeza.com.br');
  const [newEmail, setNewEmail] = useState('');
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessError, setAccessError] = useState('');
  const [accessSuccess, setAccessSuccess] = useState('');

  // Agenda tab states & default fallback
  const [agendaData, setAgendaData] = useState<any>(() => {
    return config.agenda || {
      days: [
        { dayOfWeek: 0, dayName: 'Domingo', isActive: false, openTime: '08:00', closeTime: '12:00', hasLunchBreak: false, lunchStart: '12:00', lunchEnd: '13:00' },
        { dayOfWeek: 1, dayName: 'Segunda-feira', isActive: true, openTime: '08:00', closeTime: '18:00', hasLunchBreak: true, lunchStart: '12:00', lunchEnd: '13:00' },
        { dayOfWeek: 2, dayName: 'Terça-feira', isActive: true, openTime: '08:00', closeTime: '18:00', hasLunchBreak: true, lunchStart: '12:00', lunchEnd: '13:00' },
        { dayOfWeek: 3, dayName: 'Quarta-feira', isActive: true, openTime: '08:00', closeTime: '18:00', hasLunchBreak: true, lunchStart: '12:00', lunchEnd: '13:00' },
        { dayOfWeek: 4, dayName: 'Quinta-feira', isActive: true, openTime: '08:00', closeTime: '18:00', hasLunchBreak: true, lunchStart: '12:00', lunchEnd: '13:00' },
        { dayOfWeek: 5, dayName: 'Sexta-feira', isActive: true, openTime: '08:00', closeTime: '18:00', hasLunchBreak: true, lunchStart: '12:00', lunchEnd: '13:00' },
        { dayOfWeek: 6, dayName: 'Sábado', isActive: true, openTime: '08:00', closeTime: '14:00', hasLunchBreak: false, lunchStart: '12:00', lunchEnd: '13:00' }
      ],
      timeSlots: [
        { id: 'ts_1', time: '08:00', maxCapacity: 2 },
        { id: 'ts_2', time: '09:00', maxCapacity: 2 },
        { id: 'ts_3', time: '10:00', maxCapacity: 2 },
        { id: 'ts_4', time: '11:00', maxCapacity: 2 },
        { id: 'ts_5', time: '12:00', maxCapacity: 1 },
        { id: 'ts_6', time: '13:00', maxCapacity: 2 },
        { id: 'ts_7', time: '14:00', maxCapacity: 2 },
        { id: 'ts_8', time: '15:00', maxCapacity: 2 },
        { id: 'ts_9', time: '16:00', maxCapacity: 2 },
        { id: 'ts_10', time: '17:00', maxCapacity: 2 }
      ],
      minAdvanceHours: 2,
      maxAdvanceDays: 60,
      autoBlockDuration: true
    };
  });

  const [newSlotTime, setNewSlotTime] = useState('08:00');
  const [newSlotCapacity, setNewSlotCapacity] = useState(2);
  const [agendaSuccess, setAgendaSuccess] = useState(false);

  // Sync agenda state with external configuration changes
  useEffect(() => {
    if (config.agenda) {
      setAgendaData(config.agenda);
    }
  }, [config.agenda]);

  const handleToggleDay = (dayOfWeek: number) => {
    setAgendaData((prev: any) => ({
      ...prev,
      days: prev.days.map((d: any) => d.dayOfWeek === dayOfWeek ? { ...d, isActive: !d.isActive } : d)
    }));
  };

  const handleUpdateDayTime = (dayOfWeek: number, field: string, value: any) => {
    setAgendaData((prev: any) => ({
      ...prev,
      days: prev.days.map((d: any) => d.dayOfWeek === dayOfWeek ? { ...d, [field]: value } : d)
    }));
  };

  const handleAddSlot = () => {
    const exists = agendaData.timeSlots.some((s: any) => s.time === newSlotTime);
    if (exists) {
      alert('Este horário já está cadastrado!');
      return;
    }
    const newSlot = {
      id: `ts_${Date.now()}`,
      time: newSlotTime,
      maxCapacity: newSlotCapacity
    };
    setAgendaData((prev: any) => {
      const updatedSlots = [...prev.timeSlots, newSlot].sort((a, b) => a.time.localeCompare(b.time));
      return { ...prev, timeSlots: updatedSlots };
    });
  };

  const handleDeleteSlot = (id: string) => {
    setAgendaData((prev: any) => ({
      ...prev,
      timeSlots: prev.timeSlots.filter((s: any) => s.id !== id)
    }));
  };

  const handleUpdateSlotCapacity = (id: string, capacity: number) => {
    setAgendaData((prev: any) => ({
      ...prev,
      timeSlots: prev.timeSlots.map((s: any) => s.id === id ? { ...s, maxCapacity: Math.max(1, capacity) } : s)
    }));
  };

  const handleSaveAgenda = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateConfig({ agenda: agendaData });
    setAgendaSuccess(true);
    setTimeout(() => {
      setAgendaSuccess(false);
    }, 3000);
  };

  // Active sessions state (simulation & cache)
  const [sessions, setSessions] = useState<Array<{ id: string; device: string; ip: string; location: string; activeAt: string; isCurrent: boolean }>>(() => {
    const cached = localStorage.getItem('sl_active_sessions');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        // ignore
      }
    }
    return [
      { id: 'sess_1', device: 'Chrome no Windows (Computador de Mesa)', ip: '177.42.109.81', location: 'São Paulo - SP', activeAt: 'Ativo agora', isCurrent: true },
      { id: 'sess_2', device: 'Safari no iPhone 15 Pro', ip: '189.120.14.2', location: 'São Paulo - SP', activeAt: 'Ativo há 14 minutos', isCurrent: false },
      { id: 'sess_3', device: 'Firefox no macOS Catalina', ip: '200.18.251.99', location: 'Campinas - SP', activeAt: 'Ativo há 2 dias', isCurrent: false }
    ];
  });

  // Keep sessions cache up-to-date
  useEffect(() => {
    localStorage.setItem('sl_active_sessions', JSON.stringify(sessions));
  }, [sessions]);

  // Sync current user email changes
  useEffect(() => {
    if (currentUser?.email) {
      setCurrentEmail(currentUser.email);
    }
  }, [currentUser]);

  // Handle General Settings Form Submit
  const handleGeneralSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateConfig(formData);
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
    }, 3000);
  };

  // Handle Email Change Update (Supabase / Local)
  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccessError('');
    setAccessSuccess('');
    setAccessLoading(true);

    if (!newEmail || newEmail.toLowerCase() === currentEmail.toLowerCase()) {
      setAccessError('Por favor, informe um novo endereço de e-mail diferente do atual.');
      setAccessLoading(false);
      return;
    }

    try {
      if (config.useRealSupabase) {
        const supabase = dbInstance.getSupabaseClient();
        const { error } = await supabase.auth.updateUser({ email: newEmail });
        if (error) {
          throw new Error(`Erro Supabase Auth: ${error.message}`);
        }
        setAccessSuccess('Solicitação enviada! Um link de confirmação foi enviado para ambos os e-mails para validar a alteração.');
      } else {
        // Offline / Cache simulation
        localStorage.setItem('sl_admin_email', newEmail);
        setCurrentEmail(newEmail);
        if (onUpdateCurrentUser && currentUser) {
          onUpdateCurrentUser({
            ...currentUser,
            email: newEmail
          });
        }
        setAccessSuccess('E-mail de login atualizado com sucesso no cache local!');
      }
      setNewEmail('');
    } catch (err: any) {
      setAccessError(err.message || 'Ocorreu um erro ao atualizar o e-mail de login.');
    } finally {
      setAccessLoading(false);
    }
  };

  // Handle Password Change Update (Supabase / Local)
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccessError('');
    setAccessSuccess('');
    setAccessLoading(true);

    console.group('🔐 [Auth Investigative] Processo de Alteração de Senha do Administrador');
    
    const emailToAuth = currentUser?.email || 'contato@senhoralimpeza.com.br';
    const authProvider = currentUser?.authProvider || 'local';
    const isSupabaseConfigured = !!(config.useRealSupabase && config.supabaseUrl && config.supabaseAnonKey);

    console.log('📌 Email do Administrador:', emailToAuth);
    console.log('📌 Provedor de Login:', authProvider);
    console.log('📌 Supabase Configurado no Painel:', isSupabaseConfigured);
    console.log('📌 Comprimento da Senha Atual:', currentPassword?.length || 0);
    console.log('📌 Comprimento da Nova Senha:', newPassword?.length || 0);

    if (!currentPassword) {
      console.warn('❌ Erro: Senha atual vazia.');
      setAccessError('Insira a sua senha atual para confirmar a alteração.');
      setAccessLoading(false);
      console.groupEnd();
      return;
    }

    if (newPassword !== confirmPassword) {
      console.warn('❌ Erro: Confirmação de senha incorreta.');
      setAccessError('A nova senha e a confirmação não correspondem.');
      setAccessLoading(false);
      console.groupEnd();
      return;
    }

    if (newPassword.length < 6) {
      console.warn('❌ Erro: Comprimento da nova senha inferior a 6 caracteres.');
      setAccessError('A nova senha deve ter no mínimo 6 caracteres.');
      setAccessLoading(false);
      console.groupEnd();
      return;
    }

    try {
      // Determine if we should use real Supabase Auth
      let useSupabaseAuthFlow = false;
      if (isSupabaseConfigured && authProvider === 'supabase') {
        useSupabaseAuthFlow = true;
      }

      console.log('⚡ Fluxo de alteração selecionado:', useSupabaseAuthFlow ? 'SUPABASE AUTH' : 'LOCAL CACHE / LOCAL STORAGE');

      if (useSupabaseAuthFlow) {
        console.log('🔄 Iniciando reautenticação no Supabase...');
        const supabase = dbInstance.getSupabaseClient();
        
        // 1. Reauthenticate by attempting sign-in with current credentials
        const { error: reauthError } = await supabase.auth.signInWithPassword({
          email: emailToAuth,
          password: currentPassword
        });

        if (reauthError) {
          console.error('❌ Erro de Reautenticação no Supabase:', reauthError.message);
          throw new Error('A senha atual inserida está incorreta no Supabase Auth. Não foi possível confirmar a alteração.');
        }
        console.log('✅ Reautenticação efetuada com sucesso no Supabase.');

        // 2. Perform password update
        console.log('🔄 Atualizando senha no Supabase Auth...');
        const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
        if (updateError) {
          console.error('❌ Erro ao atualizar senha no Supabase:', updateError.message);
          throw new Error(`Erro Supabase Auth ao definir nova senha: ${updateError.message}`);
        }
        
        console.log('✅ Senha atualizada com sucesso no Supabase Auth!');
        
        // Synchronize local fallback password too, so they match in case of offline login
        localStorage.setItem('sl_admin_password', newPassword);
        console.log('💾 Sincronizado backup de segurança de login local (sl_admin_password) com a nova senha.');
        
        setAccessSuccess('Senha alterada com sucesso no Supabase Auth e sincronizada localmente!');
      } else {
        // Offline / Cache simulation
        console.log('🔄 Buscando senha atual no cache local...');
        const savedPassword = localStorage.getItem('sl_admin_password') || 'admin123';
        
        console.log('🔄 Validando senha atual contra o cache...');
        if (currentPassword !== savedPassword) {
          console.error('❌ Erro: Senha atual inserida não corresponde ao cache local.');
          throw new Error('A senha atual inserida está incorreta. Não foi possível confirmar a alteração.');
        }

        console.log('🔄 Gravando nova senha no cache local (sl_admin_password)...');
        localStorage.setItem('sl_admin_password', newPassword);
        console.log('✅ Senha gravada com sucesso no cache local!');
        
        setAccessSuccess('Senha de login administrativa alterada com sucesso no cache local!');
      }

      // Reset fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      console.log('🧹 Campos do formulário redefinidos.');
      
    } catch (err: any) {
      console.error('🚨 Falha no processo de alteração de senha:', err.message || err);
      setAccessError(err.message || 'Ocorreu um erro ao atualizar a senha.');
    } finally {
      setAccessLoading(false);
      console.groupEnd();
    }
  };

  // Handle Terminating other active sessions
  const handleTerminateOtherSessions = async () => {
    setAccessError('');
    setAccessSuccess('');
    setAccessLoading(true);

    try {
      if (config.useRealSupabase) {
        const supabase = dbInstance.getSupabaseClient();
        const { error } = await supabase.auth.signOut({ scope: 'others' });
        if (error) {
          throw new Error(`Erro Supabase ao encerrar sessões externas: ${error.message}`);
        }
        setAccessSuccess('Todas as outras sessões ativas foram revogadas com sucesso no Supabase Auth!');
      } else {
        // Mock simulation
        setSessions(prev => prev.filter(s => s.isCurrent));
        setAccessSuccess('Todas as outras sessões de dispositivos foram encerradas com sucesso!');
      }
    } catch (err: any) {
      setAccessError(err.message || 'Ocorreu um erro ao encerrar sessões ativas.');
    } finally {
      setAccessLoading(false);
    }
  };

  const handleRevokeSession = (sessionId: string) => {
    setAccessError('');
    setAccessSuccess('');
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    setAccessSuccess('Acesso do dispositivo revogado com sucesso!');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fadeIn" id="configuracoes-module-view">
      
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-slate-900 p-6 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3">
          <Settings className="text-sky-500 shrink-0" size={24} />
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Configurações Gerais do Sistema</h2>
            <p className="text-xs text-slate-400 mt-0.5">Customize dados corporativos, credenciais Z-API, webhooks, parâmetros do Make e segurança.</p>
          </div>
        </div>

        {showSuccess && (
          <div className="self-start sm:self-center flex items-center gap-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-3.5 py-1.5 rounded-xl text-xs font-bold animate-fadeIn">
            <Check size={14} />
            <span>Salvo com Sucesso!</span>
          </div>
        )}
      </div>

      {/* Modern Sub-Tab Navigation Bar */}
      <div className="flex border-b border-slate-800/80 gap-1 bg-slate-900/20 p-1 rounded-xl" id="configuracoes-tabs-switcher">
        <button
          type="button"
          onClick={() => {
            setActiveSubTab('gerais');
            setAccessError('');
            setAccessSuccess('');
          }}
          className={`flex-1 sm:flex-initial px-5 py-3 text-xs font-bold transition-all flex items-center justify-center gap-2 rounded-lg cursor-pointer ${
            activeSubTab === 'gerais'
              ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20 shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <Settings size={15} />
          <span>Parâmetros & Integrações</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveSubTab('acesso');
            setAccessError('');
            setAccessSuccess('');
          }}
          className={`flex-1 sm:flex-initial px-5 py-3 text-xs font-bold transition-all flex items-center justify-center gap-2 rounded-lg cursor-pointer ${
            activeSubTab === 'acesso'
              ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20 shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <Shield size={15} />
          <span>Gerenciamento de Acesso</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveSubTab('agenda');
            setAccessError('');
            setAccessSuccess('');
          }}
          className={`flex-1 sm:flex-initial px-5 py-3 text-xs font-bold transition-all flex items-center justify-center gap-2 rounded-lg cursor-pointer ${
            activeSubTab === 'agenda'
              ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20 shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
          id="btn-agenda-tab"
        >
          <Clock size={15} />
          <span>Configurações da Agenda</span>
        </button>
      </div>

      {/* TAB 1: PARÂMETROS GERAIS DO SISTEMA */}
      {activeSubTab === 'gerais' && (
        <form onSubmit={handleGeneralSubmit} className="space-y-6 text-xs">
          
          {/* SECTION 1: CORPORATE BRANDING */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4">
            <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-white border-b border-slate-850 pb-2.5 flex items-center gap-2">
              <Building size={14} className="text-slate-400" />
              Dados da Empresa
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Nome Fantasia / Marca</label>
                <input 
                  type="text" 
                  required
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2.5 text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Contato Geral (WhatsApp)</label>
                <input 
                  type="text" 
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2.5 text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">E-mail Comercial</label>
                <input 
                  type="email" 
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2.5 text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Cor Principal de Accent</label>
                <select 
                  value={formData.themeColor || 'sky'}
                  onChange={(e) => setFormData({ ...formData, themeColor: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2.5 text-white"
                >
                  <option value="sky">Azul Celeste (Senhora Limpeza Standard)</option>
                  <option value="emerald">Verde Esmeralda (Premium)</option>
                  <option value="violet">Violeta Metálico (Custom)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Tema Visual</label>
                <select 
                  value={formData.theme || 'dark'}
                  onChange={(e) => setFormData({ ...formData, theme: e.target.value as 'light' | 'dark' })}
                  className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2.5 text-white"
                >
                  <option value="dark">Modo Escuro (Padrão)</option>
                  <option value="light">Modo Claro</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION: PROGRAMA DE INDICACAO */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-850 pb-2.5">
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-white flex items-center gap-2">
                <Gift size={14} className="text-sky-500" />
                Programa de Indicação & Prêmios
              </h3>
              <span className={`px-2.5 py-0.5 border text-[9px] font-bold rounded-md font-mono uppercase ${
                formData.referralActive 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' 
                  : 'bg-slate-950/60 text-slate-500 border-slate-800'
              }`}>
                {formData.referralActive ? 'Ativado' : 'Desativado'}
              </span>
            </div>

            <p className="text-slate-400 text-xs font-medium leading-relaxed">
              Configure as regras do seu programa de indicação automático. Quando ativo, os clientes visualizam seus códigos únicos no portal de agendamento e ganham um percentual de desconto a cada indicação que concluir o primeiro serviço.
            </p>

            <div className="flex items-center gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800/60">
              <input 
                type="checkbox" 
                id="referralActive"
                checked={formData.referralActive ?? false}
                onChange={(e) => setFormData({ ...formData, referralActive: e.target.checked })}
                className="w-4 h-4 text-sky-500 rounded border-slate-800 bg-slate-950 focus:ring-sky-500 focus:ring-offset-slate-900 cursor-pointer"
              />
              <label htmlFor="referralActive" className="text-slate-200 text-xs font-semibold cursor-pointer select-none">
                Ativar Programa de Indicação de Clientes
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Percentual de Desconto de Indicação (%)</label>
              <input 
                type="number"
                min="0"
                max="100"
                value={formData.referralDiscountPercent ?? 10}
                onChange={(e) => setFormData({ ...formData, referralDiscountPercent: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2.5 text-white font-mono"
              />
            </div>
          </div>

          {/* SECTION 2: INTEGRACAO WHATSAPP (Z-API) */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-850 pb-2.5">
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-white flex items-center gap-2">
                <MessageSquare size={14} className="text-slate-400" />
                Integração WhatsApp (Z-API)
              </h3>
              <span className="px-2.5 py-0.5 bg-sky-500/10 text-sky-400 border border-sky-500/15 text-[9px] font-bold rounded-md font-mono uppercase">
                Pronto para Conexão
              </span>
            </div>

            <p className="text-slate-400 text-xs font-medium leading-relaxed">
              Insira suas credenciais da API de WhatsApp comercial <strong>Z-API</strong> para disparar as mensagens automáticas reais. O sistema já está arquitetado para converter a fila simulada em disparos http reais a cada finalização.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">ID da Instância Z-API</label>
                <input 
                  type="text" 
                  value={formData.zapiInstanceId || ''}
                  onChange={(e) => setFormData({ ...formData, zapiInstanceId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2.5 text-white font-mono"
                  placeholder="Ex: 3B2D6C5E37F9A0"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Token de Segurança Z-API</label>
                <input 
                  type="password" 
                  value={formData.zapiToken || ''}
                  onChange={(e) => setFormData({ ...formData, zapiToken: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2.5 text-white font-mono"
                  placeholder="••••••••••••••••••••••••••••••••"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Client Token de Segurança</label>
                <input 
                  type="text" 
                  value={formData.zapiClientToken || ''}
                  onChange={(e) => setFormData({ ...formData, zapiClientToken: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2.5 text-white font-mono"
                  placeholder="Ex: F9C4E0A1D3B2"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: WEBHOOK DO MAKE.COM */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4">
            <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-white border-b border-slate-850 pb-2.5 flex items-center gap-2">
              <Globe size={14} className="text-slate-400" />
              Automações Make.com (Integromat)
            </h3>

            <p className="text-slate-400 text-xs font-medium leading-relaxed">
              Configure a URL de Webhook criada no seu cenário do Make para receber relatórios de status em tempo real a cada atendimento concluído.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">URL de Webhook Ativa</label>
              <input 
                type="url" 
                value={formData.makeWebhookUrl || ''}
                onChange={(e) => setFormData({ ...formData, makeWebhookUrl: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2.5 text-white font-mono text-[11px]"
                placeholder="https://hook.us1.make.com/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
            </div>
          </div>

          {/* SECTION 3.5: JANELA DE FUNCIONAMENTO */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4">
            <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-white border-b border-slate-850 pb-2.5 flex items-center gap-2">
              <Clock size={14} className="text-amber-400" />
              Janela de Funcionamento das Automações
            </h3>

            <p className="text-slate-400 text-xs font-medium leading-relaxed">
              Defina o horário permitido para o envio de mensagens automáticas. Disparos gerados fora dessa janela serão postergados automaticamente para o início do próximo período operacional, evitando incomodar clientes em horários inadequados.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Horário de Início (Operação)</label>
                <input 
                  type="time" 
                  value={formData.automationStartHour || '08:00'}
                  onChange={(e) => setFormData({ ...formData, automationStartHour: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2.5 text-white font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Horário de Término (Operação)</label>
                <input 
                  type="time" 
                  value={formData.automationEndHour || '20:00'}
                  onChange={(e) => setFormData({ ...formData, automationEndHour: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2.5 text-white font-mono text-xs"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: CONEXÃO SUPABASE */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-850 pb-2.5">
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-white flex items-center gap-2">
                <Key size={14} className="text-sky-500" />
                Banco de Dados Supabase (Conexão Oficial)
              </h3>
              <span className={`px-2.5 py-0.5 border text-[9px] font-bold rounded-md font-mono uppercase ${
                formData.useRealSupabase 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' 
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/25'
              }`}>
                {formData.useRealSupabase ? 'Sincronizado' : 'Offline / Cache'}
              </span>
            </div>

            <p className="text-slate-400 text-xs font-medium leading-relaxed">
              Configure a integração com o banco de dados oficial do Supabase. Quando ativa, todas as operações de clientes, veículos, serviços e agendamentos serão sincronizadas automaticamente com a nuvem em tempo real.
            </p>

            <div className="flex items-center gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800/60">
              <input 
                type="checkbox" 
                id="useRealSupabase"
                checked={formData.useRealSupabase || false}
                onChange={(e) => setFormData({ ...formData, useRealSupabase: e.target.checked })}
                className="w-4 h-4 text-sky-500 rounded border-slate-800 bg-slate-950 focus:ring-sky-500 focus:ring-offset-slate-900 cursor-pointer"
              />
              <label htmlFor="useRealSupabase" className="text-slate-200 text-xs font-semibold cursor-pointer select-none">
                Ativar Sincronização em Tempo Real (Supabase Cloud)
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Project URL</label>
                <input 
                  type="text" 
                  required={formData.useRealSupabase}
                  value={formData.supabaseUrl || ''}
                  onChange={(e) => setFormData({ ...formData, supabaseUrl: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2.5 text-white font-mono text-[11px]"
                  placeholder="https://your-project.supabase.co"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">API Key (Anon Key)</label>
                <input 
                  type="password" 
                  required={formData.useRealSupabase}
                  value={formData.supabaseAnonKey || ''}
                  onChange={(e) => setFormData({ ...formData, supabaseAnonKey: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2.5 text-white font-mono text-[11px]"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                />
              </div>
            </div>
          </div>

          {/* FORM ACTION TRIGGER BUTTON */}
          {canEdit && (
            <div className="flex justify-end gap-3 pt-2">
              <button 
                type="submit" 
                className="px-6 py-3 bg-sky-500 hover:bg-sky-600 font-semibold text-xs text-white rounded-xl shadow-lg shadow-sky-500/20 flex items-center gap-2 transition-all cursor-pointer"
                id="btn-save-settings"
              >
                <Save size={15} />
                <span>Salvar Configurações</span>
              </button>
            </div>
          )}

        </form>
      )}

      {/* TAB 2: GERENCIAMENTO DE ACESSO */}
      {activeSubTab === 'acesso' && (
        <div className="space-y-6 animate-fadeIn" id="acesso-panel">
          
          {/* Status Alert Banners */}
          {accessError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl p-3.5 flex items-start gap-2.5 animate-shake" id="access-error-banner">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-400" />
              <div className="flex-1">
                <span className="font-bold block mb-0.5">Erro na validação</span>
                <span>{accessError}</span>
              </div>
            </div>
          )}

          {accessSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl p-3.5 flex items-start gap-2.5 animate-fadeIn" id="access-success-banner">
              <Check size={16} className="shrink-0 mt-0.5 text-emerald-400" />
              <div className="flex-1">
                <span className="font-bold block mb-0.5">Operação Concluída</span>
                <span>{accessSuccess}</span>
              </div>
            </div>
          )}

          {/* Multi-Section Flex Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* BOX 1: CHANGE EMAIL */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4 flex flex-col justify-between" id="card-change-email">
              <div className="space-y-3">
                <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-white border-b border-slate-850 pb-2.5 flex items-center gap-2">
                  <Mail size={14} className="text-sky-400" />
                  Trocar E-mail de Login
                </h3>

                <p className="text-slate-400 text-xs font-medium leading-relaxed">
                  Modifique o endereço de e-mail utilizado para autenticação no painel. 
                  {config.useRealSupabase && (
                    <strong className="text-sky-400 block mt-1">
                      ⚠️ Nota Supabase: Será enviado um token de validação para ambos os e-mails (antigo e novo) para prosseguir.
                    </strong>
                  )}
                </p>
              </div>

              <form onSubmit={handleUpdateEmail} className="space-y-3 mt-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">E-mail de Login Atual</label>
                  <input 
                    type="email" 
                    disabled
                    value={currentEmail}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2.5 text-slate-500 font-mono cursor-not-allowed opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Novo Endereço de E-mail</label>
                  <input 
                    type="email" 
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="novoemail@senhoralimpeza.com"
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2.5 text-white font-mono"
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={accessLoading}
                  className="w-full px-4 py-2.5 bg-slate-800 hover:bg-slate-750 font-bold text-xs text-white rounded-xl border border-slate-700/60 hover:border-slate-700 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {accessLoading ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Save size={14} className="text-sky-400" />
                  )}
                  <span>Atualizar E-mail de Login</span>
                </button>
              </form>
            </div>

            {/* BOX 2: CHANGE PASSWORD */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4" id="card-change-password">
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-white border-b border-slate-850 pb-2.5 flex items-center gap-2">
                <Lock size={14} className="text-sky-400" />
                Trocar Senha Administrativa
              </h3>

              <p className="text-slate-400 text-xs font-medium leading-relaxed">
                Atualize sua senha de acesso ao painel de estética automotiva. Requer a confirmação da sua senha atual.
              </p>

              <form onSubmit={handleUpdatePassword} className="space-y-3 mt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Senha Atual para Confirmação</label>
                  <div className="relative">
                    <input 
                      type={showCurrentPassword ? "text" : "password"} 
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Senha atual"
                      className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl pl-3 pr-10 py-2.5 text-white font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showCurrentPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Nova Senha</label>
                  <div className="relative">
                    <input 
                      type={showNewPassword ? "text" : "password"} 
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl pl-3 pr-10 py-2.5 text-white font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showNewPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Confirmar Nova Senha</label>
                  <div className="relative">
                    <input 
                      type={showConfirmPassword ? "text" : "password"} 
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repita a nova senha"
                      className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl pl-3 pr-10 py-2.5 text-white font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={accessLoading}
                  className="w-full px-4 py-2.5 bg-sky-500 hover:bg-sky-600 font-semibold text-xs text-white rounded-xl shadow-md hover:shadow-lg hover:shadow-sky-500/10 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {accessLoading ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Key size={14} />
                  )}
                  <span>Confirmar e Alterar Senha</span>
                </button>
              </form>
            </div>
          </div>

          {/* BOX 3: SESSIONS & DEVICES */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4" id="card-active-sessions">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-850 pb-2.5">
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-white flex items-center gap-2">
                <Smartphone size={14} className="text-sky-400" />
                Dispositivos & Sessões Ativas
              </h3>
              <button
                type="button"
                onClick={handleTerminateOtherSessions}
                disabled={accessLoading || sessions.length <= 1}
                className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 font-bold rounded-lg border border-red-500/20 transition-all text-[11px] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <LogOut size={13} />
                <span>Encerrar Outras Sessões</span>
              </button>
            </div>

            <p className="text-slate-400 text-xs font-medium leading-relaxed">
              Dispositivos administrativos conectados à sua conta ultimamente. Se notar algo estranho, revogue imediatamente o acesso remoto.
            </p>

            <div className="space-y-2.5" id="sessions-list">
              {sessions.map((sess) => (
                <div 
                  key={sess.id}
                  className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    sess.isCurrent 
                      ? 'bg-sky-500/5 border-sky-500/15' 
                      : 'bg-slate-950/60 border-slate-850 hover:bg-slate-950 transition-colors'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${sess.isCurrent ? 'bg-sky-500/10 text-sky-400' : 'bg-slate-900 text-slate-400'}`}>
                      {sess.device.includes('iPhone') || sess.device.includes('Safari') ? (
                        <Smartphone size={18} />
                      ) : sess.device.includes('macOS') ? (
                        <Laptop size={18} />
                      ) : (
                        <Monitor size={18} />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-100 text-[12px]">{sess.device}</span>
                        {sess.isCurrent && (
                          <span className="px-1.5 py-0.5 bg-sky-500/15 text-sky-400 border border-sky-500/20 text-[9px] font-bold rounded font-mono uppercase">
                            Sessão Atual
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span>IP: <strong className="font-mono text-slate-300">{sess.ip}</strong></span>
                        <span className="text-slate-600">•</span>
                        <span>Localização: <span className="text-slate-300">{sess.location}</span></span>
                        <span className="text-slate-600">•</span>
                        <span className="text-slate-500 font-mono text-[10px]">{sess.activeAt}</span>
                      </div>
                    </div>
                  </div>

                  {!sess.isCurrent && (
                    <button
                      type="button"
                      onClick={() => handleRevokeSession(sess.id)}
                      className="sm:self-center self-end px-3 py-1 bg-slate-900 hover:bg-slate-850 hover:text-white text-slate-400 border border-slate-800 hover:border-slate-700 text-[10px] font-bold rounded-lg transition-all cursor-pointer"
                    >
                      Revogar
                    </button>
                  )}
                </div>
              ))}
              
              {sessions.length === 0 && (
                <div className="p-8 text-center text-slate-500 bg-slate-950/40 rounded-xl border border-slate-850">
                  Nenhuma sessão ativa registrada.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'agenda' && (
        <div className="space-y-6 animate-fadeIn" id="agenda-config-panel">
          
          {agendaSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl p-3.5 flex items-start gap-2.5 animate-fadeIn" id="agenda-success-banner">
              <Check size={16} className="shrink-0 mt-0.5 text-emerald-400" />
              <div className="flex-1">
                <span className="font-bold block mb-0.5">Configurações Salvas</span>
                <span>As regras e horários da agenda foram atualizados e sincronizados com sucesso!</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSaveAgenda} className="space-y-6 text-xs">
            
            {/* SEÇÃO 1: REGRAS E ANTECEDÊNCIA */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4">
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-white border-b border-slate-850 pb-2.5 flex items-center gap-2">
                <Sliders size={14} className="text-sky-400" />
                Regras de Agendamento & Bloqueios
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Antecedência Mínima (Horas)</label>
                  <input 
                    type="number" 
                    min="0"
                    required
                    value={agendaData.minAdvanceHours}
                    onChange={(e) => setAgendaData({ ...agendaData, minAdvanceHours: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white font-mono"
                    placeholder="Ex: 2 horas"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Tempo mínimo de antecedência exigido do cliente.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Antecedência Máxima (Dias)</label>
                  <input 
                    type="number" 
                    min="1"
                    required
                    value={agendaData.maxAdvanceDays}
                    onChange={(e) => setAgendaData({ ...agendaData, maxAdvanceDays: parseInt(e.target.value) || 1 })}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white font-mono"
                    placeholder="Ex: 60 dias"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Limite máximo de dias no futuro para reservas.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Duração Automática por Serviço</label>
                  <div className="flex items-center h-10">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={agendaData.autoBlockDuration}
                        onChange={(e) => setAgendaData({ ...agendaData, autoBlockDuration: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-850 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
                      <span className="ml-3 text-xs font-medium text-slate-300">Ativar Bloqueio Inteligente</span>
                    </label>
                  </div>
                  <p className="text-[10px] text-slate-400">Bloqueia o período correspondente com base no tempo estimado do serviço.</p>
                </div>
              </div>
            </div>

            {/* SEÇÃO 2: DIAS DE FUNCIONAMENTO */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4">
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-white border-b border-slate-850 pb-2.5 flex items-center gap-2">
                <Calendar size={14} className="text-sky-400" />
                Dias e Horários de Funcionamento Geral
              </h3>

              <div className="space-y-4">
                {agendaData.days.map((day: any) => (
                  <div key={day.dayOfWeek} className="p-4 bg-slate-950/40 border border-slate-800/60 rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    
                    {/* Dia e Status */}
                    <div className="flex items-center justify-between lg:justify-start gap-4 lg:w-1/4">
                      <span className="font-bold text-slate-200 text-xs w-28">{day.dayName}</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={day.isActive}
                          onChange={() => handleToggleDay(day.dayOfWeek)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-850 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500"></div>
                        <span className="ml-2 text-[10px] font-bold font-mono uppercase text-slate-400">
                          {day.isActive ? 'Aberto' : 'Fechado'}
                        </span>
                      </label>
                    </div>

                    {/* Inputs de Horários de Funcionamento */}
                    {day.isActive ? (
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1">
                        
                        {/* Abertura e Fechamento */}
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 text-[10px] uppercase font-mono">Expediente:</span>
                          <input 
                            type="time" 
                            value={day.openTime}
                            onChange={(e) => handleUpdateDayTime(day.dayOfWeek, 'openTime', e.target.value)}
                            className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-white text-xs font-mono focus:ring-1 focus:ring-sky-500 focus:outline-none"
                          />
                          <span className="text-slate-500">às</span>
                          <input 
                            type="time" 
                            value={day.closeTime}
                            onChange={(e) => handleUpdateDayTime(day.dayOfWeek, 'closeTime', e.target.value)}
                            className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-white text-xs font-mono focus:ring-1 focus:ring-sky-500 focus:outline-none"
                          />
                        </div>

                        {/* Intervalo de Almoço */}
                        <div className="flex items-center gap-4 border-l border-slate-805 pl-0 sm:pl-4">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={day.hasLunchBreak}
                              onChange={(e) => handleUpdateDayTime(day.dayOfWeek, 'hasLunchBreak', e.target.checked)}
                              className="rounded border-slate-800 bg-slate-900 text-sky-500 focus:ring-0"
                            />
                            <span className="text-slate-400 text-[10px] uppercase font-mono">Almoço</span>
                          </label>

                          {day.hasLunchBreak && (
                            <div className="flex items-center gap-1.5 animate-fadeIn">
                              <input 
                                type="time" 
                                value={day.lunchStart}
                                onChange={(e) => handleUpdateDayTime(day.dayOfWeek, 'lunchStart', e.target.value)}
                                className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-white text-xs font-mono focus:ring-1 focus:ring-sky-500 focus:outline-none"
                              />
                              <span className="text-slate-500">às</span>
                              <input 
                                type="time" 
                                value={day.lunchEnd}
                                onChange={(e) => handleUpdateDayTime(day.dayOfWeek, 'lunchEnd', e.target.value)}
                                className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-white text-xs font-mono focus:ring-1 focus:ring-sky-500 focus:outline-none"
                              />
                            </div>
                          )}
                        </div>

                      </div>
                    ) : (
                      <span className="text-slate-500 italic text-[11px] flex-1">Nenhum agendamento é permitido neste dia.</span>
                    )}

                  </div>
                ))}
              </div>
            </div>

            {/* SEÇÃO 3: GRADE DE HORÁRIOS PERSONALIZADA & CAPACIDADES */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4">
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-white border-b border-slate-850 pb-2.5 flex items-center gap-2">
                <Clock size={14} className="text-sky-400" />
                Grade de Horários & Capacidade de Veículos por Horário
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Lado Esquerdo: Formulário para Adicionar */}
                <div className="bg-slate-950/40 p-4 border border-slate-800/60 rounded-xl space-y-3 h-fit">
                  <span className="font-bold text-white text-xs block font-mono uppercase tracking-wider">Novo Horário</span>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase font-mono mb-1">Horário</label>
                      <input 
                        type="time" 
                        value={newSlotTime}
                        onChange={(e) => setNewSlotTime(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded-xl px-3 py-2 text-white font-mono"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase font-mono mb-1">Vagas Simultâneas</label>
                      <input 
                        type="number" 
                        min="1"
                        max="20"
                        value={newSlotCapacity}
                        onChange={(e) => setNewSlotCapacity(parseInt(e.target.value) || 1)}
                        className="w-full bg-slate-900 border border-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded-xl px-3 py-2 text-white font-mono"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleAddSlot}
                      className="w-full py-2 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-xs"
                    >
                      <Plus size={14} />
                      <span>Inserir Horário</span>
                    </button>
                  </div>
                </div>

                {/* Lado Direito: Listagem & Edição das Capacidades */}
                <div className="md:col-span-2 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-300 text-xs font-mono uppercase tracking-wider">Horários Ativos ({agendaData.timeSlots.length})</span>
                    <span className="text-[10px] text-slate-500">Defina quantos veículos podem ser atendidos por vez.</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[320px] overflow-y-auto pr-1">
                    {agendaData.timeSlots.map((slot: any) => (
                      <div key={slot.id} className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-center justify-between gap-3 text-xs">
                        
                        <div className="flex items-center gap-2">
                          <Clock size={13} className="text-sky-400" />
                          <span className="font-mono font-bold text-white text-[13px]">{slot.time}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-mono">Vagas:</span>
                          <input 
                            type="number" 
                            min="1"
                            value={slot.maxCapacity}
                            onChange={(e) => handleUpdateSlotCapacity(slot.id, parseInt(e.target.value) || 1)}
                            className="w-14 bg-slate-900 border border-slate-800 focus:outline-none rounded-lg px-2 py-1 text-white text-center font-mono focus:ring-1 focus:ring-sky-500"
                          />
                          
                          <button
                            type="button"
                            onClick={() => handleDeleteSlot(slot.id)}
                            className="p-1.5 hover:bg-red-500/10 hover:text-red-400 text-slate-500 rounded-lg transition-colors border border-transparent hover:border-red-500/20"
                            title="Remover horário"
                          >
                            <X size={13} />
                          </button>
                        </div>

                      </div>
                    ))}
                    
                    {agendaData.timeSlots.length === 0 && (
                      <p className="text-slate-500 text-center italic text-[11px] py-8 sm:col-span-2">Nenhum horário cadastrado. Adicione horários ao lado.</p>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* BOTAO SALVAR */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-850">
              <button 
                type="submit" 
                className="px-6 py-3 bg-sky-500 hover:bg-sky-600 font-bold text-xs text-white rounded-xl shadow-lg shadow-sky-500/20 flex items-center gap-2 transition-all cursor-pointer"
                id="btn-save-agenda-settings"
              >
                <Save size={15} />
                <span>Salvar Configurações da Agenda</span>
              </button>
            </div>

          </form>

        </div>
      )}
    </div>
  );
}
