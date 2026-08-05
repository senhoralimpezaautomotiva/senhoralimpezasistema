/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  ToggleLeft, 
  ToggleRight, 
  Play, 
  Check, 
  Server, 
  RefreshCw,
  Database,
  Copy,
  Search,
  Activity,
  AlertTriangle,
  FileText
} from 'lucide-react';
import { AutomationTrigger } from '../types';
import { dbInstance, hasModulePermission } from '../db/localDb';
import { adminApiFetch } from '../utils/adminApiClient';
import { safeLog } from '../security/safeOutput';
import { useManagedTimeout } from '../hooks/useManagedTimeout';
import {
  classifyAutomationExecutionOperationalState,
  summarizeAutomationOperations
} from '../db/automationMonitoring';

interface AutomacoesModuleProps {
  automations: AutomationTrigger[];
  currentUser?: any;
  onUpdateTrigger: (id: string, updated: Partial<AutomationTrigger>) => void;
}

export default function AutomacoesModule({ 
  automations, 
  currentUser,
  onUpdateTrigger
}: AutomacoesModuleProps) {
  const canEdit = hasModulePermission(currentUser, 'automacoes', 'edit');
  const scheduleTimeout = useManagedTimeout();
  const [activeSubTab, setActiveSubTab] = useState<'gatilhos' | 'logs' | 'make' | 'sql'>('gatilhos');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [tempTemplateText, setTempTemplateText] = useState('');
  const [copied, setCopied] = useState(false);

  // SaaS states for backend synchronization
  const [stats, setStats] = useState({
    executedToday: 0,
    successfulToday: 0,
    sentCount: 0,
    pendingCount: 0,
    errorCount: 0,
    successRate: 100,
    operationalStatus: 'healthy',
    stalledPendingCount: 0,
    activeClaimCount: 0,
    abandonedClaimCount: 0,
    ambiguousCount: 0,
    retryScheduledCount: 0,
    reconciliationRequiredCount: 0,
    lastExecutionTime: 'Nunca',
    nextExecutionTime: 'Nenhuma agendada'
  });
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [selectedExecId, setSelectedExecId] = useState<string | null>(null);
  const [isRunningCheck, setIsRunningCheck] = useState(false);
  const [testLog, setTestLog] = useState<string | null>(null);

  // Fetch live statistics and history of executions
  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const res = await adminApiFetch('/api/automations/dashboard');
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setHistory(data.history);
      } else {
        calculateLocalStats();
      }
    } catch (e) {
      calculateLocalStats();
    } finally {
      setIsLoading(false);
    }
  };

  const calculateLocalStats = () => {
    const executions = dbInstance.executions;
    const now = new Date();
    const operationalSummary = summarizeAutomationOperations(executions, now);
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
      ...operationalSummary,
      lastExecutionTime: lastExecution ? lastExecution.updated_at : 'Nunca',
      nextExecutionTime: nextExecution ? nextExecution.data_execucao : 'Nenhuma'
    });

    setHistory(sorted.map(e => {
      const customer = dbInstance.customers.find(c => c.id === e.customer_id);
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
        data_execucao: e.data_execucao,
        operational_state: classifyAutomationExecutionOperationalState(e, now)
      };
    }));
  };

  useEffect(() => {
    fetchDashboardData();
    const int = setInterval(fetchDashboardData, 15000); // refresh every 15s
    return () => clearInterval(int);
  }, [automations]);

  // Execute manual test via backend API
  const handleTestTriggerDirect = async (eventId: string) => {
    setIsRunningCheck(true);
    setTestLog('Disparando teste manual de envio no backend...');
    try {
      const res = await adminApiFetch(`/api/automations/test/${encodeURIComponent(eventId)}`, { method: 'POST' });
      if (res.ok) {
        const result = await res.json();
        setTestLog(result.success
          ? `Solicitação aceita pelo provedor.\nA entrega depende de confirmação externa.\nResposta API:\n${result.log}`
          : `Solicitação não aceita pelo provedor.\nNenhuma entrega foi confirmada.\nResposta API:\n${result.log}`);
        fetchDashboardData();
      } else {
        throw new Error('Falha na resposta do servidor.');
      }
    } catch (e: any) {
      safeLog('error', 'automation.manual_test', 'error', {
        entityId: eventId,
        error: e
      });
      setTestLog('Erro ao testar gatilho. Consulte o correlation ID do log.');
    } finally {
      setIsRunningCheck(false);
      scheduleTimeout(() => setTestLog(null), 8000);
    }
  };

  const handleStartEdit = (trigger: AutomationTrigger) => {
    if (!canEdit) return;
    setEditingTemplateId(trigger.id);
    setTempTemplateText(trigger.template);
  };

  const handleSaveEdit = (id: string) => {
    if (!canEdit) return;
    onUpdateTrigger(id, { template: tempTemplateText });
    setEditingTemplateId(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    scheduleTimeout(() => setCopied(false), 2000);
  };

  // Sample payload sent to Make
  const sampleMakePayload = `{
  "event": "servico_finalizado",
  "customer": {
    "name": "Bruno Ramos Silva",
    "phone": "(11) 98122-3344",
    "whatsapp": "5511981223344",
    "email": "bruno.silva@gmail.com",
    "cpf": "123.456.789-00",
    "city": "São Paulo"
  },
  "vehicle": {
    "brand": "Honda",
    "model": "Civic",
    "plate": "BRA3G21",
    "color": "Cinza Boreal"
  },
  "service": {
    "name": "Polimento Técnico Comercial",
    "basePrice": 850.00
  },
  "appointment": {
    "dateTime": "2026-07-15T09:00:00",
    "value": 850.00,
    "employeeId": "Gabriel"
  },
  "formattedMessage": "Excelente notícia, Bruno Ramos Silva! O serviço de Polimento Técnico Comercial..."
}`;

  const filteredHistory = history.filter(item => {
    const matchesSearch = 
      item.cliente.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.telefone.includes(searchQuery) ||
      item.mensagem.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'todos' || item.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-fadeIn" id="automacoes-module-view">
      
      {/* Module Overview & Navigation Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 p-6 rounded-2xl border border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <MessageSquare className="text-sky-400" size={22} />
            Central de Mensagens & Hub de Integrações
          </h1>
          <p className="text-xs text-slate-400 mt-1">Configure templates de disparo para o WhatsApp via Z-API, webhooks do Make.com e gerencie a fila.</p>
        </div>

        {/* Sub tabs navigation */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono font-medium">
          <button 
            onClick={() => setActiveSubTab('gatilhos')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${activeSubTab === 'gatilhos' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
          >
            Gatilhos WhatsApp
          </button>
          <button 
            onClick={() => setActiveSubTab('logs')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${activeSubTab === 'logs' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
          >
            Fila de Disparo / Logs
          </button>
          <button 
            onClick={() => setActiveSubTab('make')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${activeSubTab === 'make' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
          >
            Webhook Make
          </button>
          <button 
            onClick={() => setActiveSubTab('sql')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${activeSubTab === 'sql' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
          >
            Banco de Dados SQL
          </button>
        </div>
      </div>

      {/* QUICK STATS PANEL ON GATILHOS */}
      {activeSubTab === 'gatilhos' && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/80">
            <span className="text-[10px] font-mono uppercase text-slate-500">Execuções Hoje</span>
            <div className="text-lg font-bold text-white mt-1 flex items-center gap-1.5">
              <Activity size={14} className="text-sky-400" />
              {stats.executedToday}
            </div>
          </div>
          <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/80">
            <span className="text-[10px] font-mono uppercase text-slate-500">Aceitas pelo provedor</span>
            <div className="text-lg font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
              <Check size={14} />
              {stats.sentCount}
            </div>
          </div>
          <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/80">
            <span className="text-[10px] font-mono uppercase text-slate-500">Na Fila / Pendente</span>
            <div className="text-lg font-bold text-amber-400 mt-1 flex items-center gap-1.5">
              <RefreshCw size={14} className="animate-spin-slow" />
              {stats.pendingCount}
            </div>
            <div className={`text-[9px] mt-1 font-mono ${stats.stalledPendingCount > 0 ? 'text-rose-400' : 'text-slate-500'}`}>
              {stats.stalledPendingCount} atrasada(s) · {stats.retryScheduledCount} retry(s)
            </div>
          </div>
          <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/80">
            <span className="text-[10px] font-mono uppercase text-slate-500">Erros / Reconciliação</span>
            <div className="text-lg font-bold text-rose-500 mt-1 flex items-center gap-1.5">
              <AlertTriangle size={14} />
              {stats.errorCount}
            </div>
            <div className="text-[9px] mt-1 font-mono text-slate-500">
              {stats.reconciliationRequiredCount} requer(em) análise
            </div>
          </div>
          <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/80 col-span-2 md:col-span-1">
            <span className="text-[10px] font-mono uppercase text-slate-500">Taxa de aceitação</span>
            <div className="text-lg font-bold text-white mt-1">
              {stats.successRate}%
            </div>
          </div>
        </div>
      )}

      {/* FLOAT NOTIFICATION LOG FOR MANUALLY TRIGGERED TESTS */}
      {testLog && (
        <div className="bg-slate-900 border border-sky-500/30 text-sky-400 text-xs rounded-xl p-4 space-y-2 animate-fadeIn font-mono">
          <div className="font-bold flex items-center gap-2">
            <RefreshCw size={14} className="animate-spin" />
            <span>Processador de Teste Manual</span>
          </div>
          <pre className="text-[10px] text-slate-300 overflow-auto max-h-24 whitespace-pre-wrap leading-relaxed">{testLog}</pre>
        </div>
      )}

      {/* SUB-TAB 1: GATILHOS & TEMPLATES */}
      {activeSubTab === 'gatilhos' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
            <div>
              <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Status das Automações</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Ative ou desative gatilhos do WhatsApp e edite seus respectivos templates de mensagem.</p>
            </div>
            <button
              onClick={async () => {
                if (confirm('Tem certeza de que deseja restaurar TODAS as automações padrão? Isso substituirá as edições feitas nos templates atuais.')) {
                  setIsLoading(true);
                  try {
                    await dbInstance.restoreDefaultAutomations();
                    alert('Automações padrão restauradas com sucesso!');
                  } catch (e: any) {
                    safeLog('error', 'automation.restore_defaults', 'error', { error: e });
                    alert('Erro ao restaurar as automações padrão.');
                  } finally {
                    setIsLoading(false);
                  }
                }
              }}
              disabled={isLoading}
              className="px-3.5 py-2 bg-amber-500/10 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
              <span>Restaurar Automações Padrão</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-5">
            {automations.map((trigger) => {
              const isEditing = editingTemplateId === trigger.id;
              return (
                <div key={trigger.id} className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4 shadow-sm hover:border-slate-700/60 transition-all group">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-850 pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1 min-w-0">
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-white group-hover:text-sky-400 transition-colors flex items-center gap-2">
                          <MessageSquare size={16} className="text-slate-400" />
                          {trigger.name}
                        </h3>
                        <p className="text-xs text-slate-400 font-medium">{trigger.description}</p>
                      </div>

                      {trigger.event === 'cliente_inativo' && (
                        <div className="flex items-center gap-2.5 flex-wrap mt-2 sm:mt-0 sm:ml-4">
                          <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-850">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dias:</span>
                            <input
                              type="number"
                              min="1"
                              disabled={!canEdit}
                              value={trigger.inactiveDays ?? 30}
                              onChange={(e) => {
                                const val = Math.max(1, parseInt(e.target.value) || 0);
                                onUpdateTrigger(trigger.id, { inactiveDays: val });
                              }}
                              className="w-12 bg-slate-900 border border-slate-800 rounded px-1 text-center text-xs font-mono font-bold text-sky-400 focus:outline-none focus:border-sky-500 py-0.5"
                            />
                          </div>

                          <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-850">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Atendimentos:</span>
                            <input
                              type="number"
                              min="0"
                              disabled={!canEdit}
                              value={trigger.minServices ?? 1}
                              onChange={(e) => {
                                const val = Math.max(0, parseInt(e.target.value) || 0);
                                onUpdateTrigger(trigger.id, { minServices: val });
                              }}
                              className="w-12 bg-slate-900 border border-slate-800 rounded px-1 text-center text-xs font-mono font-bold text-sky-400 focus:outline-none focus:border-sky-500 py-0.5"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Toggle and test buttons */}
                    <div className="flex items-center gap-4 shrink-0">
                      <button 
                        onClick={() => handleTestTriggerDirect(trigger.id)}
                        disabled={isRunningCheck || !canEdit}
                        className="px-3 py-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-[10px] font-bold text-sky-400 rounded-lg transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <Play size={10} />
                        <span>Executar Agora (Teste)</span>
                      </button>

                      <button 
                        onClick={() => {
                          if (canEdit) onUpdateTrigger(trigger.id, { isActive: !trigger.isActive });
                        }}
                        disabled={!canEdit}
                        className="transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {trigger.isActive ? (
                          <ToggleRight size={34} className="text-sky-400 cursor-pointer" />
                        ) : (
                          <ToggleLeft size={34} className="text-slate-600 cursor-pointer" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Template message box */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-mono uppercase text-slate-400">
                      <span>Template de Mensagem</span>
                      <span className="text-[9px] text-sky-400 font-bold">Variáveis: &#123;nome&#125;, &#123;veiculo&#125;, &#123;data_hora&#125;, &#123;servico&#125;, &#123;valor&#125;</span>
                    </div>

                    {isEditing ? (
                      <div className="space-y-3">
                        <textarea 
                          value={tempTemplateText}
                          onChange={(e) => setTempTemplateText(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 font-sans focus:outline-none focus:ring-1 focus:ring-sky-500 h-28 resize-none"
                        />
                        <div className="flex gap-2 justify-end text-xs font-semibold">
                          <button 
                            onClick={() => setEditingTemplateId(null)}
                            className="px-3 py-1 bg-slate-850 hover:bg-slate-800 text-slate-400 rounded-lg cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button 
                            onClick={() => handleSaveEdit(trigger.id)}
                            className="px-3.5 py-1 bg-sky-500 hover:bg-sky-600 text-white rounded-lg flex items-center gap-1 cursor-pointer"
                          >
                            <Check size={12} />
                            <span>Salvar Template</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-950 rounded-xl p-3 border border-slate-850 relative group/box">
                        <p className="text-slate-300 font-medium text-xs leading-relaxed whitespace-pre-line">{trigger.template}</p>
                        <button 
                          onClick={() => handleStartEdit(trigger)}
                          className="absolute right-3 top-3 px-2 py-1 bg-slate-900 border border-slate-800 text-[10px] text-slate-300 hover:text-white rounded-lg opacity-0 group-hover/box:opacity-100 transition-opacity cursor-pointer"
                        >
                          Editar Template
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: SAAS REAL-TIME LOGS DE DISPARO */}
      {activeSubTab === 'logs' && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4 shadow-sm">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-850 pb-4">
            <div>
              <h3 className="text-sm font-bold text-white font-mono uppercase flex items-center gap-2">
                <FileText size={16} className="text-sky-400" />
                Fila Geral de Disparo e Logs em Tempo Real
              </h3>
              <p className="text-xs text-slate-400 mt-1">Acompanhe todos os disparos da fila de automações, tentativas de envio e respostas da API do backend em tempo real.</p>
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-medium"
              >
                <option value="todos">Todos os Status</option>
                <option value="pendente">Fila / Pendente</option>
                <option value="processando">Processando</option>
                <option value="sucesso">Aceita pelo provedor</option>
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
                    <th className="p-3 text-center">Tentativas</th>
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
                            {item.status === 'sucesso'
                              ? 'aceita'
                              : item.status === 'erro_definitivo'
                                ? 'falhou'
                                : item.status}
                          </span>
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => setSelectedExecId(selectedExecId === item.id ? null : item.id)}
                            className="px-2.5 py-1 bg-slate-950 border border-slate-800 text-[10px] font-bold text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer"
                          >
                            {selectedExecId === item.id ? 'Fechar' : 'Detalhes'}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable details block */}
                      {selectedExecId === item.id && (
                        <tr className="bg-slate-950/60">
                          <td colSpan={7} className="p-4 border-t border-b border-slate-850">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                              <div className="space-y-2 bg-slate-950 p-3 rounded-lg border border-slate-850">
                                <span className="text-[10px] text-sky-400 uppercase font-bold">Conteúdo solicitado ao provedor</span>
                                <p className="text-slate-300 font-sans whitespace-pre-wrap leading-relaxed">
                                  {item.mensagem}
                                </p>
                              </div>

                              <div className="space-y-2 bg-slate-950 p-3 rounded-lg border border-slate-850">
                                <span className="text-[10px] text-sky-400 uppercase font-bold">Resposta da API / Logs do Servidor</span>
                                {item.operational_state === 'abandoned_claim' || item.operational_state === 'ambiguous' ? (
                                  <p className="text-[10px] text-rose-400 font-bold uppercase">Reenvio automático bloqueado · reconciliação necessária</p>
                                ) : null}
                                <pre className="text-slate-400 text-[10px] overflow-auto max-h-36 whitespace-pre-wrap font-mono">
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
      )}

      {/* SUB-TAB 3: WEBHOOK DO MAKE.COM */}
      {activeSubTab === 'make' && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-5 shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
            <Server className="text-indigo-400" size={18} />
            <h3 className="text-sm font-bold text-white font-mono uppercase">Configuração de Webhook do Make (Integromat)</h3>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed font-medium">
            O webhook do Make é disparado automaticamente em tempo real a cada evento do sistema.
            Se você cadastrou o endereço de Webhook na aba <strong>Configurações</strong>, o sistema enviará um payload JSON contendo o cliente, carro, e dados do agendamento de forma assíncrona.
          </p>

          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs font-bold text-white font-mono uppercase mt-4">
              <span>Modelo de Payload JSON Enviado</span>
              <button 
                onClick={() => copyToClipboard(sampleMakePayload)}
                className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                <span>{copied ? 'Copiado!' : 'Copiar Payload'}</span>
              </button>
            </div>
            <pre className="bg-slate-950 border border-slate-850 rounded-xl p-4 text-[10px] text-slate-300 overflow-x-auto font-mono max-h-80">
              {sampleMakePayload}
            </pre>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: BANCO DE DADOS SQL */}
      {activeSubTab === 'sql' && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-5 shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
            <Database className="text-sky-400" size={18} />
            <h3 className="text-sm font-bold text-white font-mono uppercase">Estrutura SQL Completa do Banco (Supabase / Postgres)</h3>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed font-medium">
            Copie o script de consulta SQL completo abaixo para criar toda a estrutura relacional do sistema na sua instância Supabase ou servidor PostgreSQL local. O script já prevê todas as chaves primárias, chaves estrangeiras, índices de performance e inserções padrão.
          </p>

          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs font-bold text-white font-mono uppercase">
              <span>Script de Criação de Tabelas (DDL)</span>
              <button 
                onClick={() => copyToClipboard(dbInstance.getPostgresSchemaSql())}
                className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                <span>{copied ? 'Copiado!' : 'Copiar Script SQL'}</span>
              </button>
            </div>
            <pre className="bg-slate-950 border border-slate-850 rounded-xl p-4 text-[10px] text-slate-300 overflow-x-auto font-mono max-h-80 select-all">
              {dbInstance.getPostgresSchemaSql()}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
