/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Car, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight,
  AlertTriangle,
  X,
  Sparkles,
  Plus,
  Smartphone,
  Trash2,
  Save,
  Printer,
  History,
  Check,
} from 'lucide-react';
import { 
  Customer, 
  Vehicle, 
  Service, 
  Appointment, 
  HistoryRecord, 
  CashTransaction, 
  AppointmentStatus,
  SystemConfig,
  User as SystemUser
} from '../types';
import { dbInstance, renderTemplateText, getServicePrice, hasModulePermission } from '../db/localDb';
import { getCurrentDate, getCurrentDateStr, getCurrentMonthPrefix } from '../utils/dateUtils';
import { safeLog, setSafeText } from '../security/safeOutput';
import { AppointmentGridCard } from './AppointmentGridCard';
import {
  createAppointmentFormDraft,
  getServicesDuration,
  getServicesPrice
} from '../utils/servicePricing';
import { useVehicleCatalog } from '../hooks/useVehicleCatalog';
import { resolveVehiclePorte } from '../utils/vehicleCatalog';

interface DashboardModuleProps {
  customers: Customer[];
  vehicles: Vehicle[];
  services: Service[];
  appointments: Appointment[];
  history: HistoryRecord[];
  finances: CashTransaction[];
  config?: SystemConfig;
  currentUser?: SystemUser | null;
  clientPortalEnabled?: boolean;
  onNavigate: (tab: string) => void;
  onUpdateStatus: (id: string, status: AppointmentStatus) => Promise<any>;
  onAddAppointment: (appointment: Omit<Appointment, 'id'>) => Promise<any>;
  onUpdateAppointment: (id: string, updated: Partial<Appointment>) => Promise<any>;
  onDeleteAppointment: (id: string) => Promise<any>;
  onAddCustomer: (customer: Omit<Customer, 'id' | 'clientSince' | 'lastServiceDate'>) => Promise<any>;
  onAddVehicle: (vehicle: Omit<Vehicle, 'id'>) => Promise<any>;
}

