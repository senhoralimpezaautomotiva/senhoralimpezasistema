/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useEffect } from 'react';
import { 
  Gift, 
  Users, 
  Sparkles, 
  CheckCircle2, 
  Search,
  ArrowRight,
  TrendingUp,
  Percent,
  Check
} from 'lucide-react';
import { Customer, Appointment, SystemConfig } from '../types';
import { hasModulePermission } from '../db/localDb';

interface IndicacoesModuleProps {
  customers: Customer[];
  appointments: Appointment[];
  config: SystemConfig;
  currentUser?: any;
  onUpdateConfig?: (updated: Partial<SystemConfig>) => void;
}

export default function IndicacoesModule({ customers, appointments, config, currentUser, onUpdateConfig }: IndicacoesModuleProps) {
  const canEdit = hasModulePermission(currentUser, 'indicacoes', 'edit');
  const [searchTerm, setSearchTerm] = useState('');
  const [bonusPercentInput, setBonusPercentInput] = useState(config.referralDiscountPercent ?? 10);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  // Sync state if config prop changes
  useEffect(() => {
    setBonusPercentInput(config.referralDiscountPercent ?? 10);
  }, [config.referralDiscountPercent]);

  const handleSaveConfig = () => {
    if (onUpdateConfig) {
      onUpdateConfig({ referralDiscountPercent: bonusPercentInput });
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 3000);
    }
  };

  // Helper to format values as currency (BRL)
  const formatBRL = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '—';
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // 1. Calculate Metrics
  const metrics = useMemo(() => {
    // Total indicated customers
    const indicatedCustomers = customers.filter(c => 
      (c.referredBy && c.referredBy.trim() !== '') || 
      c.origin === 'Indicação' || 
      c.origin === 'Indicação sem código'
    );
    const totalIndications = indicatedCustomers.length;

    // Converted indications: indicated customers who have at least 1 completed/concluded appointment
    const convertedIndications = indicatedCustomers.filter(customer => {
      const finished = appointments.some(appt => 
        appt.customerId === customer.id && 
        (appt.status === 'finalizado' || appt.status === 'entregue')
      );
      return finished;
    }).length;

    // Total credits available (both referrers and recommended who have discount available)
    const totalCreditsAvailable = customers.filter(c => c.referralDiscountAvailable).length;

    // Total credits used
    const totalCreditsUsed = customers.filter(c => c.referralDiscountUsed).length;

    // Conversion rate: % of indicated customers who completed a service
    const conversionRate = totalIndications > 0 
      ? Math.round((convertedIndications / totalIndications) * 100) 
      : 0;

    const withCodeCount = indicatedCustomers.filter(c => c.referredBy && c.referredBy.trim() !== '').length;
    const withoutCodeCount = totalIndications - withCodeCount;

    return {
      totalIndications,
      convertedIndications,
      totalCreditsAvailable,
      totalCreditsUsed,
      conversionRate,
      withCodeCount,
      withoutCodeCount
    };
  }, [customers, appointments]);

  // 2. Generate referral records
  const referralRecords = useMemo(() => {
    const list = [];
    const indicatedCustomers = customers.filter(c => 
      (c.referredBy && c.referredBy.trim() !== '') || 
      c.origin === 'Indicação' || 
      c.origin === 'Indicação sem código'
    );

    for (const recommended of indicatedCustomers) {
      const hasReferrer = recommended.referredBy && recommended.referredBy.trim() !== '';
      // Find the referrer (the one who owned the code)
      const referrer = hasReferrer ? customers.find(c => c.id === recommended.referredBy) : null;

      // Determine credit status
      let status: 'pending' | 'available' | 'used' | 'no_reward' = 'pending';
      if (!hasReferrer) {
        status = 'no_reward';
      } else if (recommended.referralDiscountUsed) {
        status = 'used';
      } else if (recommended.referralDiscountAvailable) {
        status = 'available';
      }

      let percentUsed = recommended.referralBonusPercentUsed;
      let serviceValue = recommended.referralServiceValue;
      let bonusAmount = recommended.referralBonusAmount;

      // Dynamic fallback lookup for completed referrals that don't have the new stored fields yet
      if (hasReferrer && (status === 'available' || status === 'used') && (!percentUsed || !serviceValue || !bonusAmount)) {
        const finishedAppts = appointments.filter(a => a.customerId === recommended.id && (a.status === 'finalizado' || a.status === 'entregue'));
        if (finishedAppts.length > 0) {
          serviceValue = finishedAppts[0].value;
          percentUsed = config.referralDiscountPercent ?? 10;
          bonusAmount = Number(((serviceValue * percentUsed) / 100).toFixed(2));
        }
      }

      list.push({
        id: recommended.id,
        referrerName: referrer ? referrer.name : (hasReferrer ? 'Cliente Estética' : 'Nulo'),
        referrerPhone: referrer ? referrer.phone : '',
        recommendedName: recommended.name,
        recommendedPhone: recommended.phone,
        createdAt: recommended.referralCreatedAt || recommended.clientSince || '',
        status,
        hasCode: hasReferrer,
        percentUsed: percentUsed || null,
        serviceValue: serviceValue || null,
        bonusAmount: bonusAmount || null
      });
    }

    // Filter by search term and type
    return list.filter(r => 
      r.referrerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.recommendedName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.hasCode ? 'com código' : 'sem código').includes(searchTerm.toLowerCase())
    );
  }, [customers, appointments, config, searchTerm]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fadeIn" id="referrals-module-view">
      
      {/* Title Header */}
      <div className="flex justify-between items-center bg-slate-900 p-6 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3">
          <Gift className="text-sky-500" size={22} />
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Painel do Programa de Indicação</h2>
            <p className="text-xs text-slate-400 mt-0.5">Monitore o desempenho do "Indique um Amigo", controle liberação de créditos e verifique conversões.</p>
          </div>
        </div>
      </div>

      {/* Configuration Section (Configuração do Programa de Indicação) */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Percent className="text-sky-500" size={16} />
            <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-white">Configuração do Programa de Indicação</h3>
          </div>
          <span className={`px-2.5 py-0.5 border text-[9px] font-bold rounded-md font-mono uppercase ${
            config.referralActive 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' 
              : 'bg-slate-950/60 text-slate-500 border-slate-800'
          }`}>
            {config.referralActive ? 'Ativado' : 'Desativado'}
          </span>
        </div>

        <p className="text-slate-400 text-xs leading-relaxed">
          O percentual de bônus abaixo é utilizado para calcular automaticamente o valor de crédito do cliente indicador quando uma indicação concluir o primeiro serviço.
        </p>

        <div className="flex flex-wrap items-end gap-4 bg-slate-950/40 p-4 rounded-xl border border-slate-850">
          <div className="space-y-1.5">
            <label className="block text-[9px] uppercase font-bold text-slate-400 tracking-wider font-mono">Percentual de Bônus (%)</label>
            <div className="flex items-center gap-2">
              <input 
                type="number" 
                min="0" 
                max="100"
                value={bonusPercentInput}
                onChange={(e) => setBonusPercentInput(Number(e.target.value))}
                className="w-24 bg-slate-950 border border-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
              />
              <span className="text-slate-500 font-mono text-xs">%</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveConfig}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
            >
              <Check size={14} />
              <span>Salvar Alteração</span>
            </button>
            {showSaveSuccess && (
              <span className="text-emerald-400 font-bold font-mono text-[10px] animate-fadeIn">
                ✓ Configuração atualizada com sucesso!
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider font-mono">Total de Indicações</span>
            <p className="text-2xl font-black text-white font-mono">{metrics.totalIndications}</p>
            <div className="text-[9px] text-slate-400 font-mono flex gap-2 mt-0.5">
              <span className="text-sky-400">Com: {metrics.withCodeCount}</span>
              <span className="text-slate-600">|</span>
              <span className="text-amber-400">Sem: {metrics.withoutCodeCount}</span>
            </div>
          </div>
          <div className="w-12 h-12 bg-sky-500/10 rounded-xl flex items-center justify-center text-sky-400 border border-sky-500/15">
            <Users size={20} />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider font-mono">Taxa de Conversão</span>
            <p className="text-2xl font-black text-white font-mono">{metrics.conversionRate}%</p>
          </div>
          <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400 border border-emerald-500/15">
            <TrendingUp size={20} />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider font-mono">Créditos Disponíveis</span>
            <p className="text-2xl font-black text-white font-mono">{metrics.totalCreditsAvailable}</p>
          </div>
          <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-400 border border-amber-500/15">
            <Sparkles size={20} />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider font-mono">Créditos Utilizados</span>
            <p className="text-2xl font-black text-white font-mono">{metrics.totalCreditsUsed}</p>
          </div>
          <div className="w-12 h-12 bg-violet-500/10 rounded-xl flex items-center justify-center text-violet-400 border border-violet-500/15">
            <CheckCircle2 size={20} />
          </div>
        </div>
      </div>

      {/* Referral History Table card */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4">
        
        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-white">Histórico de Indicações</h3>
          
          <div className="relative w-full sm:w-64">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 pointer-events-none">
              <Search size={14} />
            </span>
            <input 
              type="text" 
              placeholder="Buscar por indicador ou indicado..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white"
            />
          </div>
        </div>

        {/* Table representation */}
        <div className="overflow-x-auto rounded-xl border border-slate-800/80">
          <table className="w-full text-left border-collapse text-[11px]">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-850 text-slate-400 font-mono uppercase text-[9px] font-bold">
                <th className="p-3.5">Quem Indicou</th>
                <th className="p-3.5 text-center">
                  <ArrowRight size={13} className="inline text-slate-500" />
                </th>
                <th className="p-3.5">Quem Foi Indicado</th>
                <th className="p-3.5">Data de Cadastro</th>
                <th className="p-3.5 text-center">Tipo</th>
                <th className="p-3.5 text-right">Vl. Serviço</th>
                <th className="p-3.5 text-right">% Bônus</th>
                <th className="p-3.5 text-right">Bônus Gerado</th>
                <th className="p-3.5 text-right">Status do Crédito</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/60">
              {referralRecords.length > 0 ? (
                referralRecords.map(record => (
                  <tr key={record.id} className="hover:bg-slate-950/20 text-slate-300">
                    <td className="p-3.5 font-semibold text-white">
                      {record.hasCode ? (
                        <>
                          <div>{record.referrerName}</div>
                          <div className="text-[9px] text-slate-500 font-mono mt-0.5">{record.referrerPhone}</div>
                        </>
                      ) : (
                        <span className="text-slate-500 italic">Nulo</span>
                      )}
                    </td>
                    <td className="p-3.5 text-center text-slate-500">
                      <ArrowRight size={12} className="inline" />
                    </td>
                    <td className="p-3.5 font-semibold text-slate-200">
                      <div>{record.recommendedName}</div>
                      <div className="text-[9px] text-slate-500 font-mono mt-0.5">{record.recommendedPhone}</div>
                    </td>
                    <td className="p-3.5 font-mono text-slate-400">{record.createdAt}</td>
                    <td className="p-3.5 text-center">
                      {record.hasCode ? (
                        <span className="px-2 py-0.5 bg-sky-500/10 text-sky-400 border border-sky-500/15 text-[10px] font-bold rounded-lg font-mono">
                          COM CÓDIGO
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/15 text-[10px] font-bold rounded-lg font-mono">
                          SEM CÓDIGO
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-right font-mono text-slate-300">
                      {formatBRL(record.serviceValue)}
                    </td>
                    <td className="p-3.5 text-right font-mono text-slate-300">
                      {record.percentUsed !== null ? `${record.percentUsed}%` : '—'}
                    </td>
                    <td className="p-3.5 text-right font-mono text-sky-400 font-bold">
                      {formatBRL(record.bonusAmount)}
                    </td>
                    <td className="p-3.5 text-right">
                      {record.status === 'used' && (
                        <span className="px-2.5 py-1 bg-violet-500/10 text-violet-400 border border-violet-500/15 text-[10px] font-bold rounded-lg font-mono">
                          UTILIZADO
                        </span>
                      )}
                      {record.status === 'available' && (
                        <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 text-[10px] font-bold rounded-lg font-mono">
                          CRÉDITO ATIVO
                        </span>
                      )}
                      {record.status === 'pending' && (
                        <span className="px-2.5 py-1 bg-slate-950 text-slate-500 border border-slate-800 text-[10px] font-bold rounded-lg font-mono">
                          AGUARDANDO SERVIÇO
                        </span>
                      )}
                      {record.status === 'no_reward' && (
                        <span className="px-2.5 py-1 bg-slate-950 text-slate-500 border border-slate-850 text-[10px] font-bold rounded-lg font-mono italic">
                          SEM RECOMPENSA
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-slate-500 font-mono leading-relaxed">
                    Nenhuma indicação registrada ou encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
}
