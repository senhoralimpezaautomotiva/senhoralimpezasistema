/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Clock, 
  Check, 
  Play, 
  ToggleLeft, 
  ToggleRight,
  RefreshCw,
  Calendar,
  Search,
  AlertTriangle,
  Activity,
  FileText
} from 'lucide-react';
import { Appointment, AutomationTrigger, Customer, Vehicle, Service } from '../types';
import { dbInstance, hasModulePermission } from '../db/localDb';
import { adminApiFetch } from '../utils/adminApiClient';
import { safeLog } from '../security/safeOutput';
import { useManagedTimeout } from '../hooks/useManagedTimeout';

interface AutomacoesTabProps {
  automations: AutomationTrigger[];
  appointments: Appointment[];
  customers: Customer[];
  vehicles: Vehicle[];
  services: Service[];
  currentUser?: any;
  onUpdateTrigger: (id: string, updated: Partial<AutomationTrigger>) => void;
  onSyncNeeded: () => void;
}

export default function AutomacoesTab({
  automations,
  appointments,
  customers,
  vehicles,
  services,
  currentUser,
  onUpdateTrigger,
  onSyncNeeded
}: AutomacoesTabProps) {
  const canEdit = hasModulePermission(currentUser, 'automacoes', 'edit');
  const scheduleTimeout = useManagedTimeout();
  // Original UI states
  const [isRunningCheck, setIsRunningCheck] = useState(false);
  const [engineLogs, setEngineLogs] = useState<string[]>([]);
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);

  // New SaaS stats and history states
  const [stats, setStats] = useState({
    executedToday: 0,
    successfulToday: 0,
    sentCount: 0,
    pendingCount: 0,
    errorCount: 0,
    successRate: 100,
    lastExecutionTime: 'Nunca',
    nextExecutionTime: 'Nenhuma agendada'
  });
  const [history, setHistory] = useState<any[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [selectedExecId, setSelectedExecId] = useState<string | null>(null);

  // Operational Window states
  const [startHour, setStartHour] = useState(dbInstance.config.automationStartHour || '08:00');
  const [endHour, setEndHour] = useState(dbInstance.config.automationEndHour || '20:00');
  const [automation24Hours, setAutomation24Hours] = useState(dbInstance.config.automation24Hours === true);
  const [isSavingHours, setIsSavingHours] = useState(false);
  const [saveHoursSuccess, setSaveHoursSuccess] = useState(false);

  // Find the 'lembrete_agendamento' automation trigger
  const reminderAutomation = automations.find(a => a.event === 'lembrete_agendamento');
  const [templateText, setTemplateText] = useState(reminderAutomation?.template || '');

  useEffect(() => {
    if (reminderAutomation) {
      setTemplateText(reminderAutomation.template);
    }
  }, [reminderAutomation]);

  // Load Dashboard Data from server
  const loadDashboardData = async () => {
    setIsLoadingStats(true);
    try {
      const res = await adminApiFetch('/api/automations/dashboard');
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setHistory(data.history);
      } else {
        fallbackLocalData();
      }
    } catch (e) {
      fallbackLocalData();
    } finally {
      setIsLoadingStats(false);
    }
  };

  // Local calculations fallback
  const fallbackLocalData = () => {
    const executions = dbInstance.executions;
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const executionsToday = executions.filter(e => e.updated_at.startsWith(todayStr));
    const successfulToday = executionsToday.filter(e => e.status === 'sucesso').length;
    const sentCount = executions.filter(e => e.status === 'sucesso').length;
    const pendingCount = executions.filter(e => e.status === 'pendente').length;
    const errorCount = executions.filter(e => e.status === 'erro_definitivo').length;
    const totalFinalized = sentCount + errorCount;
    const successRate = totalFinalized > 0 ? Math.round((sentCount / totalFinalized) * 100) : 100;
    
    const sorted = [...executions].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    const lastExecution = sorted[0] || null;
    const pendingSorted = executions
      .filter(e => e.status === 'pendente')
      .sort((a, b) => new Date(a.data_execucao).getTime() - new Date(b.data_execucao).getTime());
    const nextExecution = pendingSorted[0] || null;

    setStats({
      executedToday: executionsToday.length,
      successfulToday,
      sentCount,
      pendingCount,
      errorCount,
      successRate,
      lastExecutionTime: lastExecution ? new Date(lastExecution.updated_at).toLocaleTimeString() : 'Nunca',
      nextExecutionTime: nextExecution ? new Date(nextExecution.data_execucao).toLocaleTimeString() : 'Nenhuma'
    });

    setHistory(sorted.map(e => {
      const customer = customers.find(c => c.id === e.customer_id);
      const trigger = automations.find(a => a.event === e.automacao);
      return {
        id: e.id,
        horario: e.updated_at,
        cliente: customer ? customer.name : 'Cliente',
        telefone: e.telefone,
        automacao: trigger ? trigger.name : e.automacao,
        mensagem: e.mensagem,
        status: e.status,
        tentativas: e.tentativas,
        resposta_api: e.resposta_api,
        data_execucao: e.data_execucao
      };
    }));
  };

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 15000); // refresh every 15 seconds
    return () => clearInterval(interval);
  }, [appointments, automations]);

  // Handle manual execution check via backend API (runs full background engine cycle)
  const handleManualCheck = async () => {
    setIsRunningCheck(true);
    setEngineLogs([`[Console] Iniciando varredura da fila no backend...`]);
    
    try {
      const res = await adminApiFetch('/api/automations/run-cycle', { method: 'POST' });
      if (res.ok) {
        const result = await res.json();
        const timeStr = new Date().toLocaleTimeString('pt-BR');
        
        setEngineLogs(prev => [
          ...prev,
          `[Console] Varredura concluída às ${timeStr}.`,
          `[Console] Automações geradas: ${result.generated} | Processadas: ${result.processed}`,
          ...result.logs
        ]);
        
        loadDashboardData();
        onSyncNeeded();
      } else {
        throw new Error('Erro na resposta do servidor.');
      }
    } catch (e: any) {
      safeLog('error', 'automation.queue.process', 'error', { error: e });
      setEngineLogs(prev => [...prev, '[Erro] Falha ao acionar o processador. Consulte o correlation ID do log.']);
    } finally {
      setIsRunningCheck(false);
    }
  };

  // Handle manual test run for specific automation via backend API
  const handleExecuteNow = async (id: string) => {
    setIsRunningCheck(true);
    setEngineLogs([`[Console] Executando envio forçado de teste para o gatilho...`]);
    try {
      const res = await adminApiFetch(`/api/automations/test/${encodeURIComponent(id)}`, { method: 'POST' });
      if (res.ok) {
        const result = await res.json();
        const timeStr = new Date().toLocaleTimeString('pt-BR');
        setEngineLogs(prev => [
          ...prev,
          `[Console] Executado com sucesso às ${timeStr}!`,
          `[Servidor] ${result.log}`
        ]);
        loadDashboardData();
        onSyncNeeded();
      } else {
        throw new Error('Falha de resposta do servidor.');
      }
    } catch (e: any) {
      safeLog('error', 'automation.queue.force_trigger', 'error', { error: e });
      setEngineLogs(prev => [...prev, '[Erro] Falha no disparo forçado. Consulte o correlation ID do log.']);
    } finally {
      setIsRunningCheck(false);
    }
  };

  // Handle operational window settings saving
  const handleSaveOperationalHours = async () => {
    setIsSavingHours(true);
    try {
      dbInstance.config.automationStartHour = startHour;
      dbInstance.config.automationEndHour = endHour;
      dbInstance.config.automation24Hours = automation24Hours;
      dbInstance.save();
      
      if (dbInstance.config.useRealSupabase) {
        const saved = await dbInstance.saveConfigToSupabase();
        if (!saved) {
          throw new Error('Não foi possível persistir a janela operacional.');
        }
      }
      
      setSaveHoursSuccess(true);
      scheduleTimeout(() => setSaveHoursSuccess(false), 3000);
      loadDashboardData();
    } catch (err) {
      safeLog('error', 'automation.dashboard.load', 'error', { error: err });
    } finally {
      setIsSavingHours(false);
    }
  };

  const handleToggleActive = () => {
    if (!reminderAutomation || !canEdit) return;
    onUpdateTrigger(reminderAutomation.id, { isActive: !reminderAutomation.isActive });
  };

  const handleSaveTemplate = () => {
    if (!reminderAutomation || !canEdit) return;
    onUpdateTrigger(reminderAutomation.id, { template: templateText });
    setIsEditingTemplate(false);
  };

  // Get upcoming appointments in the next 60 minutes
  const getUpcoming60MinAppointments = () => {
    const now = new Date();
    const limit = new Date(now.getTime() + 60 * 60 * 1000);
    
    return appointments.filter(appt => {
      if (appt.status === 'cancelado') return false;
      try {
        const apptDate = new Date(appt.dateTime);
        if (isNaN(apptDate.getTime())) return false;
        return apptDate >= now && apptDate <= limit;
      } catch (e) {
        return false;
      }
    });
  };

  const upcomingAppts = getUpcoming60MinAppointments();

  // Filter history based on search query and status filter
  const filteredHistory = history.filter(item => {
    const matchesSearch = 
      item.cliente.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.telefone.includes(searchQuery) ||
      item.mensagem.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'todos' || item.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-fadeIn" id="automacoes-novas-tab-view">
      
      {/* Tab Overview Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 p-6 rounded-2xl border border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Zap className="text-amber-400 animate-pulse" size={22} />
            Central de Automações em Segundo Plano
          </h1>
          <p className="text-xs text-slate-400 mt-1">Configure regras de disparo recorrentes e acompanhe a fila de envio do backend em tempo real.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={loadDashboardData}
            disabled={isLoadingStats}
            className="p-2 bg-slate-950 border border-slate-800 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-mono"
            title="Atualizar Dados"
          >
            <RefreshCw size={13} className={isLoadingStats ? 'animate-spin' : ''} />
            <span>Atualizar</span>
          </button>
          
          <div className="flex items-center gap-2 font-mono text-[10px] text-slate-400 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-850">
            <Clock size={12} className="text-amber-400 animate-spin-slow" />
            <span>Frequência: 60s (SaaS Backend)</span>
          </div>
        </div>
      </div>

      {/* SECTION 1: REAL-TIME DASHBOARD PANEL (Requirement 6) */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        
        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-1 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-full blur-xl pointer-events-none" />
          <span className="text-[10px] font-mono uppercase text-slate-500">Executadas Hoje</span>
          <div className="text-xl font-bold text-white tracking-tight flex items-center gap-1.5 mt-1">
            <Activity size={16} className="text-blue-400" />
            {stats.executedToday}
          </div>
        </div>

        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-1 relative overflow-hidden">
          <span className="text-[10px] font-mono uppercase text-slate-500">Mensagens Enviadas</span>
          <div className="text-xl font-bold text-emerald-400 tracking-tight flex items-center gap-1.5 mt-1">
            <Check size={16} className="text-emerald-400" />
            {stats.sentCount}
          </div>
        </div>

        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-1 relative overflow-hidden">
          <span className="text-[10px] font-mono uppercase text-slate-500">Fila Pendente</span>
          <div className="text-xl font-bold text-amber-400 tracking-tight flex items-center gap-1.5 mt-1">
            <Clock size={16} className="text-amber-400" />
            {stats.pendingCount}
          </div>
        </div>

        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-1 relative overflow-hidden">
          <span className="text-[10px] font-mono uppercase text-slate-500">Erros de Envio</span>
          <div className="text-xl font-bold text-rose-500 tracking-tight flex items-center gap-1.5 mt-1">
            <AlertTriangle size={16} className="text-rose-500" />
            {stats.errorCount}
          </div>
        </div>

        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-1 relative overflow-hidden">
          <span className="text-[10px] font-mono uppercase text-slate-500">Taxa de Sucesso</span>
          <div className="text-xl font-bold text-white tracking-tight mt-1 flex items-center gap-1">
            <span>{stats.successRate}%</span>
            <span className="text-[9px] text-emerald-400 font-mono font-normal">OK</span>
          </div>
        </div>

        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-1 relative overflow-hidden col-span-2 md:col-span-1">
          <span className="text-[10px] font-mono uppercase text-slate-500">Última Execução</span>
          <div className="text-[11px] font-bold text-slate-300 truncate mt-1.5">
            {stats.lastExecutionTime.includes('T') ? new Date(stats.lastExecutionTime).toLocaleTimeString('pt-BR') : stats.lastExecutionTime}
          </div>
          <div className="text-[9px] text-slate-500 truncate font-mono mt-0.5">Prox: {stats.nextExecutionTime}</div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: AUTOMATION GATILHO & OPERATIONAL WINDOW */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* CARD: LEMBRETE DE AGENDAMENTO TRIGGER */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-sm hover:border-slate-700/60 transition-all space-y-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-850 pb-4">
              <div>
                <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full uppercase tracking-wider font-mono">
                  Rotina de Tempo (Cron)
                </span>
                <h2 className="text-base font-bold text-white mt-2 flex items-center gap-2">
                  <Clock className="text-slate-400" size={18} />
                  Lembrete de Agendamento
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Varredura de agendamentos futuros entre agora e 60 minutos à frente. O backend enfileira e envia o lembrete automaticamente.
                </p>
              </div>

              {reminderAutomation && (
                <button 
                  onClick={handleToggleActive}
                  className="transition-all shrink-0 cursor-pointer"
                  title={reminderAutomation.isActive ? "Desativar Automação" : "Ativar Automação"}
                >
                  {reminderAutomation.isActive ? (
                    <ToggleRight size={38} className="text-amber-400" />
                  ) : (
                    <ToggleLeft size={38} className="text-slate-600" />
                  )}
                </button>
              )}
            </div>

            {/* Template editor */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] font-mono uppercase text-slate-400">
                <span>Template da Mensagem de Lembrete</span>
                <span className="text-[9px] text-amber-400 font-bold">Tags: &#123;nome&#125;, &#123;veiculo&#125;, &#123;data_hora&#125;, &#123;servico&#125;</span>
              </div>

              {isEditingTemplate ? (
                <div className="space-y-3">
                  <textarea 
                    value={templateText}
                    onChange={(e) => setTemplateText(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 font-sans focus:outline-none focus:ring-1 focus:ring-amber-500 h-28 resize-none"
                  />
                  <div className="flex gap-2 justify-end text-xs font-semibold">
                    <button 
                      onClick={() => {
                        setTemplateText(reminderAutomation?.template || '');
                        setIsEditingTemplate(false);
                      }}
                      className="px-3 py-1.5 bg-slate-850 hover:bg-slate-800 text-slate-400 rounded-lg cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={handleSaveTemplate}
                      className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg flex items-center gap-1 cursor-pointer"
                    >
                      <Check size={12} />
                      <span>Salvar Template</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-950 rounded-xl p-3 border border-slate-850 relative group/rembox">
                  <p className="text-slate-300 font-medium text-xs leading-relaxed whitespace-pre-line">
                    {reminderAutomation?.template || 'Nenhum template cadastrado.'}
                  </p>
                  {canEdit && (
                    <button 
                      onClick={() => setIsEditingTemplate(true)}
                      className="absolute right-3 top-3 px-2 py-1 bg-slate-900 border border-slate-800 text-[10px] text-slate-300 hover:text-white rounded-lg opacity-0 group-hover/rembox:opacity-100 transition-opacity cursor-pointer"
                    >
                      Editar Template
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Quick dashboard for the routine */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-850 space-y-1">
                <span className="text-[10px] uppercase font-mono text-slate-500">Varredura Automática</span>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${reminderAutomation?.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                  <span className="text-xs font-bold text-white">{reminderAutomation?.isActive ? 'Ativa e Monitorando' : 'Desativada'}</span>
                </div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-850 space-y-1">
                <span className="text-[10px] uppercase font-mono text-slate-500">Ação Forçada</span>
                {reminderAutomation && (
                  <button 
                    onClick={() => handleExecuteNow(reminderAutomation.id)}
                    disabled={isRunningCheck || !reminderAutomation.isActive}
                    className="w-full py-1.5 px-2 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                    title="Forçar envio de teste imediatamente"
                  >
                    <Play size={10} />
                    <span>Executar Agora (Teste)</span>
                  </button>
                )}
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-850 space-y-1">
                <span className="text-[10px] uppercase font-mono text-slate-500">Forçar Varredura</span>
                <button 
                  onClick={handleManualCheck}
                  disabled={isRunningCheck || !reminderAutomation?.isActive}
                  className="w-full py-1.5 px-2.5 bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-50 text-amber-400 border border-amber-500/20 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isRunningCheck ? (
                    <RefreshCw size={10} className="animate-spin" />
                  ) : (
                    <RefreshCw size={10} />
                  )}
                  <span>Varrer Fila Backend</span>
                </button>
              </div>
            </div>

            {/* Real-time console logger */}
            {engineLogs.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-mono uppercase text-slate-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Logs de Execução do Processador
                </span>
                <div className="bg-slate-950 border border-slate-850 rounded-xl p-3 font-mono text-[10px] text-slate-300 space-y-1 max-h-36 overflow-y-auto scrollbar-thin">
                  {engineLogs.map((log, idx) => (
                    <div key={idx} className={log.startsWith('[Erro]') ? 'text-rose-400' : log.startsWith('[Console]') ? 'text-amber-400' : 'text-slate-300'}>
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* CARD: OPERATIONAL WINDOW (Requirement 7) */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-850 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Clock size={16} className="text-amber-400" />
                  Configurar Janela Operacional das Automações
                </h3>
                <p className="text-xs text-slate-400 mt-1">Defina a janela de horários permitida para disparo automático no backend.</p>
              </div>

              {saveHoursSuccess && (
                <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-[10px] font-bold uppercase animate-fadeIn">
                  Salvo!
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Horário de Início</span>
                <input 
                  type="time" 
                  value={startHour}
                  onChange={(e) => setStartHour(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:ring-1 focus:ring-amber-500 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Horário de Término</span>
                <input 
                  type="time" 
                  value={endHour}
                  onChange={(e) => setEndHour(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:ring-1 focus:ring-amber-500 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none"
                />
              </div>
            </div>

            <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
              <span>
                <span className="block text-xs font-bold text-white">Envios 24 horas</span>
                <span className="block text-[10px] text-slate-400">
                  Ignora a janela operacional enquanto estiver ligado.
                </span>
              </span>
              <input
                type="checkbox"
                checked={automation24Hours}
                onChange={(event) => setAutomation24Hours(event.target.checked)}
                className="h-4 w-4 accent-emerald-500"
              />
            </label>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleSaveOperationalHours}
                disabled={isSavingHours}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition-all shadow-md shadow-amber-500/10"
              >
                {isSavingHours ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                <span>Salvar Janela Operacional</span>
              </button>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: ELIGIBLE APPOINTMENTS FOR LEMBRETE */}
        <div className="space-y-6">
          
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Calendar size={16} className="text-slate-400" />
                Agendamentos Elegíveis (Próximos 60m)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Agendamentos detectados na varredura iminente de 60 minutos.
              </p>
            </div>

            {upcomingAppts.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs italic bg-slate-950/20 rounded-xl border border-slate-850/60">
                Nenhum agendamento previsto para os próximos 60 minutos. Use o módulo de Agenda para criar um teste.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {upcomingAppts.map(appt => {
                  const cust = customers.find(c => c.id === appt.customerId);
                  const veh = vehicles.find(v => v.id === appt.vehicleId);
                  const srv = services.find(s => s.id === appt.serviceId);
                  
                  return (
                    <div key={appt.id} className="p-3 bg-slate-950 rounded-xl border border-slate-850 flex items-center justify-between gap-4 text-xs font-medium">
                      <div className="min-w-0">
                        <div className="text-white font-bold truncate">{cust?.name || 'Cliente Desconhecido'}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {veh?.brand} {veh?.model} | {srv?.name || 'Serviço'}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 shrink-0 font-mono text-[10px]">
                        <div>
                          <span className="text-white font-bold">{appt.dateTime.split('T')[1]}</span>
                        </div>
                        
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase ${
                          appt.reminderSent
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {appt.reminderSent ? 'Enviado' : 'Pendente'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* SECTION 2: FULL HISTORY OF EXECUTIONS (Requirement 9) */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-850 pb-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2 uppercase font-mono">
              <FileText size={16} className="text-amber-400" />
              Histórico de Execuções e Fila Completa
            </h3>
            <p className="text-xs text-slate-400 mt-1">Acompanhe todos os disparos da fila de automações, tentativas de envio e respostas da API do backend.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-2.5 text-slate-500" size={14} />
              <input 
                type="text" 
                placeholder="Buscar cliente, tel ou mensagem..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
            >
              <option value="todos">Todos os Status</option>
              <option value="pendente">Fila / Pendente</option>
              <option value="processando">Processando</option>
              <option value="sucesso">Sucesso</option>
              <option value="erro_definitivo">Erro Permanente</option>
            </select>
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs italic bg-slate-950/20 rounded-xl border border-slate-850">
            Nenhuma execução de automação encontrada com os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-850 rounded-xl">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="bg-slate-950 text-[10px] font-mono text-slate-400 uppercase border-b border-slate-850">
                <tr>
                  <th className="p-3">Horário / Data</th>
                  <th className="p-3">Destinatário</th>
                  <th className="p-3">Automação</th>
                  <th className="p-3">Mensagem Normalizada</th>
                  <th className="p-3">Tentativas</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {filteredHistory.map((item) => (
                  <React.Fragment key={item.id}>
                    <tr className="hover:bg-slate-850/40 transition-colors">
                      <td className="p-3 font-mono text-[10px] whitespace-nowrap">
                        {new Date(item.horario).toLocaleString('pt-BR')}
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-white">{item.cliente}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{item.telefone}</div>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="font-mono text-[10px] bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
                          {item.automacao}
                        </span>
                      </td>
                      <td className="p-3 max-w-xs truncate" title={item.mensagem}>
                        {item.mensagem}
                      </td>
                      <td className="p-3 font-mono text-center">
                        {item.tentativas} / 3
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                          item.status === 'sucesso' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : item.status === 'pendente'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : item.status === 'processando'
                                ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20 animate-pulse'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {item.status === 'erro_definitivo' ? 'falhou' : item.status}
                        </span>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => setSelectedExecId(selectedExecId === item.id ? null : item.id)}
                          className="px-2.5 py-1 bg-slate-950 border border-slate-800 text-[10px] font-bold text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer"
                        >
                          {selectedExecId === item.id ? 'Fechar' : 'Ver Detalhes'}
                        </button>
                      </td>
                    </tr>

                    {/* Detailed expandable execution report */}
                    {selectedExecId === item.id && (
                      <tr className="bg-slate-950/60">
                        <td colSpan={7} className="p-4 border-t border-b border-slate-850">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                            <div className="space-y-2 bg-slate-950 p-3 rounded-lg border border-slate-850">
                              <span className="text-[10px] text-amber-400 uppercase font-bold">Conteúdo do Envio</span>
                              <p className="text-slate-300 font-sans whitespace-pre-wrap leading-relaxed">
                                {item.mensagem}
                              </p>
                            </div>

                            <div className="space-y-2 bg-slate-950 p-3 rounded-lg border border-slate-850">
                              <span className="text-[10px] text-amber-400 uppercase font-bold">Resposta da API / logs de Integração</span>
                              <pre className="text-slate-400 text-[10px] overflow-auto max-h-36 whitespace-pre-wrap">
                                {item.resposta_api || 'Nenhum log retornado ainda. Aguardando processamento da fila.'}
                              </pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

    </div>
  );
}
