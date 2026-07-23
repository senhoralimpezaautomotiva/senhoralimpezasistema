/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  DollarSign, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  TrendingUp, 
  Plus, 
  Search, 
  Trash2, 
  X,
  AlertCircle
} from 'lucide-react';
import { CashTransaction, TransactionType } from '../types';
import { hasModulePermission } from '../db/localDb';

interface FinanceiroModuleProps {
  finances: CashTransaction[];
  currentUser?: any;
  onAddTransaction: (transaction: Omit<CashTransaction, 'id'>) => Promise<any>;
  onDeleteTransaction: (id: string) => Promise<any>;
}

export default function FinanceiroModule({ finances, currentUser, onAddTransaction, onDeleteTransaction }: FinanceiroModuleProps) {
  const canCreate = hasModulePermission(currentUser, 'financeiro', 'create');
  const canDelete = hasModulePermission(currentUser, 'financeiro', 'delete');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'todos' | 'receita' | 'despesa'>('todos');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeDeleteTransactionId, setActiveDeleteTransactionId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    type: 'despesa' as TransactionType,
    category: 'Produtos',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    description: '',
    status: 'pago' as 'pago' | 'pendente'
  });

  // Calculate totals for current context
  const totalReceitas = finances
    .filter(t => t.type === 'receita')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalDespesas = finances
    .filter(t => t.type === 'despesa')
    .reduce((sum, t) => sum + t.amount, 0);

  const netBalance = totalReceitas - totalDespesas;

  // Filter transactions
  const filteredFinances = finances.filter(t => {
    const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'todos' || t.type === typeFilter;
    
    return matchesSearch && matchesType;
  });

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSaving(true);
    try {
      await onAddTransaction(formData);
      setIsAddOpen(false);
      setFormData({
        type: 'despesa',
        category: 'Produtos',
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        description: '',
        status: 'pago'
      });
    } catch (err: any) {
      console.error('Erro ao adicionar transação financeira:', err);
      setErrorMessage(err.message || 'Erro ao registrar movimentação no Supabase.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setErrorMessage(null);
    setActiveDeleteTransactionId(id);
    try {
      await onDeleteTransaction(id);
    } catch (err: any) {
      console.error('Erro ao deletar transação financeira:', err);
      alert(err.message || 'Erro ao excluir movimentação no Supabase.');
    } finally {
      setActiveDeleteTransactionId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn" id="financeiro-module-view">
      
      {/* Finance Summary Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 flex justify-between items-center hover:border-slate-700/60 transition-all">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 block">Total de Receitas (+)</span>
            <span className="text-2xl font-extrabold text-emerald-400 tracking-tight">
              R$ {totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
            <ArrowUpCircle size={20} />
          </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 flex justify-between items-center hover:border-slate-700/60 transition-all">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 block">Total de Despesas (-)</span>
            <span className="text-2xl font-extrabold text-rose-400 tracking-tight">
              R$ {totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center">
            <ArrowDownCircle size={20} />
          </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 flex justify-between items-center hover:border-slate-700/60 transition-all">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 block">Lucro Líquido Real</span>
            <span className={`text-2xl font-extrabold tracking-tight ${netBalance >= 0 ? 'text-sky-400' : 'text-rose-400'}`}>
              R$ {netBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${
            netBalance >= 0 ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
          }`}>
            <TrendingUp size={20} />
          </div>
        </div>
      </div>

      {/* Control Filter & Manual Input Trigger */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-slate-900 p-5 rounded-2xl border border-slate-800">
        <div className="flex-1 flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search size={16} />
            </div>
            <input 
              type="text" 
              placeholder="Pesquisar por categoria ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 text-xs rounded-xl text-slate-200 transition-all placeholder-slate-500"
            />
          </div>

          <div className="flex gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold text-slate-400 font-mono">
            <button 
              onClick={() => setTypeFilter('todos')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${typeFilter === 'todos' ? 'bg-slate-800 text-white font-bold' : 'hover:text-white'}`}
            >
              Todos
            </button>
            <button 
              onClick={() => setTypeFilter('receita')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${typeFilter === 'receita' ? 'bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/15' : 'hover:text-white'}`}
            >
              Receitas
            </button>
            <button 
              onClick={() => setTypeFilter('despesa')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${typeFilter === 'despesa' ? 'bg-rose-500/10 text-rose-400 font-bold border border-rose-500/15' : 'hover:text-white'}`}
            >
              Despesas
            </button>
          </div>
        </div>

        {canCreate && (
          <button 
            onClick={() => setIsAddOpen(true)}
            className="px-4 py-2.5 bg-sky-500 hover:bg-sky-600 font-semibold text-xs text-white rounded-xl shadow-lg shadow-sky-500/15 flex items-center justify-center gap-2 transition-all cursor-pointer"
            id="btn-add-transaction"
          >
            <Plus size={16} />
            <span>Lançar Movimentação</span>
          </button>
        )}
      </div>

      {/* Cash Flow Log Sheet */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center gap-2 bg-slate-900">
          <DollarSign size={16} className="text-sky-500" />
          <h3 className="text-sm font-bold text-white font-mono uppercase">Histórico de Fluxo de Caixa</h3>
        </div>

        {filteredFinances.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            Nenhuma transação financeira registrada para este filtro.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-slate-300">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase font-mono text-slate-400 bg-slate-950/30">
                  <th className="py-3.5 px-5">Data</th>
                  <th className="py-3.5 px-5">Tipo</th>
                  <th className="py-3.5 px-5">Categoria</th>
                  <th className="py-3.5 px-5">Descrição</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5 font-mono text-right">Valor</th>
                  <th className="py-3.5 px-5 text-right">Excluir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-xs">
                {filteredFinances.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-850/20 transition-colors">
                    <td className="py-4 px-5 font-mono font-semibold text-slate-300">
                      {new Date(t.date).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-4 px-5">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                        t.type === 'receita' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15' : 'bg-rose-500/10 text-rose-400 border border-rose-500/15'
                      }`}>
                        {t.type === 'receita' ? 'Entrada' : 'Saída'}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-slate-300 font-semibold">{t.category}</td>
                    <td className="py-4 px-5 text-slate-400 font-medium">{t.description}</td>
                    <td className="py-4 px-5">
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${
                        t.status === 'pago' ? 'bg-slate-800 text-slate-400 border border-slate-700/60' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                      }`}>
                        {t.status === 'pago' ? 'Concluído' : 'Pendente'}
                      </span>
                    </td>
                    <td className={`py-4 px-5 text-right font-mono font-extrabold text-sm ${t.type === 'receita' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {t.type === 'receita' ? '+' : '-'} R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 px-5 text-right">
                      <button 
                        disabled={activeDeleteTransactionId === t.id}
                        onClick={() => {
                          if (confirm(`Excluir a transação "${t.description}"?`)) {
                            handleDelete(t.id);
                          }
                        }}
                        className="p-1.5 bg-slate-850 hover:bg-red-500/10 border border-slate-800 rounded-lg text-slate-500 hover:text-red-400 transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: LANÇAMENTO MANUAL */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl animate-scaleUp">
            <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Lançamento Financeiro</h3>
              <button onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="p-5 space-y-4 text-xs">
              {errorMessage && (
                <div className="bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-2.5 rounded-xl text-xs font-mono">
                  {errorMessage}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Tipo de Lançamento *</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button 
                    type="button"
                    disabled={isSaving}
                    onClick={() => setFormData({ ...formData, type: 'despesa' })}
                    className={`py-1.5 rounded-lg text-center font-bold font-mono transition-all disabled:opacity-50 ${formData.type === 'despesa' ? 'bg-rose-500/15 text-rose-400 border border-rose-500/15' : 'text-slate-400'}`}
                  >
                    Saída (Despesa)
                  </button>
                  <button 
                    type="button"
                    disabled={isSaving}
                    onClick={() => setFormData({ ...formData, type: 'receita' })}
                    className={`py-1.5 rounded-lg text-center font-bold font-mono transition-all disabled:opacity-50 ${formData.type === 'receita' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/15' : 'text-slate-400'}`}
                  >
                    Entrada (Receita)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Categoria *</label>
                <select 
                  required
                  disabled={isSaving}
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white disabled:opacity-50"
                >
                  {formData.type === 'despesa' ? (
                    <>
                      <option value="Produtos">Produtos e Insumos</option>
                      <option value="Aluguel">Aluguel do espaço</option>
                      <option value="Salário">Funcionários e Comissões</option>
                      <option value="Água/Luz">Contas de Consumo (Água/Luz/Net)</option>
                      <option value="Marketing">Marketing & Tráfego</option>
                      <option value="Equipamentos">Manutenção de Equipamentos</option>
                      <option value="Outros">Outras despesas gerais</option>
                    </>
                  ) : (
                    <>
                      <option value="Serviço">Serviço de Estética Automotiva</option>
                      <option value="Produtos">Venda de Produtos detalhados</option>
                      <option value="Outros">Outras entradas comerciais</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Descrição Comercial *</label>
                <input 
                  type="text" 
                  required
                  disabled={isSaving}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white disabled:opacity-50"
                  placeholder="Ex: Compra de ceras de carnaúba"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Valor (R$) *</label>
                  <input 
                    type="number" 
                    required
                    min="0"
                    step="0.01"
                    disabled={isSaving}
                    value={formData.amount || ''}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white font-mono disabled:opacity-50"
                    placeholder="Ex: 450.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Data *</label>
                  <input 
                    type="date" 
                    required
                    disabled={isSaving}
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Situação de Pagamento</label>
                <select 
                  disabled={isSaving}
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'pago' | 'pendente' })}
                  className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white disabled:opacity-50"
                >
                  <option value="pago">Já Liquidado (Pago)</option>
                  <option value="pendente">Pendente / Lançamento futuro</option>
                </select>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3 text-xs">
                <button 
                  type="button" 
                  disabled={isSaving}
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold rounded-xl disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="px-5 py-2 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? 'Registrando...' : 'Registrar Lançamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
