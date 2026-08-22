import React, { useMemo, useState } from 'react';
import { Calendar, Calculator, Check, Edit3, FileText, Plus, Save, Send, Trash2, UserPlus, X } from 'lucide-react';
import {
  Appointment,
  Budget,
  BudgetDraft,
  BudgetItem,
  BudgetStatus,
  Customer,
  SystemConfig,
  Service,
  User,
  Vehicle
} from '../types';
import { getServicePrice, hasModulePermission } from '../db/localDb';
import { getCurrentDateStr } from '../utils/dateUtils';
import { getAvailableAgendaStartTimes, isAgendaStartTimeAvailable } from '../utils/agendaAvailability';
import { getBudgetItemStatus, getBudgetProgress, getPendingBudgetItems } from '../utils/budgetLifecycle';

interface OrcamentosModuleProps {
  budgets: Budget[];
  customers: Customer[];
  vehicles: Vehicle[];
  services: Service[];
  appointments: Appointment[];
  config: SystemConfig;
  currentUser: User;
  onSave: (draft: BudgetDraft) => Promise<Budget>;
  onSend: (id: string) => Promise<void>;
  onUpdateStatus: (id: string, status: Exclude<BudgetStatus, 'rascunho' | 'enviado'>) => Promise<void>;
  onAddCustomer: (customer: Omit<Customer, 'id' | 'clientSince' | 'lastServiceDate'>) => Promise<Customer>;
  onConvertItemsToAppointment: (
    budgetId: string,
    itemIds: string[],
    appointment: Omit<Appointment, 'id' | 'budgetId' | 'budgetItemIds'>
  ) => Promise<void>;
}

const addDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const emptyItem = (): BudgetItem => ({
  id: crypto.randomUUID(),
  budgetId: '',
  description: '',
  quantity: 1,
  unitPrice: 0,
  total: 0
});

const statusLabel: Record<BudgetStatus, string> = {
  rascunho: 'Rascunho',
  enviado: 'Aguardando cliente',
  aceito: 'Aceito',
  recusado: 'Recusado',
  cancelado: 'Cancelado',
  vencido: 'Vencido',
  convertido: 'Convertido em agendamento'
};

const sumDuration = (items: BudgetItem[], services: Service[]): number => items.reduce((sum, item) => {
  const service = item.serviceId ? services.find(candidate => candidate.id === item.serviceId) : undefined;
  return sum + (service?.estimatedTime || 60) * item.quantity;
}, 0);

