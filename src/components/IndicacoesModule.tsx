import React, { useMemo, useState } from 'react';
import { Gift, Users, Search, ArrowRight, TrendingUp, CheckCircle2, Clock3 } from 'lucide-react';
import { Customer, Appointment, LoyaltyCardEntry } from '../types';

interface IndicacoesModuleProps {
  customers: Customer[];
  appointments: Appointment[];
  loyaltyEntries: LoyaltyCardEntry[];
}

export default function IndicacoesModule({ customers, appointments, loyaltyEntries }: IndicacoesModuleProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const indicated = useMemo(() => customers.filter(customer =>
    Boolean(customer.referredBy) || customer.origin === 'Indicação' || customer.origin === 'Indicação sem código'
  ), [customers]);
  const records = useMemo(() => indicated.map(customer => {
    const referrer = customers.find(item => item.id === customer.referredBy);
    const completed = appointments.some(item => item.customerId === customer.id && (item.status === 'finalizado' || item.status === 'entregue'));
    const mark = loyaltyEntries.find(item => item.source === 'referral' && item.referredCustomerId === customer.id);
    return { customer, referrer, completed, mark };
  }).filter(record => `${record.referrer?.name || ''} ${record.customer.name}`.toLowerCase().includes(searchTerm.toLowerCase())), [indicated, customers, appointments, loyaltyEntries, searchTerm]);
  const converted = records.filter(record => record.completed).length;
  const marks = loyaltyEntries.filter(entry => entry.source === 'referral').length;

  return <div className="space-y-6 max-w-6xl mx-auto animate-fadeIn" id="referrals-module-view">
    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 flex items-center gap-3">
      <Gift className="text-sky-500" size={22} />
      <div><h2 className="text-base font-bold text-white">Indicações e cartão fidelidade</h2><p className="text-xs text-slate-400 mt-0.5">Cada primeiro serviço concluído gera uma marcação única para quem indicou.</p></div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {[
        ['Total de indicações', indicated.length, <Users size={20} />],
        ['Conversões', converted, <TrendingUp size={20} />],
        ['Marcações geradas', marks, <CheckCircle2 size={20} />]
      ].map(([label, value, icon]) => <div key={String(label)} className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex justify-between"><div><span className="text-[10px] uppercase font-bold text-slate-500">{label}</span><p className="text-2xl font-black text-white font-mono">{value}</p></div><div className="text-sky-400">{icon}</div></div>)}
    </div>
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-3"><h3 className="text-xs font-bold font-mono uppercase text-white">Histórico de indicações</h3><div className="relative"><Search size={14} className="absolute left-3 top-2 text-slate-500"/><input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Buscar indicador ou indicado" className="bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white"/></div></div>
      <div className="overflow-x-auto rounded-xl border border-slate-800"><table className="w-full text-left text-[11px]"><thead><tr className="bg-slate-950/80 text-slate-400 uppercase text-[9px]"><th className="p-3.5">Quem indicou</th><th/><th className="p-3.5">Indicado</th><th className="p-3.5">Primeiro serviço</th><th className="p-3.5">Marcação</th></tr></thead><tbody className="divide-y divide-slate-800">
        {records.map(({ customer, referrer, completed, mark }) => <tr key={customer.id} className="text-slate-300"><td className="p-3.5 font-semibold text-white">{referrer?.name || 'Sem código'}</td><td><ArrowRight size={12}/></td><td className="p-3.5">{customer.name}</td><td className="p-3.5">{completed ? 'Concluído' : <span className="flex gap-1 items-center"><Clock3 size={12}/>Aguardando</span>}</td><td className="p-3.5">{mark ? <span className="text-emerald-400 font-bold">+1 adicionada</span> : completed && referrer ? <span className="text-amber-400">Pendente de sincronização</span> : '—'}</td></tr>)}
        {records.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-slate-500">Nenhuma indicação encontrada.</td></tr>}
      </tbody></table></div>
    </div>
  </div>;
}