export default function DashboardModule({ 
  customers, 
  vehicles, 
  services, 
  appointments, 
  history, 
  finances,
  config,
  currentUser,
  clientPortalEnabled = false,
  onNavigate,
  onUpdateStatus,
  onAddAppointment,
  onUpdateAppointment,
  onDeleteAppointment,
  onAddCustomer,
  onAddVehicle
}: DashboardModuleProps) {
  const canCreateAppointment = hasModulePermission(currentUser, 'agenda', 'create');
  const canEditAppointment = hasModulePermission(currentUser, 'agenda', 'edit');
  const canDeleteAppointment = hasModulePermission(currentUser, 'agenda', 'delete');
  const canCreateCustomer = hasModulePermission(currentUser, 'clientes', 'create');
  const todayStr = getCurrentDateStr();
  const currentMonthPrefix = getCurrentMonthPrefix();
  const currentDate = getCurrentDate();
  const currentMonthLabel = currentDate.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric'
  });
  const currentDayLabel = currentDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long'
  });
  const vehicleCatalog = useVehicleCatalog();

  const formatPhoneForWhatsApp = (phone: string) => {
    let clean = phone.replace(/\D/g, '');
    if (!clean) return '';
    if (!clean.startsWith('55') && (clean.length === 10 || clean.length === 11)) {
      clean = '55' + clean;
    }
    return clean;
  };

  const getCleanPhoneForWhatsApp = (whatsapp?: string, phone?: string) => {
    const base = whatsapp || phone || '';
    return formatPhoneForWhatsApp(base);
  };

  const openWhatsAppLink = (phone: string, text: string) => {
    const cleanPhone = formatPhoneForWhatsApp(phone);
    // Universal WhatsApp link format for mobile/desktop
    const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
    
    // Create a real anchor tag dynamically to bypass mobile popup/tab blockers
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // States for Inactive Customer filters
  const [inactiveDays, setInactiveDays] = useState<number>(() => {
    const trigger = dbInstance.automations.find(a => a.event === 'cliente_inativo');
    return trigger?.inactiveDays ?? 30;
  });
  const [minCompletedServices, setMinCompletedServices] = useState<number>(() => {
    const trigger = dbInstance.automations.find(a => a.event === 'cliente_inativo');
    return trigger?.minServices ?? 1;
  });

  // --- Quick Appointment modal state ---
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formData, setFormData] = useState({
    customerId: '',
    vehicleId: '',
    serviceId: '',
    time: dbInstance.config?.agenda?.timeSlots[0]?.time || '08:00',
    value: 0,
    employeeId: 'Gabriel',
    notes: ''
  });

  const handleCustomerChange = (customerId: string) => {
    const firstVehicle = vehicles.find(v => v.customerId === customerId);
    const service = services.find(s => s.id === formData.serviceId);
    const resolvedValue = service ? getServicePrice(service, firstVehicle || null) : 0;
    setFormData(prev => ({
      ...prev,
      customerId,
      vehicleId: firstVehicle ? firstVehicle.id : '',
      value: resolvedValue
    }));
  };

  const handleVehicleChange = (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    const service = services.find(s => s.id === formData.serviceId);
    const resolvedValue = service ? getServicePrice(service, vehicle || null) : 0;
    setFormData(prev => ({
      ...prev,
      vehicleId,
      value: resolvedValue
    }));
  };

  const handleServiceChange = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    const vehicle = vehicles.find(v => v.id === formData.vehicleId);
    const resolvedValue = service ? getServicePrice(service, vehicle || null) : 0;
    setFormData(prev => ({
      ...prev,
      serviceId,
      value: resolvedValue
    }));
  };

  // --- EDIT DRAWER STATE ---
  const [selectedApptId, setSelectedApptId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Editing values inside the drawer
  const [editCustomerId, setEditCustomerId] = useState('');
  const [editVehicleId, setEditVehicleId] = useState('');
  const [editServiceId, setEditServiceId] = useState('');
  const [editServiceIds, setEditServiceIds] = useState<string[]>([]);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editDuration, setEditDuration] = useState(60);
  const [editStatus, setEditStatus] = useState<AppointmentStatus>('agendado');
  const [editDiscount, setEditDiscount] = useState(0);
  const [editAddition, setEditAddition] = useState(0);
  const [editValue, setEditValue] = useState(0);
  const [editEmployeeId, setEditEmployeeId] = useState('Gabriel');
  const [editNotes, setEditNotes] = useState('');
  const [editStartedAt, setEditStartedAt] = useState<string | undefined>(undefined);
  const [editConcludedAt, setEditConcludedAt] = useState<string | undefined>(undefined);

  // Quick search & Add new panels in Drawer
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientBirth, setNewClientBirth] = useState('1990-01-01');

  const [isAddingVehicle, setIsAddingVehicle] = useState(false);
  const [newVehicleBrand, setNewVehicleBrand] = useState('');
  const [newVehicleModel, setNewVehicleModel] = useState('');
  const [newVehicleYear, setNewVehicleYear] = useState(String(currentDate.getFullYear()));
  const [newVehiclePlate, setNewVehiclePlate] = useState('');
  const [newVehicleColor, setNewVehicleColor] = useState('');
  const quickVehicleModels = useMemo(
    () => vehicleCatalog.models.filter(model => model.brandName === newVehicleBrand),
    [vehicleCatalog.models, newVehicleBrand]
  );

  // Active appointment object
  const activeAppt = appointments.find(a => a.id === selectedApptId);

  // --- Sync Edit Fields with the Selected Appointment ---
  useEffect(() => {
    if (activeAppt) {
      setEditCustomerId(activeAppt.customerId);
      setEditVehicleId(activeAppt.vehicleId);
      setEditServiceId(activeAppt.serviceId);
      setEditServiceIds(activeAppt.serviceIds || [activeAppt.serviceId]);
      
      const [dDate, dTime] = activeAppt.dateTime.split('T');
      setEditDate(dDate || todayStr);
      setEditTime(dTime || (dbInstance.config?.agenda?.timeSlots[0]?.time || '08:00'));
      
      setEditDuration(activeAppt.durationTotal || 60);
      setEditStatus(activeAppt.status);
      setEditDiscount(activeAppt.discount || 0);
      setEditAddition(activeAppt.addition || 0);
      setEditValue(activeAppt.value);
      setEditEmployeeId(activeAppt.employeeId);
      setEditNotes(activeAppt.notes || '');
      setEditStartedAt(activeAppt.startedAt);
      setEditConcludedAt(activeAppt.concludedAt);

      // Reset search/quick fields
      setClientSearchQuery('');
      setIsAddingClient(false);
      setIsAddingVehicle(false);
    }
  }, [selectedApptId, activeAppt]);

  // --- Dynamic Pricing & Duration Recalculations ---
  useEffect(() => {
    const selectedVehicle = vehicles.find(vehicle => vehicle.id === editVehicleId);
    const baseSum = getServicesPrice(services, editServiceIds, selectedVehicle);
    const totalMinutes = getServicesDuration(services, editServiceIds);

    // Final price = Base + Addition - Discount
    const finalPrice = Math.max(0, baseSum + editAddition - editDiscount);
    setEditValue(finalPrice);
    setEditDuration(totalMinutes || 60);
  }, [editServiceIds, editVehicleId, editDiscount, editAddition, services, vehicles]);

  // --- Calculations for core metrics ---
  const revenueToday = finances
    .filter(t => t.type === 'receita' && t.date === todayStr)
    .reduce((sum, t) => sum + t.amount, 0);

  const revenueMonth = finances
    .filter(t => t.type === 'receita' && t.date.startsWith(currentMonthPrefix))
    .reduce((sum, t) => sum + t.amount, 0);

  const completedAppointments = appointments.filter(a => a.status === 'finalizado');
  const totalApptRevenue = completedAppointments.reduce((sum, a) => sum + a.value, 0) + history.reduce((sum, h) => sum + h.value, 0);
  const totalServicesRun = completedAppointments.length + history.length;
  const averageTicket = totalServicesRun > 0 ? totalApptRevenue / totalServicesRun : 180.00;

  const inactiveCustomers = customers.filter(c => {
    // Check if explicitly inactive or dynamically inactive
    const isManuallyInactive = c.status === 'inativo';

    const completedAppts = appointments.filter(a => a.customerId === c.id && (a.status === 'finalizado' || a.status === 'entregue'));
    const completedHistory = history.filter(h => h.customerId === c.id);
    const totalCompleted = completedAppts.length + completedHistory.length;

    let lastDateStr: string | null = c.lastServiceDate || null;
    completedAppts.forEach(a => {
      const dStr = a.dateTime.split('T')[0];
      if (!lastDateStr || dStr > lastDateStr) {
        lastDateStr = dStr;
      }
    });
    completedHistory.forEach(h => {
      if (!lastDateStr || h.date > lastDateStr) {
        lastDateStr = h.date;
      }
    });

    let daysSince = 9999;
    if (lastDateStr) {
      const lastD = new Date(lastDateStr);
      const todayD = getCurrentDate();
      const diffTime = todayD.getTime() - lastD.getTime();
      daysSince = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
    }

    const fitsDynamicCriteria = totalCompleted >= minCompletedServices && daysSince >= inactiveDays;

    return isManuallyInactive || fitsDynamicCriteria;
  });

  const getBirthdaysToday = () => {
    const today = getCurrentDate();
    const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
    const currentDay = String(today.getDate()).padStart(2, '0');
    return customers.filter(c => {
      if (!c.birthDate) return false;
      const [_, month, day] = c.birthDate.split('-');
      return month === currentMonth && day === currentDay;
    });
  };

  const getBirthdaysThisMonth = () => {
    const today = getCurrentDate();
    const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
    const currentDay = String(today.getDate()).padStart(2, '0');
    return customers.filter(c => {
      if (!c.birthDate) return false;
      const [_, month, day] = c.birthDate.split('-');
      return month === currentMonth && day !== currentDay;
    });
  };

  // Stats Card details
  const stats = [
    {
      id: 'stat-revenue-month',
      title: 'Faturamento do Mês',
      value: `R$ ${revenueMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      subtitle: `Acumulado em ${currentMonthLabel}`,
      icon: DollarSign,
      color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      trend: { label: '+18.2% vs jun', isUp: true }
    },
    {
      id: 'stat-revenue-today',
      title: 'Faturamento do Dia',
      value: `R$ ${revenueToday.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      subtitle: `Hoje, ${currentDayLabel}`,
      icon: TrendingUp,
      color: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
      trend: { label: 'Meta batida', isUp: true }
    },
    {
      id: 'stat-ticket-medio',
      title: 'Ticket Médio',
      value: `R$ ${averageTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      subtitle: 'Média por atendimento concluído',
      icon: Sparkles,
      color: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
      trend: { label: 'Alta performance', isUp: true }
    }
  ];

  // Helper for status styling mapping
  const getStatusBadgeStyles = (status: AppointmentStatus) => {
    switch (status) {
      case 'agendado': return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      case 'confirmado': return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
      case 'cliente_chegou': return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
      case 'em_andamento': return 'bg-amber-500/10 text-amber-400 border border-amber-500/25 shadow-[0_0_10px_rgba(245,158,11,0.25)]';
      case 'aguardando_aprovacao': return 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20';
      case 'aguardando_peca': return 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
      case 'finalizado': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'entregue': return 'bg-teal-500/10 text-teal-400 border border-teal-500/20';
      case 'cancelado': return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
    }
  };

  const getStatusLabel = (status: AppointmentStatus) => {
    switch (status) {
      case 'agendado': return 'Agendado';
      case 'confirmado': return 'Confirmado';
      case 'cliente_chegou': return 'Cliente Chegou';
      case 'em_andamento': return 'Em Andamento';
      case 'aguardando_aprovacao': return 'Aguardando Aprovação';
      case 'aguardando_peca': return 'Aguardando Peça';
      case 'finalizado': return 'Finalizado';
      case 'entregue': return 'Entregue';
      case 'cancelado': return 'Cancelado';
      default: return status;
    }
  };

  // --- Submit quick addition handlers ---
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateAppointment) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const dateTimeStr = `${todayStr}T${formData.time}`;
      await onAddAppointment({
        customerId: formData.customerId,
        vehicleId: formData.vehicleId,
        serviceId: formData.serviceId,
        serviceIds: [formData.serviceId],
        dateTime: dateTimeStr,
        status: 'agendado',
        value: formData.value,
        discount: 0,
        addition: 0,
        durationTotal: services.find(s => s.id === formData.serviceId)?.estimatedTime || 60,
        employeeId: formData.employeeId,
        notes: formData.notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        changelog: [{ date: new Date().toISOString(), user: 'Sistema', action: 'Agendamento criado' }]
      });
      setIsAddOpen(false);
    } catch (err: any) {
      safeLog('error', 'dashboard.appointment.create', 'error', { error: err });
      setErrorMessage('Erro ao registrar agendamento. Verifique a integridade dos dados.');
    } finally {
      setIsSaving(false);
    }
  };

  const openQuickAppointment = (hourStr: string) => {
    if (!canCreateAppointment) return;
    setErrorMessage(null);
    setFormData(createAppointmentFormDraft(customers, vehicles, services, hourStr));
    setIsAddOpen(true);
  };

  // --- Sub-Form: Quick Client Creation inside Drawer ---
  const handleQuickAddClient = async () => {
    if (!canCreateCustomer || !newClientName.trim() || !newClientPhone.trim()) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const added = await onAddCustomer({
        name: newClientName,
        phone: newClientPhone,
        whatsapp: newClientPhone,
        email: `${newClientName.toLowerCase().replace(/\s+/g, '')}@exemplo.com`,
        birthDate: newClientBirth,
        address: 'Não informado',
        neighborhood: 'Não informado',
        city: 'Não informado',
        notes: 'Cadastrado rapidamente pela Central de Operações',
        status: 'ativo',
        origin: 'WhatsApp'
      });
      if (added) {
        setEditCustomerId(added.id);
        setIsAddingClient(false);
        setNewClientName('');
        setNewClientPhone('');
      }
    } catch (err: any) {
      safeLog('error', 'dashboard.customer.quick_create', 'error', { error: err });
      setErrorMessage('Erro ao adicionar cliente. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  // --- Sub-Form: Quick Vehicle Creation inside Drawer ---
  const handleQuickAddVehicle = async () => {
    if (
      !canCreateCustomer
      || !newVehicleBrand.trim()
      || !newVehicleModel.trim()
      || !newVehicleYear.trim()
      || !newVehiclePlate.trim()
      || !newVehicleColor.trim()
    ) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const added = await onAddVehicle({
        customerId: editCustomerId,
        brand: newVehicleBrand,
        model: newVehicleModel,
        version: 'N/A',
        year: newVehicleYear,
        plate: newVehiclePlate.toUpperCase(),
        color: newVehicleColor,
        mileage: '0',
        porte: resolveVehiclePorte(vehicleCatalog, newVehicleBrand, newVehicleModel)
      });
      if (added) {
        setEditVehicleId(added.id);
        setIsAddingVehicle(false);
        setNewVehicleBrand('');
        setNewVehicleModel('');
        setNewVehicleYear(String(getCurrentDate().getFullYear()));
        setNewVehiclePlate('');
        setNewVehicleColor('');
      }
    } catch (err: any) {
      safeLog('error', 'dashboard.vehicle.quick_create', 'error', { error: err });
      setErrorMessage('Erro ao cadastrar veículo. Verifique a placa ou cor.');
    } finally {
      setIsSaving(false);
    }
  };

  // --- Edit Panel Actions ---
  const handleSaveDrawerEdits = async () => {
    if (!selectedApptId || !canEditAppointment) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      // Create a changelog record
      const updatedChangelog = activeAppt?.changelog ? [...activeAppt.changelog] : [];
      const changeTime = new Date().toISOString();
      
      // Check what changed for history log
      if (activeAppt?.status !== editStatus) {
        updatedChangelog.push({
          date: changeTime,
          user: 'Administrador',
          action: `Status alterado para ${getStatusLabel(editStatus)}`
        });
      }
      if (activeAppt?.employeeId !== editEmployeeId) {
        updatedChangelog.push({
          date: changeTime,
          user: 'Administrador',
          action: `Responsável alterado para ${editEmployeeId}`
        });
      }
      if (activeAppt?.value !== editValue) {
        updatedChangelog.push({
          date: changeTime,
          user: 'Administrador',
          action: `Preço atualizado para R$ ${editValue.toFixed(2)}`
        });
      }

      await onUpdateAppointment(selectedApptId, {
        customerId: editCustomerId,
        vehicleId: editVehicleId,
        serviceId: editServiceId,
        serviceIds: editServiceIds,
        dateTime: `${editDate}T${editTime}`,
        status: editStatus,
        value: editValue,
        discount: editDiscount,
        addition: editAddition,
        durationTotal: editDuration,
        employeeId: editEmployeeId,
        notes: editNotes,
        updatedAt: changeTime,
        startedAt: editStartedAt,
        concludedAt: editConcludedAt,
        changelog: updatedChangelog.length > 0 ? updatedChangelog : [
          ...(activeAppt?.changelog || []),
          { date: changeTime, user: 'Administrador', action: 'Atualização de dados gerais' }
        ]
      });

      setIsDrawerOpen(false);
      setSelectedApptId(null);
    } catch (err: any) {
      safeLog('error', 'dashboard.appointment.update', 'error', {
        entityId: selectedApptId || undefined,
        error: err
      });
      setErrorMessage('Erro ao atualizar agendamento. Verifique as restrições.');
    } finally {
      setIsSaving(false);
    }
  };

  // Duplicate Appointment
  const handleDuplicateAppointment = async (apptId: string) => {
    if (!canCreateAppointment) return;
    const toClone = appointments.find(a => a.id === apptId);
    if (!toClone) return;

    setIsSaving(true);
    setErrorMessage(null);
    try {
      // Create a new duplicate appointment object
      await onAddAppointment({
        customerId: toClone.customerId,
        vehicleId: toClone.vehicleId,
        serviceId: toClone.serviceId,
        serviceIds: toClone.serviceIds || [toClone.serviceId],
        dateTime: toClone.dateTime, // keeps same slot, user can adjust
        status: 'agendado',
        value: toClone.value,
        discount: toClone.discount || 0,
        addition: toClone.addition || 0,
        durationTotal: toClone.durationTotal || 60,
        employeeId: toClone.employeeId,
        notes: `Duplicado - ${toClone.notes}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        changelog: [{ date: new Date().toISOString(), user: 'Administrador', action: 'Agendamento duplicado' }]
      });

      setIsDrawerOpen(false);
      setSelectedApptId(null);
    } catch (err: any) {
      safeLog('error', 'dashboard.appointment.clone', 'error', {
        entityId: selectedApptId || undefined,
        error: err
      });
      alert('Erro ao clonar agendamento. Verifique se há conflito.');
    } finally {
      setIsSaving(false);
    }
  };

  // Reschedule to another visual slot
  const handleMoveToSlot = async (newHour: string) => {
    if (!canEditAppointment || !selectedApptId) return;
    setEditTime(newHour);
    // Create direct action log
    const updatedChangelog = activeAppt?.changelog ? [...activeAppt.changelog] : [];
    updatedChangelog.push({
      date: new Date().toISOString(),
      user: 'Administrador',
      action: `Agendamento reagendado para o horário das ${newHour}`
    });
    
    try {
      await onUpdateAppointment(selectedApptId, {
        dateTime: `${editDate}T${newHour}`,
        changelog: updatedChangelog
      });
    } catch (error) {
      safeLog('error', 'dashboard.appointment.reschedule', 'error', {
        entityId: selectedApptId,
        error
      });
      setErrorMessage('Erro ao reagendar atendimento.');
    }
  };

  const handleDeleteAppointment = async () => {
    if (!canDeleteAppointment || !selectedApptId) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await onDeleteAppointment(selectedApptId);
      setIsDrawerOpen(false);
      setSelectedApptId(null);
    } catch (error) {
      safeLog('error', 'dashboard.appointment.delete', 'error', {
        entityId: selectedApptId,
        error
      });
      setErrorMessage('Erro ao excluir agendamento.');
    } finally {
      setIsSaving(false);
    }
  };

  // WhatsApp Message triggers using active templates
  const getWhatsAppTemplateURLForAppointment = (appt: Appointment) => {
    const client = customers.find(c => c.id === appt.customerId);
    if (!client) return '#';

    const phoneSanitized = getCleanPhoneForWhatsApp(client.whatsapp, client.phone);

    // Identify corresponding event based on current status
    let eventName: 'novo_agendamento' | 'servico_iniciado' | 'servico_finalizado' = 'novo_agendamento';
    if (appt.status === 'em_andamento') {
      eventName = 'servico_iniciado';
    } else if (appt.status === 'finalizado' || appt.status === 'entregue') {
      eventName = 'servico_finalizado';
    }

    const automation = dbInstance.automations.find(a => a.event === eventName);
    let text = '';
    
    if (automation) {
      const vehicle = vehicles.find(v => v.id === appt.vehicleId);
      const serviceIdsToUse = appt.serviceIds && appt.serviceIds.length > 0 ? appt.serviceIds : [appt.serviceId];
      const mergedServiceName = serviceIdsToUse
        .map(id => services.find(s => s.id === id)?.name)
        .filter(Boolean)
        .join(', ');
      const service = services.find(s => s.id === appt.serviceId);
      const virtualService = service ? { ...service, name: mergedServiceName } : undefined;
      
      text = renderTemplateText(automation.template, {
        customer: client,
        vehicle,
        service: virtualService,
        appointment: appt
      });
    } else {
      const serviceIdsToUse = appt.serviceIds && appt.serviceIds.length > 0 ? appt.serviceIds : [appt.serviceId];
      const selectedServiceNames = serviceIdsToUse
        .map(id => services.find(s => s.id === id)?.name)
        .filter(Boolean)
        .join(', ');
      text = `Olá, ${client.name}! Passando para falar sobre o serviço de ${selectedServiceNames} do seu veículo.`;
    }

    return `https://api.whatsapp.com/send?phone=${phoneSanitized}&text=${encodeURIComponent(text)}`;
  };

  const getWhatsAppTemplateURL = () => {
    if (!activeAppt) return '#';
    const dummyAppt: Appointment = {
      ...activeAppt,
      customerId: editCustomerId,
      vehicleId: editVehicleId,
      serviceId: editServiceId,
      serviceIds: editServiceIds,
      dateTime: `${editDate}T${editTime}`,
      status: editStatus,
      value: editValue,
      startedAt: editStartedAt,
      concludedAt: editConcludedAt,
      notes: editNotes
    };
    return getWhatsAppTemplateURLForAppointment(dummyAppt);
  };

  // --- Date/Time Formatter and Instant Service Transitions ---
  const formatDateTimeDisplay = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString || '';
    }
  };

  const handleStartServiceInstant = async () => {
    if (!selectedApptId || !activeAppt || !canEditAppointment) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const nowStr = new Date().toISOString();
      const changeTime = nowStr;
      const updatedChangelog = activeAppt.changelog ? [...activeAppt.changelog] : [];
      updatedChangelog.push({
        date: changeTime,
        user: 'Administrador',
        action: `Serviço Iniciado às ${new Date(nowStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
      });

      await onUpdateAppointment(selectedApptId, {
        customerId: editCustomerId,
        vehicleId: editVehicleId,
        serviceId: editServiceId,
        serviceIds: editServiceIds,
        dateTime: `${editDate}T${editTime}`,
        status: 'em_andamento',
        value: editValue,
        discount: editDiscount,
        addition: editAddition,
        durationTotal: editDuration,
        employeeId: editEmployeeId,
        notes: editNotes,
        updatedAt: changeTime,
        startedAt: nowStr,
        changelog: updatedChangelog
      });

      setEditStatus('em_andamento');
      setEditStartedAt(nowStr);
    } catch (err: any) {
      safeLog('error', 'dashboard.appointment.start_service', 'error', {
        entityId: selectedApptId || undefined,
        error: err
      });
      setErrorMessage('Erro ao iniciar atendimento.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinishServiceInstant = async () => {
    if (!selectedApptId || !activeAppt || !canEditAppointment) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const nowStr = new Date().toISOString();
      const changeTime = nowStr;
      const updatedChangelog = activeAppt.changelog ? [...activeAppt.changelog] : [];
      updatedChangelog.push({
        date: changeTime,
        user: 'Administrador',
        action: `Serviço Finalizado às ${new Date(nowStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
      });

      await onUpdateAppointment(selectedApptId, {
        customerId: editCustomerId,
        vehicleId: editVehicleId,
        serviceId: editServiceId,
        serviceIds: editServiceIds,
        dateTime: `${editDate}T${editTime}`,
        status: 'finalizado',
        value: editValue,
        discount: editDiscount,
        addition: editAddition,
        durationTotal: editDuration,
        employeeId: editEmployeeId,
        notes: editNotes,
        updatedAt: changeTime,
        concludedAt: nowStr,
        changelog: updatedChangelog
      });

      setEditStatus('finalizado');
      setEditConcludedAt(nowStr);
    } catch (err: any) {
      safeLog('error', 'dashboard.appointment.complete_service', 'error', {
        entityId: selectedApptId || undefined,
        error: err
      });
      setErrorMessage('Erro ao finalizar atendimento.');
    } finally {
      setIsSaving(false);
    }
  };

  // Print Service Order using DOM nodes and textContent for all dynamic values.
  const handlePrintOS = () => {
    const client = customers.find(c => c.id === editCustomerId);
    const vehicle = vehicles.find(v => v.id === editVehicleId);
    
    const selectedServicesDetails = editServiceIds
      .map(id => services.find(s => s.id === id))
      .filter(Boolean);

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const printDocument = printWindow.document;
    printDocument.title = `Ordem de Serviço #${selectedApptId || ''}`;
    while (printDocument.head.firstChild) {
      printDocument.head.removeChild(printDocument.head.firstChild);
    }
    while (printDocument.body.firstChild) {
      printDocument.body.removeChild(printDocument.body.firstChild);
    }

    const style = printDocument.createElement('style');
    style.textContent = `
      body { font-family: "Helvetica Neue", Arial, sans-serif; padding: 40px; color: #333; background: #fff; }
      .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
      h1 { margin: 0; font-size: 24px; text-transform: uppercase; }
      .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; background: #f9f9f9; padding: 15px; border-radius: 8px; }
      .meta p { margin: 5px 0; font-size: 14px; }
      .label { font-weight: bold; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
      th, td { border: 1px solid #ddd; padding: 12px; text-align: left; font-size: 14px; }
      th { background: #f2f2f2; font-weight: bold; }
      .total-section { text-align: right; margin-top: 30px; font-size: 16px; font-weight: bold; }
      .grand-total { font-size: 20px; color: #10b981; }
      .notes { margin-top: 30px; }
      .notes-value { font-style: italic; background: #fafafa; padding: 10px; border-left: 3px solid #ddd; }
      .footer { text-align: center; margin-top: 60px; font-size: 12px; color: #777; border-top: 1px solid #eee; padding-top: 20px; }
      .footer-note { margin-top: 15px; }
    `;
    printDocument.head.appendChild(style);

    const appendTextElement = <K extends keyof HTMLElementTagNameMap>(
      parent: Node,
      tagName: K,
      value: unknown,
      className?: string
    ): HTMLElementTagNameMap[K] => {
      const element = printDocument.createElement(tagName);
      if (className) element.className = className;
      setSafeText(element, value);
      parent.appendChild(element);
      return element;
    };

    const appendLabelValue = (parent: Node, label: string, value: unknown): void => {
      const paragraph = printDocument.createElement('p');
      appendTextElement(paragraph, 'span', `${label}: `, 'label');
      paragraph.appendChild(printDocument.createTextNode(String(value ?? '')));
      parent.appendChild(paragraph);
    };

    const header = printDocument.createElement('div');
    header.className = 'header';
    appendTextElement(header, 'h1', 'Ordem de Serviço - Senhora Limpeza');
    appendTextElement(header, 'p', `Estética Automotiva Premium • OS #${selectedApptId || ''}`);
    printDocument.body.appendChild(header);

    const meta = printDocument.createElement('div');
    meta.className = 'meta';
    const clientSection = printDocument.createElement('div');
    appendTextElement(clientSection, 'h3', 'DADOS DO CLIENTE');
    appendLabelValue(clientSection, 'Nome', client?.name || 'Não informado');
    appendLabelValue(clientSection, 'Telefone', client?.phone || 'Não informado');
    appendLabelValue(clientSection, 'E-mail', client?.email || 'Não informado');
    meta.appendChild(clientSection);

    const vehicleSection = printDocument.createElement('div');
    appendTextElement(vehicleSection, 'h3', 'DADOS DO VEÍCULO');
    appendLabelValue(
      vehicleSection,
      'Veículo',
      vehicle ? `${vehicle.brand} ${vehicle.model} (${vehicle.color})` : 'Não cadastrado'
    );
    appendLabelValue(vehicleSection, 'Placa', vehicle?.plate || 'Não informada');
    appendLabelValue(vehicleSection, 'Ano', vehicle?.year || 'Não informado');
    meta.appendChild(vehicleSection);
    printDocument.body.appendChild(meta);

    const servicesSection = printDocument.createElement('div');
    appendTextElement(servicesSection, 'h3', 'SERVIÇOS CONTRATADOS');
    const table = printDocument.createElement('table');
    const tableHead = printDocument.createElement('thead');
    const headerRow = printDocument.createElement('tr');
    ['Descrição do Serviço', 'Duração Estimada', 'Preço Base'].forEach(label => {
      appendTextElement(headerRow, 'th', label);
    });
    tableHead.appendChild(headerRow);
    table.appendChild(tableHead);

    const tableBody = printDocument.createElement('tbody');
    selectedServicesDetails.forEach(service => {
      if (!service) return;
      const row = printDocument.createElement('tr');
      appendTextElement(row, 'td', service.name || '');
      appendTextElement(row, 'td', `${service.estimatedTime || 60} min`);
      appendTextElement(row, 'td', `R$ ${getServicePrice(service, vehicle).toFixed(2)}`);
      tableBody.appendChild(row);
    });
    table.appendChild(tableBody);
    servicesSection.appendChild(table);
    printDocument.body.appendChild(servicesSection);

    const totals = printDocument.createElement('div');
    totals.className = 'total-section';
    appendTextElement(totals, 'p', `Subtotal: R$ ${(editValue + editDiscount - editAddition).toFixed(2)}`);
    appendTextElement(totals, 'p', `Descontos: R$ ${editDiscount.toFixed(2)}`);
    appendTextElement(totals, 'p', `Acréscimos: R$ ${editAddition.toFixed(2)}`);
    appendTextElement(totals, 'p', `Valor Final: R$ ${editValue.toFixed(2)}`, 'grand-total');
    printDocument.body.appendChild(totals);

    const notes = printDocument.createElement('div');
    notes.className = 'notes';
    appendTextElement(notes, 'h3', 'OBSERVAÇÕES OPERACIONAIS');
    appendTextElement(
      notes,
      'p',
      editNotes || 'Nenhuma observação cadastrada.',
      'notes-value'
    );
    printDocument.body.appendChild(notes);

    const footer = printDocument.createElement('div');
    footer.className = 'footer';
    appendTextElement(
      footer,
      'p',
      'Assinatura do Técnico: ___________________________   Assinatura do Cliente: ___________________________'
    );
    appendTextElement(
      footer,
      'p',
      'Senhora Limpeza Estética Premium - Obrigado pela confiança!',
      'footer-note'
    );
    printDocument.body.appendChild(footer);

    printWindow.focus();
    printWindow.setTimeout(() => printWindow.print(), 0);
  };

  // Filter clients based on quick search
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
    c.phone.includes(clientSearchQuery)
  );

  // Today's appointments list
  const appointmentsToday = appointments.filter(a => a.dateTime.startsWith(todayStr));
  const chronologicalAppointmentsToday = useMemo(
    () => [...appointmentsToday].sort((a, b) => a.dateTime.localeCompare(b.dateTime)),
    [appointmentsToday]
  );

  // Determine standard operational hours from dynamic agenda config
  const baseHours = useMemo(() => {
    const agendaObj = config?.agenda || dbInstance.config?.agenda;
    if (agendaObj && Array.isArray(agendaObj.timeSlots) && agendaObj.timeSlots.length > 0) {
      return agendaObj.timeSlots.map((s: any) => s.time);
    }
    return ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
  }, [config]);

  // Identify next upcoming appointment (closest non-finished appointment in the future/today)
  const upcomingAppts = appointmentsToday
    .filter(a => a.status === 'agendado' || a.status === 'confirmado' || a.status === 'cliente_chegou')
    .sort((a, b) => a.dateTime.localeCompare(b.dateTime));
  const nextApptId = upcomingAppts[0]?.id || null;

  const bookingVehicles = vehicles.filter(v => v.customerId === formData.customerId);
  const editVehicles = vehicles.filter(v => v.customerId === editCustomerId);

  return (
    <div className="space-y-6 animate-fadeIn relative" id="dashboard-central-operacao">
      
      {/* Top Bar Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 p-6 rounded-2xl border border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse" />
            Central de Operações Diárias
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Estética Automotiva Senhora Limpeza • Foco operacional, controle de pátio e agendamento instantâneo.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          {canCreateAppointment && (
            <button 
              onClick={() => openQuickAppointment(baseHours[0] || '08:00')}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl shadow-[0_0_15px_rgba(14,165,233,0.35)] transition-all cursor-pointer transform hover:scale-[1.02] active:scale-[0.98]"
              id="btn-global-new-appointment"
            >
              <Plus size={15} className="stroke-[3]" />
              <span>Novo Agendamento</span>
            </button>
          )}
          <div className="hidden sm:flex items-center gap-2 font-mono text-[11px] bg-slate-950 text-sky-400 px-3.5 py-2.5 rounded-xl border border-slate-800 shadow-inner shrink-0">
            <span>
              {(() => {
                const weekdays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
                const today = getCurrentDate();
                const datePart = today.toLocaleDateString('pt-BR');
                const dayOfWeek = weekdays[today.getDay()];
                return `Hoje: ${datePart} (${dayOfWeek})`;
              })()}
            </span>
          </div>
        </div>
      </div>

      {/* Customer Portal Action Bar */}
      {clientPortalEnabled && (
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-gradient-to-r from-sky-950/20 via-indigo-950/20 to-sky-950/20 border border-sky-900/30 px-5 py-3 rounded-2xl">
        <div className="flex items-center gap-2 text-left">
          <div className="w-2 h-2 rounded-full bg-sky-400 animate-ping shrink-0" />
          <span className="text-xs text-slate-300 font-semibold">
            Portal de Agendamento do Cliente está online!
          </span>
          <span className="text-[10px] text-slate-500 hidden md:inline">
            • Disponibilize o link nas redes sociais ou envie por WhatsApp.
          </span>
        </div>
        <div className="flex gap-2 shrink-0">
          <button 
            onClick={() => {
              const url = `${window.location.origin}${window.location.pathname}?portal=true`;
              navigator.clipboard.writeText(url);
              alert('Link do Portal do Cliente copiado com sucesso para a área de transferência:\n\n' + url);
            }}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-sky-400 hover:text-sky-300 border border-sky-500/20 font-bold uppercase tracking-wider rounded-xl text-[10px] flex items-center gap-1.5 cursor-pointer transition-all"
          >
            Copiar Link do Portal
          </button>
          <a
            href="?portal=true"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 hover:text-sky-300 border border-sky-500/30 font-bold uppercase tracking-wider rounded-xl text-[10px] flex items-center gap-1.5 cursor-pointer transition-all"
          >
            Testar Portal ↗
          </a>
        </div>
      </div>
      )}

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Section (Stats and 3x3 Agenda Grid) */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Primary Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {stats.map((st) => {
              const Icon = st.icon;
              return (
                <div key={st.id} className="bg-slate-900 p-5 rounded-xl border border-slate-800/80 flex flex-col justify-between hover:border-slate-700/50 transition-all shadow-sm">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">{st.title}</span>
                      <span className="text-xl font-extrabold text-white tracking-tight">{st.value}</span>
                    </div>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${st.color} shadow-inner shrink-0`}>
                      <Icon size={16} />
                    </div>
                  </div>
                  <div className="mt-3.5 pt-2.5 border-t border-slate-800/60 flex justify-between items-center text-[10px]">
                    <span className="text-slate-450 truncate">{st.subtitle}</span>
                    <span className={`font-mono font-medium ${st.trend.isUp ? 'text-emerald-400' : 'text-rose-400'} flex items-center gap-0.5 shrink-0`}>
                      {st.trend.isUp ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                      {st.trend.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Agenda de Hoje em ordem cronologica */}
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono text-sky-400">
                  Agenda de Hoje
                </h2>
                <p className="text-[11px] text-slate-400">
                  Atendimentos em sequencia cronologica. Clique em um card para editar sem sair do dashboard.
                </p>
              </div>
              <button
                onClick={() => onNavigate('agenda')}
                className="text-[11px] text-sky-400 hover:text-sky-350 font-semibold flex items-center gap-1 transition-colors"
              >
                <span>Ir para Agenda Completa &rarr;</span>
              </button>
            </div>

            {/* Cards cronologicos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" id="agenda-grid-3x3">
              {chronologicalAppointmentsToday.map((appt) => (
                <AppointmentGridCard
                  key={appt.id}
                  appt={appt}
                  customers={customers}
                  vehicles={vehicles}
                  services={services}
                  nextApptId={nextApptId}
                  onEditClick={(id) => {
                    setSelectedApptId(id);
                    setIsDrawerOpen(true);
                  }}
                  onDuplicateClick={handleDuplicateAppointment}
                  onUpdateStatus={onUpdateStatus}
                  canCreate={canCreateAppointment}
                  canEdit={canEditAppointment}
                />
              ))}

              <button
                type="button"
                onClick={() => openQuickAppointment(baseHours[0] || '08:00')}
                disabled={!canCreateAppointment}
                className="group rounded-xl p-4 bg-slate-950/40 border border-dashed border-slate-800 hover:border-sky-500/50 hover:bg-slate-950/80 disabled:opacity-45 disabled:cursor-not-allowed transition-all flex flex-col justify-center items-center gap-3 h-[165px] text-center"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 group-hover:border-sky-500/40 flex items-center justify-center text-sky-400 transition-colors">
                  <Plus size={18} className="stroke-[3]" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider font-semibold text-slate-300 block">
                    Agendar Cliente
                  </span>
                  <p className="text-[9px] text-slate-500 mt-1">
                    Criar um novo atendimento
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column (Clientes Inativos & Aniversariantes always visible side-by-side or stacked) */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Card Clientes Inativos */}
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4 shadow-sm" id="inactive-customers-card">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 border-b border-slate-800/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20 shrink-0">
                  <Users size={14} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Recuperação de Cliente Inativo</h3>
                  <p className="text-[9px] text-slate-450">Filtro dinâmico de inatividade</p>
                </div>
              </div>
              
              {/* Horizontal inputs aligned to the right on desktop, wrapping nicely on mobile */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-850">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Dias sem atendimento:</span>
                  <input
                    type="number"
                    value={inactiveDays}
                    onChange={(e) => {
                      const val = Math.max(1, parseInt(e.target.value) || 0);
                      setInactiveDays(val);
                      dbInstance.updateAutomationTrigger('at4', { inactiveDays: val });
                    }}
                    className="w-12 bg-slate-900 border border-slate-800 rounded text-slate-200 text-[10px] font-extrabold font-mono text-center focus:outline-none focus:border-rose-500/50 py-0.5"
                  />
                </div>
                <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-850">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Mín. Serviços:</span>
                  <input
                    type="number"
                    value={minCompletedServices}
                    onChange={(e) => {
                      const val = Math.max(0, parseInt(e.target.value) || 0);
                      setMinCompletedServices(val);
                      dbInstance.updateAutomationTrigger('at4', { minServices: val });
                    }}
                    className="w-10 bg-slate-900 border border-slate-800 rounded text-slate-200 text-[10px] font-extrabold font-mono text-center focus:outline-none focus:border-rose-500/50 py-0.5"
                  />
                </div>
                <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 rounded-full font-mono text-[10px] font-bold shrink-0">
                  {inactiveCustomers.length}
                </span>
              </div>
            </div>

            {inactiveCustomers.length === 0 ? (
              <div className="text-center p-5 text-slate-500 text-[10px] italic bg-slate-950/50 rounded-xl border border-slate-850">
                Sem clientes inativos. Sucesso! 🎉
              </div>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                {inactiveCustomers.slice(0, 10).map(cust => {
                  const completedAppts = appointments.filter(a => a.customerId === cust.id && (a.status === 'finalizado' || a.status === 'entregue'));
                  const completedHistory = history.filter(h => h.customerId === cust.id);
                  
                  let lastDateStr: string | null = cust.lastServiceDate || null;
                  completedAppts.forEach(a => {
                    const dStr = a.dateTime.split('T')[0];
                    if (!lastDateStr || dStr > lastDateStr) {
                      lastDateStr = dStr;
                    }
                  });
                  completedHistory.forEach(h => {
                    if (!lastDateStr || h.date > lastDateStr) {
                      lastDateStr = h.date;
                    }
                  });

                  let daysSince = 0;
                  if (lastDateStr) {
                    const lastD = new Date(lastDateStr);
                    const todayD = getCurrentDate();
                    const diffTime = todayD.getTime() - lastD.getTime();
                    daysSince = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
                  }

                  const formattedDate = lastDateStr ? lastDateStr.split('-').reverse().join('/') : 'Nunca';
                  const servicesCount = completedAppts.length + completedHistory.length;

                  return (
                    <div key={cust.id} className="p-2.5 bg-slate-950 border border-slate-850 rounded-xl hover:border-slate-800 transition-all text-[11px] flex flex-col justify-between gap-2">
                      <div className="space-y-0.5">
                        <h4 className="font-bold text-slate-200 truncate">{cust.name}</h4>
                        <p className="text-[9px] text-slate-500">
                          Último: {formattedDate} {lastDateStr && `(${daysSince} dias)`} • {servicesCount} {servicesCount === 1 ? 'serviço' : 'serviços'}
                        </p>
                      </div>
                      <a 
                        onClick={(e) => {
                          e.preventDefault();
                          const text = `Olá, ${cust.name}! Faz um tempo que não vemos você e seu veículo por aqui. Que tal darmos aquele trato premium para proteger e brilhar a pintura? Agende hoje mesmo e ganhe uma cristalização de parabrisa cortesia!`;
                          openWhatsAppLink(cust.whatsapp || cust.phone, text);
                        }}
                        href="#"
                        className="w-full text-center py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/15 hover:border-rose-500/30 rounded-lg text-[9px] font-bold transition-all flex items-center justify-center gap-1"
                      >
                        <Smartphone size={10} />
                        <span>Recuperar Cliente</span>
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Card Aniversariantes do Mês/Dia */}
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4 shadow-sm" id="birthdays-reminders-card">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center border border-violet-500/20">
                  <Sparkles size={14} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Aniversariantes</h3>
                  <p className="text-[9px] text-slate-450">
                    {(() => {
                      const today = getCurrentDate();
                      const monthYear = today.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                      return monthYear.charAt(0).toUpperCase() + monthYear.slice(1);
                    })()}
                  </p>
                </div>
              </div>
            </div>

            {getBirthdaysToday().length > 0 ? (
              <div className="space-y-2.5">
                {getBirthdaysToday().map(cust => (
                  <div key={cust.id} className="p-3 bg-emerald-950/30 border border-emerald-555/20 rounded-xl text-[11px] space-y-2 animate-pulse">
                    <div>
                      <h4 className="font-black text-emerald-400">🎂 Hoje: {cust.name}</h4>
                      <p className="text-[9px] text-emerald-500">Dia de festa e cupom! 🎉</p>
                    </div>
                    <a 
                      onClick={(e) => {
                        e.preventDefault();
                        const text = `Parabéns, ${cust.name}! 🎉🎈 A equipe da Senhora Limpeza te deseja muitos anos de vida! Para comemorar, você acaba de ganhar 15% de desconto em qualquer serviço neste mês!`;
                        openWhatsAppLink(cust.whatsapp || cust.phone, text);
                      }}
                      href="#"
                      className="w-full text-center py-1 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold rounded-lg text-[9px] shadow-sm transition-all block"
                    >
                      Enviar Cupom (15%)
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-center p-3 text-slate-500 text-[10px] bg-slate-950/45 rounded-xl border border-slate-850 italic">
                  Nenhum aniversário hoje ({currentDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}).
                </div>
                
                {getBirthdaysThisMonth().length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[9px] uppercase font-mono tracking-wider text-slate-500 font-bold block">
                      Próximos de {currentDate.toLocaleDateString('pt-BR', { month: 'long' })}:
                    </span>
                    <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1 scrollbar-thin">
                      {getBirthdaysThisMonth().map(cust => {
                        const [_, month, day] = cust.birthDate.split('-');
                        return (
                          <div key={cust.id} className="flex items-center justify-between p-2 bg-slate-950 border border-slate-850 rounded-lg text-[11px]">
                            <span className="font-semibold text-slate-300 truncate max-w-[100px]">{cust.name}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="font-mono text-[9px] text-sky-400 bg-sky-500/5 px-1.5 py-0.2 rounded border border-sky-500/10">{day}/{month}</span>
                              <a 
                                onClick={(e) => {
                                  e.preventDefault();
                                  const text = `Olá, ${cust.name}! Passando para desejar um feliz aniversário antecipado da equipe Senhora Limpeza! 🎂🎈`;
                                  openWhatsAppLink(cust.whatsapp || cust.phone, text);
                                }}
                                href="#"
                                className="p-1 bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 text-[9px] rounded transition-all"
                                title="Dar parabéns"
                              >
                                Parabéns
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- QUICK NEW APPOINTMENT MODAL --- */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-40">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-scaleUp">
            <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Agendar Atendimento</h3>
                <p className="text-[10px] text-sky-400 font-mono">Agendamento rápido via Central Diária</p>
              </div>
              <button onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="p-5 space-y-4 text-xs">
              {errorMessage && (
                <div className="bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-2.5 rounded-xl font-mono">
                  {errorMessage}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Cliente *</label>
                <select 
                  required
                  value={formData.customerId}
                  onChange={(e) => handleCustomerChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white"
                >
                  <option value="" disabled>Selecione um cliente...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Veículo do Cliente *</label>
                <select 
                  required
                  value={formData.vehicleId}
                  onChange={(e) => handleVehicleChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white"
                  disabled={!formData.customerId}
                >
                  <option value="" disabled>{formData.customerId ? 'Selecione o veículo...' : 'Selecione primeiro o cliente'}</option>
                  {bookingVehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.brand} {v.model} ({v.plate})</option>
                  ))}
                </select>
                {formData.customerId && bookingVehicles.length === 0 && (
                  <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1">
                    <AlertTriangle size={10} />
                    <span>Este cliente não possui veículos cadastrados! Cadastre na aba Clientes primeiro.</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Serviço *</label>
                <select 
                  required
                  value={formData.serviceId}
                  onChange={(e) => handleServiceChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white"
                >
                  <option value="" disabled>Selecione o serviço comercial...</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} - R$ {getServicePrice(s, vehicles.find(vehicle => vehicle.id === formData.vehicleId)).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Horário *</label>
                  <input 
                    type="time" 
                    required
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Preço Final (R$) *</label>
                  <input 
                    type="number" 
                    required
                    min="0"
                    step="0.01"
                    value={formData.value || ''}
                    onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Funcionário Alocado *</label>
                <select 
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white"
                >
                  <option value="Gabriel">Gabriel (Polidor Sênior)</option>
                  <option value="Matheus">Matheus (Higienizador Sênior)</option>
                  <option value="Felipe">Felipe (Auxiliar Técnico)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Observações</label>
                <textarea 
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white h-16 resize-none"
                  placeholder="Instruções de pátio..."
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3 text-xs">
                <button 
                  type="button" 
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold rounded-xl"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={!formData.customerId || bookingVehicles.length === 0}
                  className="px-5 py-2 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- 1. FULL INTERACTIVE EDIT DRAWER (SLIDE-OVER PANEL FROM RIGHT OR SLIDING BOTTOM SHEET ON MOBILE) --- */}
      {isDrawerOpen && activeAppt && (
        <div className="fixed inset-0 z-50 flex justify-end lg:items-stretch items-end">
          {/* Semi-transparent backdrop - keeping the dashboard fully visible behind */}
          <div 
            onClick={() => {
              setIsDrawerOpen(false);
              setSelectedApptId(null);
            }}
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity duration-300"
          />

          {/* Sliding drawer panel (Right side on desktop, bottom sheet on mobile) */}
          <div className="relative w-full h-[92vh] lg:h-screen lg:max-w-xl bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 rounded-t-[2.5rem] lg:rounded-t-none overflow-y-auto shadow-2xl flex flex-col z-10 animate-slideUp lg:animate-slideLeft">
            
            {/* Header */}
            <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex flex-col gap-2 sticky top-0 z-20">
              <div className="w-12 h-1 bg-slate-800 rounded-full mx-auto mb-1 shrink-0 lg:hidden" />
              <div className="flex justify-between items-center w-full">
                <div className="space-y-1">
                  <span className="font-mono text-[10px] font-bold text-sky-400 uppercase tracking-widest">
                    Atendimento Diário • OS #{activeAppt.id}
                  </span>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Gerenciamento de Atendimento
                  </h3>
                </div>
                <button 
                  onClick={() => {
                    setIsDrawerOpen(false);
                    setSelectedApptId(null);
                  }} 
                  className="p-1.5 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white rounded-xl border border-slate-800 transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Content Form Scroll Area */}
            <div className="p-6 space-y-6 flex-1 text-xs">
              {errorMessage && (
                <div className="bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-2.5 rounded-xl font-mono">
                  {errorMessage}
                </div>
              )}
              
              {/* PAINEL OPERACIONAL DE EXECUÇÃO */}
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4 shadow-xl">
                <div className="flex justify-between items-center pb-2 border-b border-slate-900">
                  <span className="font-mono text-[10px] font-bold text-sky-400 uppercase tracking-widest flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
                    Fluxo de Execução do Serviço
                  </span>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${getStatusBadgeStyles(editStatus)}`}>
                    {getStatusLabel(editStatus)}
                  </span>
                </div>

                {/* Date / Time logs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] text-slate-400 font-medium font-mono">
                  <div className="bg-slate-900/40 p-2.5 rounded-xl border border-slate-850">
                    <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider mb-0.5 font-sans">⏱️ Horário de Início</span>
                    {editStartedAt ? (
                      <span className="text-slate-200 font-bold">{formatDateTimeDisplay(editStartedAt)}</span>
                    ) : (
                      <span className="text-slate-600 italic font-sans">Não iniciado</span>
                    )}
                  </div>
                  <div className="bg-slate-900/40 p-2.5 rounded-xl border border-slate-850">
                    <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider mb-0.5 font-sans">🏁 Horário de Conclusão</span>
                    {editConcludedAt ? (
                      <span className="text-slate-200 font-bold">{formatDateTimeDisplay(editConcludedAt)}</span>
                    ) : (
                      <span className="text-slate-600 italic font-sans">Pendente</span>
                    )}
                  </div>
                </div>

                {/* Execution action buttons */}
                <div className="pt-2">
                  {!canEditAppointment ? (
                    <div className="w-full py-3 bg-slate-900/80 border border-slate-800 text-slate-400 font-bold text-center text-[10px] uppercase tracking-widest rounded-xl">
                      Modo somente leitura
                    </div>
                  ) : editStatus !== 'em_andamento' && editStatus !== 'finalizado' && editStatus !== 'entregue' && editStatus !== 'cancelado' ? (
                    <button
                      type="button"
                      onClick={handleStartServiceInstant}
                      disabled={isSaving}
                      className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-[0.98] text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/10 cursor-pointer animate-fadeIn"
                    >
                      <span>🛠️ INICIAR ATENDIMENTO</span>
                    </button>
                  ) : editStatus === 'em_andamento' ? (
                    <button
                      type="button"
                      onClick={handleFinishServiceInstant}
                      disabled={isSaving}
                      className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 active:scale-[0.98] text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/10 cursor-pointer animate-fadeIn"
                    >
                      <span>✓ FINALIZAR ATENDIMENTO</span>
                    </button>
                  ) : (
                    <div className="w-full py-3 bg-slate-900/80 border border-slate-800 text-slate-400 font-bold text-center text-[10px] uppercase tracking-widest rounded-xl flex items-center justify-center gap-1.5 animate-fadeIn">
                      <span>✨ ATENDIMENTO FINALIZADO</span>
                    </div>
                  )}
                </div>
              </div>

              {/* CLIENT SECTION */}
              <div className="bg-slate-950/60 p-4.5 rounded-xl border border-slate-800/80 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Users size={14} className="text-sky-400" />
                    Cliente Associado
                  </span>
                  <button 
                    type="button"
                    onClick={() => setIsAddingClient(!isAddingClient)}
                    disabled={!canCreateCustomer}
                    className="text-[10px] text-sky-400 hover:text-sky-350 disabled:opacity-40 disabled:cursor-not-allowed font-bold flex items-center gap-1 transition-colors bg-slate-950 px-2 py-1 rounded border border-slate-800"
                  >
                    <Plus size={10} />
                    <span>{isAddingClient ? 'Cancelar' : 'Cadastrar Rápido'}</span>
                  </button>
                </div>

                {isAddingClient ? (
                  <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg space-y-3 animate-fadeIn">
                    <p className="text-[10px] text-sky-400 font-mono">Cadastrar Cliente Instantâneo:</p>
                    <div className="space-y-2">
                      <input 
                        type="text"
                        placeholder="Nome do Cliente"
                        value={newClientName}
                        onChange={(e) => setNewClientName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded-lg px-2.5 py-2 text-white"
                      />
                      <input 
                        type="text"
                        placeholder="Celular / WhatsApp"
                        value={newClientPhone}
                        onChange={(e) => setNewClientPhone(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded-lg px-2.5 py-2 text-white"
                      />
                      <div>
                        <label className="text-[9px] text-slate-500 font-bold block mb-0.5">Data de Nascimento (Opcional):</label>
                        <input 
                          type="date"
                          value={newClientBirth}
                          onChange={(e) => setNewClientBirth(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded-lg px-2.5 py-2 text-white font-mono"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleQuickAddClient}
                      disabled={!newClientName.trim() || !newClientPhone.trim()}
                      className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-lg text-[10px] uppercase tracking-wider transition-colors"
                    >
                      Salvar e Selecionar
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <select 
                          value={editCustomerId}
                          onChange={(e) => {
                            setEditCustomerId(e.target.value);
                            // Auto select vehicle for that customer
                            const vs = vehicles.filter(v => v.customerId === e.target.value);
                            setEditVehicleId(vs[0]?.id || '');
                          }}
                          className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white"
                        >
                          {customers.map(c => (
                            <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Quick filter tool search */}
                    <div className="space-y-1.5">
                      <input 
                        type="text"
                        placeholder="Pesquisar/Filtrar cliente por nome..."
                        value={clientSearchQuery}
                        onChange={(e) => setClientSearchQuery(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 focus:outline-none focus:border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-[10px]"
                      />
                      {clientSearchQuery && (
                        <div className="bg-slate-950 border border-slate-800 rounded-lg max-h-[110px] overflow-y-auto text-[10px] divide-y divide-slate-850">
                          {filteredCustomers.length === 0 ? (
                            <div className="p-2 text-slate-500 italic">Nenhum cliente correspondente.</div>
                          ) : (
                            filteredCustomers.map(c => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setEditCustomerId(c.id);
                                  const vs = vehicles.filter(v => v.customerId === c.id);
                                  setEditVehicleId(vs[0]?.id || '');
                                  setClientSearchQuery('');
                                }}
                                className="w-full text-left px-2.5 py-1.5 hover:bg-slate-900 text-slate-300 hover:text-white flex justify-between"
                              >
                                <span className="font-bold">{c.name}</span>
                                <span className="text-slate-500 font-mono">{c.phone}</span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* VEHICLE SECTION */}
              <div className="bg-slate-950/60 p-4.5 rounded-xl border border-slate-800/80 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Car size={14} className="text-sky-400" />
                    Veículo Registrado
                  </span>
                  <button 
                    type="button"
                    onClick={() => setIsAddingVehicle(!isAddingVehicle)}
                    disabled={!editCustomerId || !canCreateCustomer}
                    className="text-[10px] text-sky-400 hover:text-sky-350 disabled:opacity-40 disabled:cursor-not-allowed font-bold flex items-center gap-1 transition-colors bg-slate-950 px-2 py-1 rounded border border-slate-800"
                  >
                    <Plus size={10} />
                    <span>{isAddingVehicle ? 'Cancelar' : 'Novo Veículo'}</span>
                  </button>
                </div>

                {isAddingVehicle ? (
                  <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg space-y-3 animate-fadeIn">
                    <p className="text-[10px] text-sky-400 font-mono">Adicionar Veículo para Cliente:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={newVehicleBrand}
                        onChange={(e) => {
                          setNewVehicleBrand(e.target.value);
                          setNewVehicleModel('');
                        }}
                        className="bg-slate-900 border border-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded-lg px-2.5 py-2 text-white"
                        data-testid="dashboard-vehicle-brand"
                      >
                        <option value="" disabled>Selecione a marca</option>
                        {vehicleCatalog.brands.map(brand => (
                          <option key={brand.id} value={brand.name}>{brand.name}</option>
                        ))}
                      </select>
                      <select
                        value={newVehicleModel}
                        onChange={(e) => setNewVehicleModel(e.target.value)}
                        disabled={!newVehicleBrand}
                        className="bg-slate-900 border border-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded-lg px-2.5 py-2 text-white"
                        data-testid="dashboard-vehicle-model"
                      >
                        <option value="" disabled>Selecione o modelo</option>
                        {quickVehicleModels.map(model => (
                          <option key={model.id} value={model.name}>{model.name}</option>
                        ))}
                      </select>
                      <input 
                        type="number"
                        min="1950"
                        max={currentDate.getFullYear() + 1}
                        placeholder="Ano"
                        value={newVehicleYear}
                        onChange={(e) => setNewVehicleYear(e.target.value)}
                        className="bg-slate-900 border border-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded-lg px-2.5 py-2 text-white font-mono"
                      />
                      <input 
                        type="text"
                        placeholder="Placa (Ex: ABC1234)"
                        value={newVehiclePlate}
                        onChange={(e) => setNewVehiclePlate(e.target.value)}
                        className="bg-slate-900 border border-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded-lg px-2.5 py-2 text-white uppercase font-mono"
                      />
                      <input 
                        type="text"
                        placeholder="Cor (Ex: Preto)"
                        value={newVehicleColor}
                        onChange={(e) => setNewVehicleColor(e.target.value)}
                        className="bg-slate-900 border border-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded-lg px-2.5 py-2 text-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleQuickAddVehicle}
                      disabled={
                        !newVehicleBrand.trim()
                        || !newVehicleModel.trim()
                        || !newVehicleYear.trim()
                        || !newVehiclePlate.trim()
                        || !newVehicleColor.trim()
                      }
                      className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-lg text-[10px] uppercase tracking-wider transition-colors"
                    >
                      Cadastrar Veículo
                    </button>
                  </div>
                ) : (
                  <select 
                    value={editVehicleId}
                    onChange={(e) => setEditVehicleId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white"
                    disabled={!editCustomerId}
                  >
                    <option value="" disabled>Selecione um veículo...</option>
                    {editVehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.brand} {v.model} - [{v.plate}] • {v.color}</option>
                    ))}
                  </select>
                )}
                {editCustomerId && editVehicles.length === 0 && !isAddingVehicle && (
                  <p className="text-[10px] text-rose-400 flex items-center gap-1">
                    <AlertTriangle size={10} />
                    <span>Nenhum veículo registrado para este cliente! Cadastre um acima.</span>
                  </p>
                )}
              </div>

              {/* SERVICES SECTION (Multiple selection, tempo estimado, base values auto) */}
              <div className="bg-slate-950/60 p-4.5 rounded-xl border border-slate-800/80 space-y-4">
                <span className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={14} className="text-sky-400" />
                  Serviços do Atendimento (Múltiplos)
                </span>
                
                {/* Primary selection */}
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1">Serviço Principal:</label>
                  <select 
                    value={editServiceId}
                    onChange={(e) => {
                      const selected = e.target.value;
                      setEditServiceId(selected);
                      // Sync in serviceIds list
                      if (!editServiceIds.includes(selected)) {
                        setEditServiceIds([selected, ...editServiceIds.filter(id => id !== editServiceId)]);
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white"
                  >
                    {services.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} - R$ {getServicePrice(s, vehicles.find(vehicle => vehicle.id === editVehicleId)).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Checklist for multiple complementaries */}
                <div className="space-y-2 pt-2 border-t border-slate-900">
                  <label className="text-[10px] text-slate-450 font-bold block">Adicionar Serviços Complementares:</label>
                  <div className="grid grid-cols-2 gap-2 max-h-[140px] overflow-y-auto pr-1">
                    {services.map(s => {
                      const isSelected = editServiceIds.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              // Don't allow empty list, and if removing primary, set another as primary
                              if (editServiceIds.length > 1) {
                                const nextIds = editServiceIds.filter(id => id !== s.id);
                                setEditServiceIds(nextIds);
                                if (editServiceId === s.id) {
                                  setEditServiceId(nextIds[0]);
                                }
                              }
                            } else {
                              setEditServiceIds([...editServiceIds, s.id]);
                            }
                          }}
                          className={`p-2 rounded-lg border text-left flex justify-between items-center transition-all ${
                            isSelected 
                              ? 'bg-sky-500/10 border-sky-500/40 text-sky-400' 
                              : 'bg-slate-900 border-slate-850 hover:bg-slate-850 text-slate-300'
                          }`}
                        >
                          <div className="truncate max-w-[130px]">
                            <p className="font-bold text-[10px] truncate">{s.name}</p>
                            <p className="text-[8px] font-mono opacity-80">
                              R$ {getServicePrice(s, vehicles.find(vehicle => vehicle.id === editVehicleId)).toFixed(2)}
                            </p>
                          </div>
                          {isSelected && <Check size={12} className="stroke-[3] text-sky-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Displaying selected list */}
                <div className="space-y-1 pt-1">
                  <p className="text-[9px] font-mono text-slate-450">Selecionados:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {editServiceIds.map(id => {
                      const s = services.find(srv => srv.id === id);
                      if (!s) return null;
                      return (
                        <span key={id} className="inline-flex items-center gap-1 bg-slate-900 text-slate-200 border border-slate-800 px-2 py-0.5 rounded-full text-[9px] font-semibold">
                          {s.name}
                          <button 
                            type="button"
                            onClick={() => {
                              if (editServiceIds.length > 1) {
                                const nextIds = editServiceIds.filter(x => x !== id);
                                setEditServiceIds(nextIds);
                                if (editServiceId === id) {
                                  setEditServiceId(nextIds[0]);
                                }
                              }
                            }}
                            className="text-slate-500 hover:text-rose-400"
                          >
                            &times;
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* APPOINTMENT DATE/TIME & SLOT MANAGER */}
              <div className="bg-slate-950/60 p-4.5 rounded-xl border border-slate-800/80 space-y-4">
                <span className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar size={14} className="text-sky-400" />
                  Agendamento e Seletor Horários Livres
                </span>
                
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[9px] text-slate-450 font-bold uppercase block mb-1">Data</label>
                    <input 
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded-lg px-2 py-1.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-450 font-bold uppercase block mb-1">Horário</label>
                    <input 
                      type="time"
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded-lg px-2 py-1.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-450 font-bold uppercase block mb-1">Duração Total (min)</label>
                    <input 
                      type="number"
                      value={editDuration}
                      onChange={(e) => setEditDuration(parseInt(e.target.value) || 60)}
                      className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded-lg px-2 py-1.5 text-white font-mono"
                    />
                  </div>
                </div>

                {/* Move to slot visual seletor */}
                <div className="space-y-2 pt-2 border-t border-slate-900">
                  <p className="text-[10px] text-slate-450 font-bold">Mudar agendamento rápido (Horários Livres de hoje):</p>
                  <div className="flex flex-wrap gap-1.5">
                    {baseHours.map(hour => {
                      const isOccupied = appointmentsToday.some(a => {
                        const timePart = a.dateTime.split('T')[1];
                        return timePart && timePart.startsWith(hour) && a.id !== selectedApptId;
                      });
                      const isActiveSlot = editTime.startsWith(hour);

                      return (
                        <button
                          key={hour}
                          type="button"
                          onClick={() => !isOccupied && handleMoveToSlot(hour)}
                          disabled={isOccupied}
                          className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold font-mono transition-all ${
                            isActiveSlot 
                              ? 'bg-sky-500 text-slate-950 border-sky-400' 
                              : isOccupied 
                              ? 'bg-slate-950/20 text-slate-700 border-slate-950 cursor-not-allowed' 
                              : 'bg-slate-900 hover:bg-slate-850 text-emerald-400 border-slate-800'
                          }`}
                        >
                          {hour} {isOccupied ? '🚫' : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Employee selection */}
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1">Funcionário Responsável:</label>
                  <select 
                    value={editEmployeeId}
                    onChange={(e) => setEditEmployeeId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="Gabriel">Gabriel (Polidor Sênior)</option>
                    <option value="Matheus">Matheus (Higienizador Sênior)</option>
                    <option value="Felipe">Felipe (Auxiliar Técnico)</option>
                  </select>
                </div>
              </div>

              {/* VALUE CALCULATOR (Descontos, Acréscimos, Valor Final) */}
              <div className="bg-slate-950/60 p-4.5 rounded-xl border border-slate-800/80 space-y-4">
                <span className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign size={14} className="text-sky-400" />
                  Detalhamento de Valores
                </span>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[9px] text-slate-450 font-bold block mb-1">Desconto (R$)</label>
                    <input 
                      type="number"
                      min="0"
                      step="0.01"
                      value={editDiscount || ''}
                      onChange={(e) => setEditDiscount(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-450 font-bold block mb-1">Acréscimo (R$)</label>
                    <input 
                      type="number"
                      min="0"
                      step="0.01"
                      value={editAddition || ''}
                      onChange={(e) => setEditAddition(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-mono"
                    />
                  </div>
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/60 flex flex-col justify-center items-center">
                    <span className="text-[9px] text-sky-400 font-bold uppercase">Preço Final</span>
                    <span className="text-sm font-black text-emerald-400 font-mono">
                      R$ {editValue.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 font-mono flex justify-between bg-slate-900/50 p-2 rounded border border-slate-850">
                  <span>Base dos Serviços Selecionados:</span>
                  <span>
                    R$ {getServicesPrice(
                      services,
                      editServiceIds,
                      vehicles.find(vehicle => vehicle.id === editVehicleId)
                    ).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* OBSERVATIONS (Campo Grande) */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Observações e Alertas do Atendimento
                </label>
                <textarea 
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-4 py-3 text-white h-24"
                  placeholder="Ex: Cliente aguardando • Entregar até 16h • Atenção ao retrovisor • Risco na porta esquerda"
                />
              </div>

              {/* HISTORY AND AUDIT (Data cadastro, Última alteração, Timeline) */}
              <div className="bg-slate-950/80 p-4.5 rounded-xl border border-slate-850 space-y-3">
                <span className="font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 text-[10px]">
                  <History size={13} className="text-slate-400" />
                  Histórico de Alterações (Auditoria)
                </span>
                
                <div className="grid grid-cols-2 gap-4 text-[10px] text-slate-400 border-b border-slate-900 pb-2.5 font-mono">
                  <div>
                    <p className="text-slate-500 text-[9px] uppercase">Data de Cadastro:</p>
                    <p className="text-slate-300 font-bold">{activeAppt.createdAt ? new Date(activeAppt.createdAt).toLocaleString('pt-BR') : 'Não informado'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-[9px] uppercase">Última Alteração:</p>
                    <p className="text-slate-300 font-bold">{activeAppt.updatedAt ? new Date(activeAppt.updatedAt).toLocaleString('pt-BR') : 'Não informado'}</p>
                  </div>
                </div>

                <div className="pt-2.5 space-y-2">
                  <p className="text-[9px] uppercase font-mono text-slate-500 font-bold block">Linha do Tempo:</p>
                  {activeAppt.changelog && activeAppt.changelog.length > 0 ? (
                    <div className="relative border-l border-slate-800 ml-2.5 pl-4 space-y-3">
                      {activeAppt.changelog.map((log, idx) => (
                        <div key={idx} className="relative text-[10px]">
                          <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-sky-500/20 border border-sky-500" />
                          <div className="flex justify-between items-start text-[9px] text-slate-500">
                            <span>{new Date(log.date).toLocaleString('pt-BR')}</span>
                            <span className="font-bold text-sky-500/80 font-mono">{log.user}</span>
                          </div>
                          <p className="text-slate-300 mt-0.5 font-medium">{log.action}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] italic text-slate-650 font-mono pl-2">Nenhum histórico adicional registrado.</p>
                  )}
                </div>
              </div>

            </div>

            {/* Quick Actions Panel & Save bar */}
            <div className="bg-slate-950 p-5 border-t border-slate-800 sticky bottom-0 space-y-4 animate-slideUp">
              
              {/* WhatsApp & Imprimir OS */}
              <div className="grid grid-cols-2 gap-2">
                <a 
                  href={getWhatsAppTemplateURL()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/15 rounded-xl font-bold text-[10px] text-center uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-colors animate-fadeIn"
                >
                  📲 WhatsApp Cliente
                </a>
                <button 
                  type="button"
                  onClick={handlePrintOS}
                  className="py-2.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/15 rounded-xl font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Printer size={12} /> Imprimir OS
                </button>
              </div>

              {/* Destructive actions */}
              {canDeleteAppointment && (
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Tem certeza de que deseja excluir este agendamento?')) {
                        void handleDeleteAppointment();
                      }
                    }}
                    className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/15 rounded-xl font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Trash2 size={12} /> Excluir OS (Apagar Registro)
                  </button>
                </div>
              )}

              {/* Primary submit */}
              <div className="pt-2 border-t border-slate-900 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => {
                    setIsDrawerOpen(false);
                    setSelectedApptId(null);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold rounded-xl text-xs cursor-pointer"
                >
                  Fechar
                </button>
                {canEditAppointment && (
                  <button 
                    type="button" 
                    onClick={handleSaveDrawerEdits}
                    className="px-6 py-2 bg-sky-500 hover:bg-sky-600 text-slate-950 font-extrabold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-sky-500/10"
                  >
                    <Save size={14} className="stroke-[2.5]" />
                    <span>Salvar Alterações</span>
                  </button>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
