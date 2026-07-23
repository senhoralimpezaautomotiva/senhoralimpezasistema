/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  BarChart3, 
  Users, 
  UserCheck,
  UserX, 
  TrendingUp, 
  DollarSign, 
  Layers, 
  Award,
  Calendar,
  Filter,
  Download,
  Printer,
  ChevronDown,
  ChevronUp,
  Tag,
  Car,
  Wrench,
  Clock,
  Sparkles,
  RefreshCw,
  Gift,
  HelpCircle,
  FileText
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Legend
} from 'recharts';
import { Customer, HistoryRecord, CashTransaction, Appointment, Vehicle, SystemConfig } from '../types';
import { dbInstance } from '../db/localDb';
import { getCurrentDate, getCurrentDateStr, getCurrentMonthPrefix, getCurrentYear } from '../utils/dateUtils';

interface RelatoriosModuleProps {
  customers: Customer[];
  vehicles: Vehicle[];
  history: HistoryRecord[];
  finances: CashTransaction[];
  appointments: Appointment[];
  config?: SystemConfig;
}

export default function RelatoriosModule({ 
  customers, 
  vehicles, 
  history, 
  finances, 
  appointments,
  config
}: RelatoriosModuleProps) {
  
  const theoreticalWeeklyCapacity = useMemo(() => {
    const agendaObj = config?.agenda || dbInstance.config?.agenda;
    if (agendaObj) {
      const activeDays = agendaObj.days?.filter((d: any) => d.isActive).length || 5;
      const slotsCount = agendaObj.timeSlots?.length || 8;
      return activeDays * slotsCount;
    }
    return 40;
  }, [config]);

  // --- STATE FOR FILTERS ---
  const [filterPeriod, setFilterPeriod] = useState<'hoje' | 'ontem' | '7dias' | '30dias' | 'mes' | 'ano' | 'personalizado'>('30dias');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [filterClientType, setFilterClientType] = useState<'todos' | 'novos' | 'recorrentes' | 'indicados' | 'ativos' | 'inativos'>('todos');
  
  const [filterBrand, setFilterBrand] = useState('');
  const [filterModel, setFilterModel] = useState('');
  const [filterPorte, setFilterPorte] = useState<'todos' | 'Pequeno' | 'Médio' | 'Grande'>('todos');
  
  const [filterServiceId, setFilterServiceId] = useState('todos');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  
  const [showFilters, setShowFilters] = useState(true);

  // Today reference based on our centralized utility
  const TODAY_STR = getCurrentDateStr();
  const today = new Date(TODAY_STR + 'T12:00:00Z');

  // --- FILTER CORE DATASETS ---
  
  // Helper to check date intervals
  const isDateInPeriod = (dateStr: string) => {
    if (!dateStr) return false;
    const itemDate = new Date(dateStr + 'T12:00:00Z');
    
    const diffTime = today.getTime() - itemDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    switch (filterPeriod) {
      case 'hoje':
        return dateStr === TODAY_STR;
      case 'ontem': {
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        const yStr = yesterday.toISOString().split('T')[0];
        return dateStr === yStr;
      }
      case '7dias':
        return diffDays >= 0 && diffDays <= 7;
      case '30dias':
        return diffDays >= 0 && diffDays <= 30;
      case 'mes':
        return dateStr.startsWith(TODAY_STR.substring(0, 7)); // current month (2026-07)
      case 'ano':
        return dateStr.startsWith(TODAY_STR.substring(0, 4)); // current year (2026)
      case 'personalizado': {
        if (!startDate && !endDate) return true;
        if (startDate && !endDate) return dateStr >= startDate;
        if (!startDate && endDate) return dateStr <= endDate;
        return dateStr >= startDate && dateStr <= endDate;
      }
      default:
        return true;
    }
  };

  // Filtered History (Services Concluded)
  const filteredHistory = useMemo(() => {
    return history.filter(h => {
      // 1. Period check
      if (!isDateInPeriod(h.date)) return false;

      // 2. Client type filter
      const client = customers.find(c => c.id === h.customerId);
      if (!client) return false;

      if (filterClientType === 'ativos' && client.status !== 'ativo') return false;
      if (filterClientType === 'inativos' && client.status !== 'inativo') return false;
      if (filterClientType === 'indicados' && client.origin !== 'Indicação') return false;
      if (filterClientType === 'novos') {
        const regDate = new Date(client.clientSince + 'T12:00:00Z');
        const diffReg = today.getTime() - regDate.getTime();
        const diffRegDays = Math.floor(diffReg / (1000 * 60 * 60 * 24));
        if (diffRegDays > 30) return false; // Not registered in last 30 days
      }
      if (filterClientType === 'recorrentes') {
        const customerServices = history.filter(srv => srv.customerId === client.id);
        if (customerServices.length <= 1) return false;
      }

      // 3. Vehicle Filter
      const vehicle = vehicles.find(v => v.id === h.vehicleId);
      if (filterBrand || filterModel || filterPorte !== 'todos') {
        if (!vehicle) return false;
        if (filterBrand && !vehicle.brand.toLowerCase().includes(filterBrand.toLowerCase())) return false;
        if (filterModel && !vehicle.model.toLowerCase().includes(filterModel.toLowerCase())) return false;
        if (filterPorte !== 'todos' && vehicle.porte !== filterPorte) return false;
      }

      // 4. Service Filter
      if (filterServiceId !== 'todos' && h.serviceName !== filterServiceId) return false;
      if (minPrice && h.value < Number(minPrice)) return false;
      if (maxPrice && h.value > Number(maxPrice)) return false;

      return true;
    });
  }, [history, customers, vehicles, filterPeriod, startDate, endDate, filterClientType, filterBrand, filterModel, filterPorte, filterServiceId, minPrice, maxPrice]);

  // Filtered Finances (Cashflow Transactions)
  const filteredFinances = useMemo(() => {
    return finances.filter(t => {
      if (!isDateInPeriod(t.date)) return false;
      
      // Filter by value range if set
      if (minPrice && t.amount < Number(minPrice)) return false;
      if (maxPrice && t.amount > Number(maxPrice)) return false;
      
      return true;
    });
  }, [finances, filterPeriod, startDate, endDate, minPrice, maxPrice]);

  // Filtered Appointments (Schedule Records)
  const filteredAppointments = useMemo(() => {
    return appointments.filter(a => {
      if (!a.dateTime) return false;
      const apptDate = a.dateTime.split('T')[0];
      return isDateInPeriod(apptDate);
    });
  }, [appointments, filterPeriod, startDate, endDate]);


  // --- REAL-TIME CALCULATIONS (KPIs) ---

  // 1. Revenue aggregations
  const statsRevenue = useMemo(() => {
    let totalInflow = 0;
    let totalOutflow = 0;
    
    // Only fetch receipts
    filteredFinances.forEach(t => {
      if (t.type === 'receita') {
        totalInflow += t.amount;
      } else {
        totalOutflow += t.amount;
      }
    });

    const netResult = totalInflow - totalOutflow;
    return {
      inflow: totalInflow,
      outflow: totalOutflow,
      net: netResult
    };
  }, [filteredFinances]);

  // Static reference metrics for dashboard comparison cards (unfiltered for accurate context)
  const kpisOverall = useMemo(() => {
    // Faturamento do dia
    const revenueToday = finances
      .filter(t => t.type === 'receita' && t.date === TODAY_STR)
      .reduce((sum, t) => sum + t.amount, 0);

    // Faturamento do mês (Julho 2026)
    const revenueMonth = finances
      .filter(t => t.type === 'receita' && t.date.startsWith(TODAY_STR.substring(0, 7)))
      .reduce((sum, t) => sum + t.amount, 0);

    // Faturamento do ano (2026)
    const revenueYear = finances
      .filter(t => t.type === 'receita' && t.date.startsWith(TODAY_STR.substring(0, 4)))
      .reduce((sum, t) => sum + t.amount, 0);

    // Tickets
    const totalServices = history.length;
    const totalRevenue = history.reduce((sum, h) => sum + h.value, 0);
    const globalTicket = totalServices > 0 ? totalRevenue / totalServices : 0;

    return {
      revenueToday,
      revenueMonth,
      revenueYear,
      globalTicket,
      totalServices
    };
  }, [finances, history]);

  // Filtered specific KPIs
  const filteredKpis = useMemo(() => {
    const totalCount = filteredHistory.length;
    const totalValue = filteredHistory.reduce((sum, h) => sum + h.value, 0);
    const avgTicket = totalCount > 0 ? totalValue / totalCount : 0;

    // Client statuses
    const activeClients = customers.filter(c => c.status === 'ativo').length;
    const inactiveClients = customers.filter(c => c.status === 'inativo').length;
    
    // Referral statistics
    const referredCustomers = customers.filter(c => c.origin === 'Indicação');
    const referralInflowCount = referredCustomers.length;
    
    // Agenda booking occupancy rates (occupied slots vs. theoretical workspace capacity)
    // Theoretical capacity: 8 hours/day * 5 work days/week = 40 hours limit per tech space.
    // Let's compute average hours booked for the selected period
    let bookedHours = 0;
    filteredAppointments.forEach(a => {
      if (a.status === 'confirmado' || a.status === 'concluido') {
        bookedHours += a.duration || 120; // default 120min (2h) if undefined
      }
    });
    const bookedHoursTotal = bookedHours / 60; // convert to decimal hours

    return {
      totalCount,
      totalValue,
      avgTicket,
      activeClients,
      inactiveClients,
      referralInflowCount,
      bookedHoursTotal
    };
  }, [filteredHistory, customers, filteredAppointments]);


  // --- RANKINGS AND INSIGHTS ---

  // Top Most Popular Services
  const rankServices = useMemo(() => {
    const counts: { [name: string]: { count: number; value: number } } = {};
    filteredHistory.forEach(h => {
      if (!counts[h.serviceName]) {
        counts[h.serviceName] = { count: 0, value: 0 };
      }
      counts[h.serviceName].count += 1;
      counts[h.serviceName].value += h.value;
    });

    return Object.entries(counts)
      .map(([name, s]) => ({ name, count: s.count, value: s.value }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredHistory]);

  // Top Customer Vehicles Brands
  const rankBrands = useMemo(() => {
    const counts: { [brand: string]: number } = {};
    filteredHistory.forEach(h => {
      const v = vehicles.find(veh => veh.id === h.vehicleId);
      if (v) {
        counts[v.brand] = (counts[v.brand] || 0) + 1;
      }
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredHistory, vehicles]);

  // Channels Share (Customer Origin)
  const rankOrigins = useMemo(() => {
    const counts: { [origin: string]: number } = {};
    customers.forEach(c => {
      counts[c.origin || 'Outros'] = (counts[c.origin || 'Outros'] || 0) + 1;
    });

    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [customers]);


  // --- RECHARTS TIMELINE AGGREGATION ---
  
  // Aggregate daily financials for the filtered period
  const chartTimelineData = useMemo(() => {
    const dailyMap: { [date: string]: { date: string; formattedDate: string; revenue: number; appointments: number } } = {};
    
    // We generate a list of days in the last 30 days if period is 30dias
    // else we just loop existing dates
    const datesList: string[] = [];
    if (filterPeriod === '30dias') {
      const baseDate = new Date(getCurrentDateStr() + 'T12:00:00Z');
      for (let i = 29; i >= 0; i--) {
        const d = new Date(baseDate.getTime() - i * 24 * 60 * 60 * 1000);
        const yyyy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(d.getUTCDate()).padStart(2, '0');
        datesList.push(`${yyyy}-${mm}-${dd}`);
      }
    } else {
      // Just extract distinct dates from history + finances
      const datesSet = new Set<string>();
      filteredHistory.forEach(h => datesSet.add(h.date));
      filteredFinances.forEach(t => datesSet.add(t.date));
      Array.from(datesSet).sort().forEach(d => datesList.push(d));
    }

    datesList.forEach(dStr => {
      const parts = dStr.split('-');
      dailyMap[dStr] = {
        date: dStr,
        formattedDate: parts[2] ? `${parts[2]}/${parts[1]}` : dStr,
        revenue: 0,
        appointments: 0
      };
    });

    // Populate revenues
    filteredHistory.forEach(h => {
      if (dailyMap[h.date]) {
        dailyMap[h.date].revenue += h.value;
        dailyMap[h.date].appointments += 1;
      }
    });

    return Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredHistory, filteredFinances, filterPeriod]);


  // --- EXPORT TO CSV FUNCTION ---
  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF';
    csvContent += 'Filtros BI: Periodo: ' + filterPeriod + '; Cliente: ' + filterClientType + '; Porte: ' + filterPorte + '\n\n';
    
    csvContent += 'HISTORICO DE SERVICOS FILTRADOS\n';
    csvContent += 'Data,Cliente,Veiculo,Placa,Servico,Valor,Responsavel,Notas\n';
    
    filteredHistory.forEach(h => {
      const v = vehicles.find(veh => veh.id === h.vehicleId);
      const vehicleDesc = v ? `${v.brand} ${v.model} (${v.year})` : 'N/A';
      
      const line = [
        h.date,
        `"${h.customerName.replace(/"/g, '""')}"`,
        `"${vehicleDesc.replace(/"/g, '""')}"`,
        h.vehiclePlate,
        `"${h.serviceName.replace(/"/g, '""')}"`,
        h.value.toFixed(2),
        `"${h.employeeResponsible.replace(/"/g, '""')}"`,
        `"${(h.notes || '').replace(/"/g, '""')}"`
      ].join(',');
      
      csvContent += line + '\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `relatorio_bi_estetica_automotiva_${filterPeriod}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  // Build list of distinct service names for filter select dropdown
  const uniqueServiceNames = useMemo(() => {
    return Array.from(new Set(history.map(h => h.serviceName))).sort();
  }, [history]);

  // Recharts color scheme
  const COLORS = ['#0ea5e9', '#6366f1', '#a855f7', '#f43f5e', '#10b981', '#f59e0b'];

  return (
    <div className="space-y-6 animate-fadeIn" id="bi-reports-view">
      
      {/* Title Header with action buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-5 rounded-2xl border border-slate-800">
        <div>
          <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-sky-400 block mb-1">Business Intelligence</span>
          <h2 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
            <BarChart3 className="text-sky-500" size={20} />
            Centro de Inteligência do Negócio
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Filtros avançados cruzados, monitoramento financeiro de KPIs e exportação.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="p-2.5 bg-slate-950 border border-slate-800 hover:bg-slate-850 rounded-xl text-slate-300 text-xs flex items-center gap-2 transition-all cursor-pointer"
          >
            <Filter size={14} className={showFilters ? 'text-sky-400' : ''} />
            <span>{showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}</span>
            {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          
          <button
            onClick={handleExportCSV}
            className="p-2.5 bg-slate-950 border border-slate-800 hover:bg-slate-850 rounded-xl text-slate-300 text-xs flex items-center gap-2 transition-all cursor-pointer"
            title="Exportar CSV do filtro atual"
          >
            <Download size={14} className="text-emerald-400" />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="p-2.5 bg-slate-950 border border-slate-800 hover:bg-slate-850 rounded-xl text-slate-300 text-xs flex items-center gap-2 transition-all cursor-pointer"
            title="Imprimir relatório"
          >
            <Printer size={14} className="text-sky-400" />
            <span>Imprimir</span>
          </button>
        </div>
      </div>

      {/* FILTER PANEL */}
      {showFilters && (
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4 animate-slideDown">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Filter className="text-sky-400" size={15} />
            <span className="text-xs font-bold text-white uppercase font-mono">Filtros Cruzados Avançados</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            {/* Period */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">1. Período do Relatório</label>
              <select
                value={filterPeriod}
                onChange={(e) => setFilterPeriod(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="hoje">Hoje ({getCurrentDate().toLocaleDateString('pt-BR')})</option>
                <option value="ontem">Ontem</option>
                <option value="7dias">Últimos 7 dias</option>
                <option value="30dias">Últimos 30 dias</option>
                <option value="mes">
                  Mês Corrente ({(() => {
                    const today = getCurrentDate();
                    const monthYear = today.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
                    return monthYear.charAt(0).toUpperCase() + monthYear.slice(1).replace('.', '');
                  })()})
                </option>
                <option value="ano">Ano Corrente ({getCurrentYear()})</option>
                <option value="personalizado">Período Personalizado</option>
              </select>

              {filterPeriod === 'personalizado' && (
                <div className="grid grid-cols-2 gap-1.5 pt-1.5">
                  <input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-1.5 text-[10px] text-white"
                  />
                  <input 
                    type="date" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-1.5 text-[10px] text-white"
                  />
                </div>
              )}
            </div>

            {/* Customers Profile filter */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">2. Tipo de Cliente</label>
              <select
                value={filterClientType}
                onChange={(e) => setFilterClientType(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="todos">Todos os Clientes</option>
                <option value="novos">Clientes Novos (últimos 30 dias)</option>
                <option value="recorrentes">Clientes Recorrentes (Visitas &gt; 1)</option>
                <option value="indicados">Clientes Indicados por Amigos</option>
                <option value="ativos">Clientes Ativos</option>
                <option value="inativos">Clientes Inativos</option>
              </select>
            </div>

            {/* Vehicle filters */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">3. Características do Veículo</label>
              <div className="space-y-1.5">
                <select
                  value={filterPorte}
                  onChange={(e) => setFilterPorte(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  title="Filtro de porte do veículo"
                >
                  <option value="todos">Todos os Portes (P, M, G)</option>
                  <option value="Pequeno">Pequeno (P)</option>
                  <option value="Médio">Médio (M)</option>
                  <option value="Grande">Grande (G)</option>
                </select>
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="text"
                    placeholder="Marca"
                    value={filterBrand}
                    onChange={(e) => setFilterBrand(e.target.value)}
                    className="bg-slate-950 border border-slate-850 rounded-lg p-1.5 text-[10px] text-white focus:outline-none placeholder-slate-500"
                  />
                  <input
                    type="text"
                    placeholder="Modelo"
                    value={filterModel}
                    onChange={(e) => setFilterModel(e.target.value)}
                    className="bg-slate-950 border border-slate-850 rounded-lg p-1.5 text-[10px] text-white focus:outline-none placeholder-slate-500"
                  />
                </div>
              </div>
            </div>

            {/* Service & Price */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">4. Serviços & Preço</label>
              <div className="space-y-1.5">
                <select
                  value={filterServiceId}
                  onChange={(e) => setFilterServiceId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  title="Serviço realizado"
                >
                  <option value="todos">Todos os Serviços</option>
                  {uniqueServiceNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="number"
                    placeholder="Min R$"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="bg-slate-950 border border-slate-850 rounded-lg p-1.5 text-[10px] text-white focus:outline-none placeholder-slate-500"
                  />
                  <input
                    type="number"
                    placeholder="Max R$"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="bg-slate-950 border border-slate-850 rounded-lg p-1.5 text-[10px] text-white focus:outline-none placeholder-slate-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-800/80 pt-3 text-[10px] font-mono text-slate-400">
            <span>Resultados Atuais: <strong className="text-white">{filteredHistory.length}</strong> serviços encontrados neste filtro</span>
          </div>
        </div>
      )}

      {/* COMPACT GENERAL METRIC STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total revenue */}
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-1 hover:border-slate-700 transition-all">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-[9px] uppercase font-mono tracking-wider font-bold">Faturamento (Período)</span>
            <DollarSign size={14} className="text-emerald-400" />
          </div>
          <span className="text-xl font-extrabold text-emerald-400 font-mono block">
            R$ {statsRevenue.inflow.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-slate-400 font-mono block">
            Total do faturamento bruto no filtro
          </span>
        </div>

        {/* Services complete */}
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-1 hover:border-slate-700 transition-all">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-[9px] uppercase font-mono tracking-wider font-bold">Serviços Concluídos</span>
            <Wrench size={14} className="text-sky-400" />
          </div>
          <span className="text-xl font-extrabold text-white font-mono block">
            {filteredKpis.totalCount}
          </span>
          <span className="text-[10px] text-slate-400 font-mono block">
            Com média ticket: <strong className="text-sky-400 font-bold">R$ {filteredKpis.avgTicket.toFixed(0)}</strong>
          </span>
        </div>

        {/* Client stats */}
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-1 hover:border-slate-700 transition-all">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-[9px] uppercase font-mono tracking-wider font-bold">Base de Clientes</span>
            <Users size={14} className="text-indigo-400" />
          </div>
          <span className="text-xl font-extrabold text-white font-mono block">
            {customers.length}
          </span>
          <span className="text-[10px] text-slate-400 font-mono block">
            {filteredKpis.activeClients} ativos | {filteredKpis.inactiveClients} inativos
          </span>
        </div>

        {/* Schedule occupancy */}
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-1 hover:border-slate-700 transition-all">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-[9px] uppercase font-mono tracking-wider font-bold">Taxa Ocupação Agenda</span>
            <Clock size={14} className="text-indigo-400" />
          </div>
          <span className="text-xl font-extrabold text-sky-400 font-mono block">
            {Math.min(100, Math.round((filteredKpis.bookedHoursTotal / theoreticalWeeklyCapacity) * 100))}%
          </span>
          <span className="text-[10px] text-slate-400 font-mono block">
            {filteredKpis.bookedHoursTotal.toFixed(1)}h reservadas (Base: {theoreticalWeeklyCapacity}h/sem)
          </span>
        </div>
      </div>

      {/* GENERAL GRAPHIC BOARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Timeline Chart - Left Side Large Block */}
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-xs font-bold text-white uppercase font-mono flex items-center gap-2">
                <TrendingUp size={14} className="text-sky-400" />
                Desempenho Financeiro do Período
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Faturamento acumulado diário gerado no período selecionado.</p>
            </div>
            <span className="text-[10px] font-mono bg-slate-950 px-2 py-1 rounded text-emerald-400 font-bold">
              Receita: R$ {statsRevenue.inflow.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
            </span>
          </div>

          <div className="h-56 pt-2">
            {chartTimelineData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs italic">
                Nenhuma transação encontrada no período selecionado.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartTimelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" opacity={0.5} />
                  <XAxis 
                    dataKey="formattedDate" 
                    tickLine={false} 
                    axisLine={false} 
                    stroke="#64748b" 
                    fontSize={10} 
                    fontFamily="JetBrains Mono"
                  />
                  <YAxis 
                    tickLine={false} 
                    axisLine={false} 
                    stroke="#64748b" 
                    fontSize={10} 
                    fontFamily="JetBrains Mono"
                  />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-xs space-y-1 font-mono">
                            <p className="text-slate-400 font-bold">{data.date.split('-').reverse().join('/')}</p>
                            <p className="text-emerald-400 font-extrabold">Faturamento: R$ {data.revenue.toFixed(2)}</p>
                            <p className="text-sky-400">Serviços: {data.appointments}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#10b981" 
                    strokeWidth={2} 
                    fillOpacity={1} 
                    fill="url(#revenueGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Channels Share - Pie Chart */}
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-xs font-bold text-white uppercase font-mono flex items-center gap-2">
              <Layers size={14} className="text-sky-400" />
              Canais de Origem (Atração)
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Canais que mais atraem clientes para a estética.</p>
          </div>

          <div className="h-44 flex justify-center items-center">
            {rankOrigins.length === 0 ? (
              <span className="text-slate-500 text-xs italic">Nenhum cliente cadastrado.</span>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={rankOrigins}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {rankOrigins.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-950 border border-slate-800 p-2 rounded-lg text-[10px] font-mono text-white">
                            {data.name}: <strong>{data.value} clientes</strong>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Legend Details */}
          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
            {rankOrigins.map((origin, idx) => (
              <div key={origin.name} className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                <span className="truncate">{origin.name}: <strong className="text-white">{origin.value}</strong></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TOP SERVICES AND TOP AUTOMOTIVE STATISTICS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Rank of Services */}
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="border-b border-slate-800 pb-3 flex items-center gap-2">
            <Award className="text-amber-400 animate-pulse" size={16} />
            <h3 className="text-xs font-bold text-white uppercase font-mono">Serviços Mais Vendidos (Volume)</h3>
          </div>

          {rankServices.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-6 text-center">Nenhum serviço executado no filtro atual.</p>
          ) : (
            <div className="space-y-3.5">
              {rankServices.map((srv, idx) => (
                <div key={srv.name} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-white flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-slate-950 text-[10px] font-mono flex items-center justify-center border border-slate-800 text-slate-400">
                        {idx + 1}
                      </span>
                      {srv.name}
                    </span>
                    <span className="font-mono text-slate-400 font-semibold">
                      {srv.count}x • <strong className="text-emerald-400 font-bold">R$ {srv.value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</strong>
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-sky-500 rounded-full" 
                      style={{ width: `${(srv.count / rankServices[0].count) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top brands / client auto preference */}
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="border-b border-slate-800 pb-3 flex items-center gap-2">
            <Car className="text-sky-400 animate-pulse" size={16} />
            <h3 className="text-xs font-bold text-white uppercase font-mono">Fabricantes de Veículos Mais Frequentes</h3>
          </div>

          {rankBrands.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-6 text-center">Nenhum veículo registrado em serviços concluídos.</p>
          ) : (
            <div className="space-y-3.5">
              {rankBrands.map((b, idx) => (
                <div key={b.name} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-white flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-slate-950 text-[10px] font-mono flex items-center justify-center border border-slate-800 text-slate-400">
                        {idx + 1}
                      </span>
                      {b.name}
                    </span>
                    <span className="font-mono text-slate-300 font-bold">{b.count} atendimentos</span>
                  </div>
                  <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 rounded-full" 
                      style={{ width: `${(b.count / rankBrands[0].count) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* FILTERED DETAILED SERVICES DATASET TABLE (FOR DETAILED READING AND COMPILING PRINT) */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 bg-slate-900">
          <h3 className="text-xs font-bold text-white font-mono flex items-center gap-2 uppercase">
            <FileText size={15} className="text-sky-500" />
            Detalhes dos Registros Filtrados ({filteredHistory.length})
          </h3>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs italic">
            Nenhum serviço registrado com os parâmetros de filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
            <table className="w-full text-left text-slate-300 text-[11px] font-mono">
              <thead className="bg-slate-950/40 text-[9px] uppercase tracking-wider text-slate-500 sticky top-0 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-4">Data</th>
                  <th className="py-2.5 px-4">Cliente</th>
                  <th className="py-2.5 px-4">Placa / Veículo</th>
                  <th className="py-2.5 px-4">Serviço</th>
                  <th className="py-2.5 px-4">Valor</th>
                  <th className="py-2.5 px-4">Profissional</th>
                  <th className="py-2.5 px-4">Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/30">
                {filteredHistory.map(h => (
                  <tr key={h.id} className="hover:bg-slate-850/30 transition-colors">
                    <td className="py-2.5 px-4 text-slate-400">
                      {h.date.split('-').reverse().join('/')}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-white">
                      {h.customerName}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="bg-slate-950 text-sky-400 font-bold px-1.5 py-0.5 rounded border border-slate-800 uppercase text-[10px]">
                        {h.vehiclePlate}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-200">
                      {h.serviceName}
                    </td>
                    <td className="py-2.5 px-4 text-emerald-400 font-bold">
                      R$ {h.value.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 text-slate-400">
                      {h.employeeResponsible}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 italic truncate max-w-[150px]" title={h.notes || ''}>
                      {h.notes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