export default function OrcamentosModule({
  budgets,
  customers,
  vehicles,
  services,
  appointments,
  config,
  currentUser,
  onSave,
  onSend,
  onUpdateStatus,
  onAddCustomer,
  onConvertItemsToAppointment
}: OrcamentosModuleProps) {
  const canCreate = hasModulePermission(currentUser, 'orcamentos', 'create');
  const canEdit = hasModulePermission(currentUser, 'orcamentos', 'edit');
  const [editing, setEditing] = useState<Budget | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [items, setItems] = useState<BudgetItem[]>([emptyItem()]);
  const [discount, setDiscount] = useState(0);
  const [validUntil, setValidUntil] = useState(addDays(30));
  const [notes, setNotes] = useState('');
  const [quickCustomer, setQuickCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conversionBudget, setConversionBudget] = useState<Budget | null>(null);
  const [conversionItemIds, setConversionItemIds] = useState<string[]>([]);
  const [conversionDate, setConversionDate] = useState(getCurrentDateStr());
  const [conversionTime, setConversionTime] = useState('09:00');

  const filteredCustomers = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();
    return customers.filter(customer => !term
      || customer.name.toLowerCase().includes(term)
      || customer.phone.includes(term)
    ).slice(0, 30);
  }, [customers, customerSearch]);
  const customerVehicles = vehicles.filter(vehicle => vehicle.customerId === customerId);
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const total = Math.max(0, subtotal - discount);
  const agenda = config.agenda;

  const resetForm = () => {
    setEditing(null);
    setCustomerSearch('');
    setCustomerId('');
    setVehicleId('');
    setItems([emptyItem()]);
    setDiscount(0);
    setValidUntil(addDays(30));
    setNotes('');
    setQuickCustomer(false);
    setNewCustomerName('');
    setNewCustomerPhone('');
    setError('');
  };

  const openNew = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (budget: Budget) => {
    setEditing(budget);
    setCustomerId(budget.customerId);
    setVehicleId(budget.vehicleId || '');
    setItems(budget.items.map(item => ({ ...item })));
    setDiscount(budget.discount);
    setValidUntil(budget.validUntil);
    setNotes(budget.notes);
    setQuickCustomer(false);
    setError('');
    setShowForm(true);
  };

  const updateItem = (id: string, updated: Partial<BudgetItem>) => {
    setItems(current => current.map(item => item.id === id
      ? { ...item, ...updated, total: Number(updated.quantity ?? item.quantity) * Number(updated.unitPrice ?? item.unitPrice) }
      : item
    ));
  };

  const selectService = (itemId: string, serviceId: string) => {
    const service = services.find(candidate => candidate.id === serviceId);
    const vehicle = vehicles.find(candidate => candidate.id === vehicleId);
    updateItem(itemId, {
      serviceId: service?.id,
      description: service?.name || '',
      unitPrice: service ? getServicePrice(service, vehicle) : 0
    });
  };

  const registerCustomer = async () => {
    if (!newCustomerName.trim() || newCustomerPhone.replace(/\D/g, '').length < 8) {
      setError('Informe nome e telefone válido para cadastrar o cliente.');
      return;
    }
    setBusy(true);
    try {
      const customer = await onAddCustomer({
        name: newCustomerName.trim(),
        phone: newCustomerPhone,
        whatsapp: newCustomerPhone,
        email: '',
        birthDate: '',
        address: '',
        neighborhood: '',
        city: '',
        notes: 'Cadastrado pelo módulo de orçamentos.',
        status: 'ativo',
        origin: 'Orçamento'
      });
      setCustomerId(customer.id);
      setQuickCustomer(false);
      setCustomerSearch(customer.name);
      setError('');
    } catch {
      setError('Não foi possível cadastrar o cliente.');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!customerId || items.length === 0 || items.some(item => !item.description.trim())) {
      setError('Selecione o cliente e preencha todos os itens.');
      return;
    }
    setBusy(true);
    try {
      await onSave({
        id: editing?.id,
        customerId,
        vehicleId: vehicleId || undefined,
        subtotal,
        discount,
        total,
        validUntil,
        notes,
        items
      });
      setShowForm(false);
      resetForm();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível salvar o orçamento.');
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível concluir a operação.');
    } finally {
      setBusy(false);
    }
  };

  const openConversion = (budget: Budget) => {
    const pendingItems = getPendingBudgetItems(budget, appointments);
    if (pendingItems.length === 0) {
      setError('Este orcamento nao possui itens pendentes para converter.');
      return;
    }
    const defaultDate = getCurrentDateStr();
    const duration = sumDuration(pendingItems, services);
    const available = agenda ? getAvailableAgendaStartTimes({
      agenda,
      appointments,
      services,
      date: defaultDate,
      serviceDuration: duration
    }) : [];
    setConversionBudget(budget);
    setConversionItemIds(pendingItems.filter(item => item.serviceId).map(item => item.id));
    setConversionDate(defaultDate);
    setConversionTime(available[0]?.time || '09:00');
    setError('');
  };

  const selectedConversionItems = conversionBudget
    ? conversionBudget.items.filter(item => conversionItemIds.includes(item.id))
    : [];
  const conversionDuration = sumDuration(selectedConversionItems, services);
  const conversionAvailableTimes = conversionBudget && agenda ? getAvailableAgendaStartTimes({
    agenda,
    appointments,
    services,
    date: conversionDate,
    serviceDuration: Math.max(conversionDuration, 60)
  }).map(option => option.time) : [];

  const convertBudget = async () => {
    if (!conversionBudget || conversionItemIds.length === 0) {
      setError('Selecione ao menos um item pendente para converter.');
      return;
    }
    if (!agenda || !isAgendaStartTimeAvailable({
      agenda,
      appointments,
      services,
      date: conversionDate,
      serviceDuration: Math.max(conversionDuration, 60),
      time: conversionTime
    })) {
      setError('Horario indisponivel para os itens selecionados.');
      return;
    }
    const customerVehicles = vehicles.filter(vehicle => vehicle.customerId === conversionBudget.customerId);
    const vehicleId = conversionBudget.vehicleId || customerVehicles[0]?.id || '';
    const firstItem = selectedConversionItems[0];
    if (!vehicleId || !firstItem?.serviceId || selectedConversionItems.some(item => !item.serviceId)) {
      setError('Para converter em agendamento, selecione itens vinculados a servicos e um veiculo do cliente.');
      return;
    }
    await runAction(async () => {
      await onConvertItemsToAppointment(conversionBudget.id, conversionItemIds, {
        customerId: conversionBudget.customerId,
        vehicleId,
        serviceId: firstItem.serviceId || '',
        serviceIds: selectedConversionItems.map(item => item.serviceId).filter(Boolean) as string[],
        dateTime: `${conversionDate}T${conversionTime}`,
        status: 'agendado',
        value: selectedConversionItems.reduce((sum, item) => sum + item.total, 0),
        durationTotal: Math.max(conversionDuration, 60),
        employeeId: 'Gabriel',
        notes: `Convertido do orcamento #${conversionBudget.number || conversionBudget.id.slice(0, 8)}.`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      setConversionBudget(null);
    });
  };

  return (
    <div className="p-6 overflow-y-auto h-full space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2"><FileText className="text-sky-400" /> Orçamentos</h1>
          <p className="text-sm text-slate-400 mt-1">Envio por WhatsApp e acompanhamentos automáticos aos 7 e 14 dias.</p>
        </div>
        {canCreate && (
          <button onClick={openNew} className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-semibold flex items-center gap-2">
            <Plus size={16} /> Novo orçamento
          </button>
        )}
      </div>

      {error && <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm">{error}</div>}

      <div className="grid gap-3">
        {budgets.length === 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-10 text-center text-slate-400">Nenhum orçamento cadastrado.</div>
        )}
        {budgets.map(budget => {
          const customer = customers.find(item => item.id === budget.customerId);
          const progress = getBudgetProgress(budget, appointments);
          const pendingItems = getPendingBudgetItems(budget, appointments);
          return (
            <div key={budget.id} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 flex flex-wrap items-start gap-4">
              <div className="min-w-[260px] flex-1">
                <div className="text-white font-semibold">Orçamento #{budget.number || budget.id.slice(0, 8)}</div>
                <div className="text-sm text-slate-400">{customer?.name || 'Cliente não encontrado'} · validade {new Date(`${budget.validUntil}T12:00:00`).toLocaleDateString('pt-BR')}</div>
                <div className="mt-3 grid gap-1.5">
                  {budget.items.map(item => {
                    const itemStatus = getBudgetItemStatus(item, appointments);
                    return (
                      <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-950/50 border border-slate-800 px-3 py-2 text-xs">
                        <span className="truncate text-slate-300">{item.description}</span>
                        <span className={`shrink-0 font-mono text-[10px] uppercase ${
                          itemStatus === 'concluido' ? 'text-emerald-400' :
                            itemStatus === 'agendado' ? 'text-sky-400' :
                              itemStatus === 'cancelado' ? 'text-rose-400' : 'text-amber-300'
                        }`}>
                          {itemStatus}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-emerald-400">R$ {budget.total.toFixed(2)}</div>
                <span className="text-[10px] uppercase tracking-wide text-slate-300">{progress.label || statusLabel[budget.status]}</span>
                <div className="text-[10px] text-slate-500 mt-1">{progress.completedItems} de {progress.totalItems} concluido(s)</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {budget.status === 'rascunho' && canEdit && (
                  <>
                    <button onClick={() => openEdit(budget)} className="p-2 rounded-lg border border-slate-700 text-slate-300 hover:text-white" title="Editar"><Edit3 size={15} /></button>
                    <button disabled={busy} onClick={() => {
                      if (window.confirm('Confirmar o envio deste orçamento por WhatsApp? Depois do envio, valores e itens não poderão ser alterados.')) {
                        void runAction(() => onSend(budget.id));
                      }
                    }} className="px-3 py-2 rounded-lg bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1"><Send size={14} /> Enviar</button>
                  </>
                )}
                {budget.status === 'enviado' && canEdit && (
                  <>
                    <button disabled={busy} onClick={() => runAction(() => onUpdateStatus(budget.id, 'aceito'))} className="px-3 py-2 rounded-lg border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-1"><Check size={14} /> Aceito</button>
                    <button disabled={busy} onClick={() => runAction(() => onUpdateStatus(budget.id, 'recusado'))} className="px-3 py-2 rounded-lg border border-slate-700 text-slate-300 text-xs flex items-center gap-1"><X size={14} /> Recusado</button>
                    <button disabled={busy} onClick={() => runAction(() => onUpdateStatus(budget.id, 'cancelado'))} className="p-2 rounded-lg border border-red-500/30 text-red-300" title="Cancelar"><Trash2 size={15} /></button>
                  </>
                )}
                {canCreate && pendingItems.length > 0 && budget.status !== 'rascunho' && budget.status !== 'recusado' && budget.status !== 'cancelado' && budget.status !== 'vencido' && (
                  <button disabled={busy} onClick={() => openConversion(budget)} className="px-3 py-2 rounded-lg border border-sky-500/40 text-sky-300 text-xs flex items-center gap-1">
                    <Calendar size={14} /> Converter
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {conversionBudget && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Calendar className="text-sky-400" /> Converter em agendamento
                </h2>
                <p className="text-xs text-slate-400 mt-1">Orcamento #{conversionBudget.number || conversionBudget.id.slice(0, 8)}</p>
              </div>
              <button onClick={() => setConversionBudget(null)} className="text-slate-400 hover:text-white"><X /></button>
            </div>

            <div className="space-y-2">
              {conversionBudget.items.filter(item => getBudgetItemStatus(item, appointments) === 'pendente').map(item => {
                const isManualItem = !item.serviceId;
                return (
                <label key={item.id} className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-xs ${isManualItem ? 'border-amber-500/20 bg-amber-500/5 text-amber-200' : 'border-slate-800 bg-slate-950/60 text-slate-300'}`}>
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      disabled={isManualItem}
                      checked={conversionItemIds.includes(item.id)}
                      onChange={event => setConversionItemIds(current => event.target.checked
                        ? [...current, item.id]
                        : current.filter(id => id !== item.id)
                      )}
                    />
                    <span>
                      {item.description}
                      {isManualItem && (
                        <span className="block text-[10px] text-amber-300/80">
                          Item manual sem servico cadastrado. Vincule a um servico antes de agendar.
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="font-mono text-emerald-400">R$ {item.total.toFixed(2)}</span>
                </label>
                );
              })}
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <label className="text-xs text-slate-300">Data
                <input type="date" value={conversionDate} onChange={event => setConversionDate(event.target.value)} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white" />
              </label>
              <label className="text-xs text-slate-300">Horario
                <input type="time" value={conversionTime} onChange={event => setConversionTime(event.target.value)} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white" />
              </label>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                <div className="text-xs text-slate-400">Duracao estimada</div>
                <div className="text-xl font-bold text-white">{Math.max(conversionDuration, 60)} min</div>
              </div>
            </div>

            {conversionAvailableTimes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {conversionAvailableTimes.slice(0, 12).map(time => (
                  <button key={time} type="button" onClick={() => setConversionTime(time)} className={`px-2.5 py-1 rounded-lg border text-[10px] font-mono ${conversionTime === time ? 'border-sky-400 bg-sky-500/20 text-sky-200' : 'border-slate-700 text-slate-400'}`}>
                    {time}
                  </button>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button onClick={() => setConversionBudget(null)} className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm">Cancelar</button>
              <button disabled={busy} onClick={() => void convertBudget()} className="px-4 py-2.5 rounded-xl bg-sky-500 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
                <Calendar size={15} /> Criar agendamento
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2"><Calculator className="text-sky-400" /> {editing ? 'Editar orçamento' : 'Novo orçamento'}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white"><X /></button>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300">Buscar cliente</label>
                <input value={customerSearch} onChange={event => setCustomerSearch(event.target.value)} placeholder="Nome ou telefone" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white" />
                <select value={customerId} onChange={event => { setCustomerId(event.target.value); setVehicleId(''); }} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white">
                  <option value="">Selecione o cliente</option>
                  {filteredCustomers.map(customer => <option key={customer.id} value={customer.id}>{customer.name} — {customer.phone}</option>)}
                </select>
                {!editing && <button onClick={() => setQuickCustomer(current => !current)} className="text-xs text-sky-400 flex items-center gap-1"><UserPlus size={13} /> Cliente não encontrado? Cadastrar</button>}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300">Veículo</label>
                <select value={vehicleId} onChange={event => setVehicleId(event.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white">
                  <option value="">Sem veículo vinculado</option>
                  {customerVehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.brand} {vehicle.model} — {vehicle.plate}</option>)}
                </select>
              </div>
            </div>

            {quickCustomer && (
              <div className="grid md:grid-cols-[1fr_1fr_auto] gap-3 p-4 rounded-xl border border-sky-500/20 bg-sky-500/5">
                <input value={newCustomerName} onChange={event => setNewCustomerName(event.target.value)} placeholder="Nome do cliente" className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white" />
                <input value={newCustomerPhone} onChange={event => setNewCustomerPhone(event.target.value)} placeholder="WhatsApp" className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white" />
                <button disabled={busy} onClick={registerCustomer} className="px-4 py-2 rounded-xl bg-sky-500 text-white text-xs font-semibold">Cadastrar</button>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex justify-between items-center"><h3 className="text-sm font-semibold text-white">Itens</h3><button onClick={() => setItems(current => [...current, emptyItem()])} className="text-xs text-sky-400 flex items-center gap-1"><Plus size={13} /> Adicionar item</button></div>
              {items.map(item => (
                <div key={item.id} className="grid md:grid-cols-[1.2fr_1.4fr_.5fr_.7fr_auto] gap-2">
                  <select value={item.serviceId || ''} onChange={event => selectService(item.id, event.target.value)} className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-xs text-white"><option value="">Item manual</option>{services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}</select>
                  <input maxLength={500} value={item.description} onChange={event => updateItem(item.id, { description: event.target.value })} placeholder="Descrição" className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-xs text-white" />
                  <input type="number" min="0.01" step="0.01" value={item.quantity} onChange={event => updateItem(item.id, { quantity: Number(event.target.value) })} className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-xs text-white" />
                  <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={event => updateItem(item.id, { unitPrice: Number(event.target.value) })} className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-xs text-white" />
                  <button disabled={items.length === 1} onClick={() => setItems(current => current.filter(candidate => candidate.id !== item.id))} className="p-2 text-red-300 disabled:opacity-30"><Trash2 size={15} /></button>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <label className="text-xs text-slate-300">Desconto (R$)<input type="number" min="0" max={subtotal} step="0.01" value={discount} onChange={event => setDiscount(Number(event.target.value))} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white" /></label>
              <label className="text-xs text-slate-300">Validade<input type="date" min={new Date().toISOString().slice(0, 10)} value={validUntil} onChange={event => setValidUntil(event.target.value)} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white" /></label>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3"><div className="text-xs text-slate-400">Total</div><div className="text-xl font-bold text-emerald-400">R$ {total.toFixed(2)}</div></div>
            </div>
            <textarea maxLength={4000} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Observações do orçamento" rows={3} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white" />

            <div className="flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm">Cancelar</button>
              <button disabled={busy} onClick={save} className="px-4 py-2.5 rounded-xl bg-sky-500 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50"><Save size={15} /> Salvar rascunho</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
