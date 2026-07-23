/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  History, 
  Search, 
  Calendar, 
  Clock, 
  DollarSign, 
  User, 
  Car, 
  ChevronDown, 
  FileText 
} from 'lucide-react';
import { HistoryRecord } from '../types';

interface HistoricoModuleProps {
  history: HistoryRecord[];
}

export default function HistoricoModule({ history }: HistoricoModuleProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredHistory = history.filter(h => 
    h.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    h.vehicleDetails.toLowerCase().includes(searchTerm.toLowerCase()) ||
    h.serviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    h.employeeResponsible.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fadeIn" id="historico-module-view">
      {/* Search Input */}
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search size={18} />
          </div>
          <input 
            type="text" 
            placeholder="Pesquisar histórico por cliente, veículo, serviço ou funcionário..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm rounded-xl text-slate-200 transition-all placeholder-slate-500"
          />
        </div>
      </div>

      {/* History log card table container */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center gap-2 bg-slate-900">
          <History size={16} className="text-sky-500" />
          <h3 className="text-sm font-bold text-white font-mono uppercase">Registro de Atendimentos Finalizados</h3>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            Nenhum atendimento finalizado registrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-slate-300">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase font-mono text-slate-400 bg-slate-950/30">
                  <th className="py-3.5 px-5">Data / Ref</th>
                  <th className="py-3.5 px-5">Cliente</th>
                  <th className="py-3.5 px-5">Veículo</th>
                  <th className="py-3.5 px-5">Serviço Realizado</th>
                  <th className="py-3.5 px-5">Tempo Gasto</th>
                  <th className="py-3.5 px-5">Responsável</th>
                  <th className="py-3.5 px-5 font-mono text-right">Valor Final</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-xs">
                {filteredHistory.map((h) => {
                  const hrs = Math.floor(h.timeSpent / 60);
                  const mins = h.timeSpent % 60;
                  const durationStr = `${hrs > 0 ? `${hrs}h` : ''} ${mins > 0 ? `${mins}m` : ''}`.trim();

                  return (
                    <tr key={h.id} className="hover:bg-slate-850/20 transition-colors">
                      <td className="py-4 px-5">
                        <div className="font-mono font-bold text-white">{new Date(h.date).toLocaleDateString('pt-BR')}</div>
                        <div className="text-[9px] font-mono text-slate-500 uppercase">{h.id}</div>
                      </td>
                      <td className="py-4 px-5">
                        <div className="font-semibold text-white flex items-center gap-1.5">
                          <User size={12} className="text-slate-500" />
                          {h.customerName}
                        </div>
                      </td>
                      <td className="py-4 px-5 font-mono font-medium text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Car size={12} className="text-slate-500" />
                          {h.vehicleDetails}
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <div className="font-semibold text-sky-400">{h.serviceName}</div>
                        {h.notes && (
                          <div className="text-[10px] text-slate-400 italic mt-1 flex items-start gap-1">
                            <FileText size={10} className="shrink-0 mt-0.5 text-slate-500" />
                            <span>{h.notes}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-5 font-mono">
                        <div className="flex items-center gap-1 text-slate-300">
                          <Clock size={12} className="text-slate-500" />
                          {durationStr}
                        </div>
                      </td>
                      <td className="py-4 px-5 font-mono text-slate-300">
                        {h.employeeResponsible}
                      </td>
                      <td className="py-4 px-5 text-right font-mono font-bold text-emerald-400 text-sm">
                        R$ {h.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
