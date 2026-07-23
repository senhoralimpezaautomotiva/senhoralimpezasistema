/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Clock, 
  User, 
  Car, 
  CheckCircle, 
  X, 
  HelpCircle,
  Play,
  Check,
  AlertTriangle
} from 'lucide-react';
import { Appointment, Customer, Vehicle, Service, AppointmentStatus, SystemConfig, User as SystemUser } from '../types';
import { getServicePrice, hasModulePermission } from '../db/localDb';
import { getCurrentDate, getCurrentDateStr, getCurrentMonthPrefix, getCurrentYear } from '../utils/dateUtils';
import { AppointmentGridCard, EmptySlotCard } from './AppointmentGridCard';

interface AgendaModuleProps {
  appointments: Appointment[];
  customers: Customer[];
  vehicles: Vehicle[];
  services: Service[];
  users?: SystemUser[];
  config?: SystemConfig;
  currentUser?: any;
  onAddAppointment: (appointment: Omit<Appointment, 'id'>) => Promise<any>;
  onUpdateStatus: (id: string, status: AppointmentStatus, notes?: string) => Promise<any>;
  onDeleteAppointment: (id: string) => Promise<any>;
  onUpdateAppointment?: (id: string, updated: Partial<Appointment>) => Promise<any>;
}

export default function AgendaModule({ 
  appointments, 
  customers, 
  vehicles, 
  services, 
  users = [],
  config,
  currentUser,
  onAddAppointment, 
  onUpdateStatus, 
  onDeleteAppointment,
  onUpdateAppointment
}: AgendaModuleProps) {
  const canCreate = hasModulePermission(currentUser, 'agenda', 'create');
  const canEdit = hasModulePermission(currentUser, 'agenda', 'edit');
  const canDelete = hasModulePermission(currentUser, 'agenda', 'delete');
  // Dynamic Calendar Anchor
  const todayDateObj = getCurrentDate();
  const currentYear = todayDateObj.getFullYear();
  const currentMonthIdx = todayDateObj.getMonth(); // 0-indexed month
  const monthName = (() => {
    const rawName = todayDateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return rawName.charAt(0).toUpperCase() + rawName.slice(1);
  })();
  const daysInMonth = new Date(currentYear, currentMonthIdx + 1, 0).getDate();
  const firstDayOffset = new Date(currentYear, currentMonthIdx, 1).getDay();

  const [selectedDay, setSelectedDay] = useState<number>(todayDateObj.getDate());
  const [viewMode, setViewMode] = useState<'month' | 'day'>('month');
  const [editingApptId, setEditingApptId] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeStatusTransitionId, setActiveStatusTransitionId] = useState<string | null>(null);

  // Load agenda settings or use defaults
  const agenda = config?.agenda || {
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

  // Helper to convert time string (HH:MM) to minutes from midnight
  const timeToMinutes = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + (m || 0);
  };

  const getSlotOccupancyCount = (dateStr: string, slotTimeStr: string, excludeApptId?: string) => {
    const slotMins = timeToMinutes(slotTimeStr);
    
    // Find all appointments on this day that are not cancelled
    const dayAppts = appointments.filter(a => a.dateTime.startsWith(dateStr) && a.status !== 'cancelado' && a.id !== excludeApptId);
    
    let count = 0;
    for (const appt of dayAppts) {
      const apptTimeStr = appt.dateTime.split('T')[1];
      const apptService = services.find(s => s.id === appt.serviceId);
      const duration = appt.durationTotal || apptService?.estimatedTime || 60; // fallback to 60 min
      
      const startMins = timeToMinutes(apptTimeStr);
      const endMins = startMins + duration;
      
      if (agenda.autoBlockDuration) {
        // If automatic block is enabled, count if slot falls inside [start, end)
        if (slotMins >= startMins && slotMins < endMins) {
          count++;
        }
      } else {
        // If not enabled, only count if it starts at the exact same time
        if (apptTimeStr === slotTimeStr) {
          count++;
        }
      }
    }
    return count;
  };
  
  // Form States for booking
  const [formData, setFormData] = useState({
    customerId: '',
    vehicleId: '',
    serviceId: '',
    time: '09:00',
    value: 0,
    employeeId: 'Gabriel',
    notes: ''
  });

  // Calculate day-by-day counts dynamically
  const getDayAppointments = (dayNum: number) => {
    const dayStr = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, '0')}-${dayNum.toString().padStart(2, '0')}`;
    return appointments.filter(a => a.dateTime.startsWith(dayStr));
  };

  const selectedDayStr = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, '0')}-${selectedDay.toString().padStart(2, '0')}`;
  const selectedDayAppointments = appointments.filter(a => a.dateTime.startsWith(selectedDayStr));

  // Determine standard operational hours from dynamic agenda config
  const baseHours = useMemo(() => {
    if (agenda && Array.isArray(agenda.timeSlots) && agenda.timeSlots.length > 0) {
      return agenda.timeSlots.map((s: any) => s.time);
    }
    return ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
  }, [config]);

  // Handle Duplicating an Appointment on the same day slot
  const handleDuplicateAppointment = async (apptId: string) => {
    const toClone = appointments.find(a => a.id === apptId);
    if (!toClone) return;

    setIsSaving(true);
    setErrorMessage(null);
    try {
      await onAddAppointment({
        customerId: toClone.customerId,
        vehicleId: toClone.vehicleId,
        serviceId: toClone.serviceId,
        serviceIds: toClone.serviceIds || [toClone.serviceId],
        dateTime: toClone.dateTime, // keeps same slot
        status: 'agendado',
        value: toClone.value,
        discount: toClone.discount || 0,
        addition: toClone.addition || 0,
        durationTotal: toClone.durationTotal || 60,
        employeeId: toClone.employeeId,
        notes: `Duplicado - ${toClone.notes}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } catch (err: any) {
      console.error('Erro ao duplicar agendamento:', err);
      setErrorMessage(err.message || 'Erro ao duplicar agendamento.');
    } finally {
      setIsSaving(false);
    }
  };

  // Open the modal form in Edit Mode
  const handleEditClick = (apptId: string) => {
    const appt = appointments.find(a => a.id === apptId);
    if (!appt) return;

    setEditingApptId(appt.id);
    setFormData({
      customerId: appt.customerId,
      vehicleId: appt.vehicleId,
      serviceId: appt.serviceId,
      time: appt.dateTime.split('T')[1]?.slice(0, 5) || '08:00',
      value: appt.value,
      employeeId: appt.employeeId || 'Gabriel',
      notes: appt.notes || ''
    });
    setIsAddOpen(true);
  };

  const handleCustomerChange = (customerId: string) => {
    // Auto find first vehicle for this customer
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

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSaving(true);

    const apptTime = formData.time; // "HH:MM"
    const dateTimeStr = `${selectedDayStr}T${apptTime}`;

    // 1. DAY OF WEEK & OPERATING STATUS CHECKS
    const dateOfBooking = new Date(currentYear, currentMonthIdx, selectedDay);
    const dayOfWeekIdx = dateOfBooking.getDay(); // 0-6 (Sun-Sat)
    
    const dayConfig = agenda.days.find((d: any) => d.dayOfWeek === dayOfWeekIdx);
    if (!dayConfig || !dayConfig.isActive) {
      setErrorMessage(`O estabelecimento está fechado aos ${dayConfig?.dayName || 'Domingos'}. Escolha outro dia.`);
      setIsSaving(false);
      return;
    }

    // 2. OPERATING HOURS CHECKS
    if (apptTime < dayConfig.openTime || apptTime >= dayConfig.closeTime) {
      setErrorMessage(`Horário inválido. O expediente para ${dayConfig.dayName} é das ${dayConfig.openTime} às ${dayConfig.closeTime}.`);
      setIsSaving(false);
      return;
    }

    // 3. LUNCH BREAK CHECKS
    if (dayConfig.hasLunchBreak) {
      if (apptTime >= dayConfig.lunchStart && apptTime < dayConfig.lunchEnd) {
        setErrorMessage(`Este horário coincide com o intervalo de almoço do estabelecimento (${dayConfig.lunchStart} às ${dayConfig.lunchEnd}).`);
        setIsSaving(false);
        return;
      }
    }

    // 4. ANTECEDENCE RULE CHECKS (Dynamic current date)
    const now = getCurrentDate();
    const bookingDate = new Date(currentYear, currentMonthIdx, selectedDay, parseInt(apptTime.split(':')[0]), parseInt(apptTime.split(':')[1]), 0);
    
    const diffMs = bookingDate.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffHours < 0) {
      setErrorMessage(`Não é possível agendar em datas passadas.`);
      setIsSaving(false);
      return;
    }

    if (diffHours < agenda.minAdvanceHours) {
      setErrorMessage(`Antecedência mínima para agendamento é de ${agenda.minAdvanceHours} horas.`);
      setIsSaving(false);
      return;
    }

    if (diffDays > agenda.maxAdvanceDays) {
      setErrorMessage(`Antecedência máxima para agendamento é de ${agenda.maxAdvanceDays} dias.`);
      setIsSaving(false);
      return;
    }

    // 5. MAX VEHICLE CAPACITY & SERVICE DURATION CHECKS
    const selectedService = services.find(s => s.id === formData.serviceId);
    const serviceDuration = selectedService?.estimatedTime || 60; // in minutes
    
    const proposedStartMins = timeToMinutes(apptTime);
    const proposedEndMins = proposedStartMins + serviceDuration;

    if (agenda.autoBlockDuration) {
      // Find all active custom slots that would overlap with the service duration
      const overlappingSlots = agenda.timeSlots.filter((s: any) => {
        const slotMins = timeToMinutes(s.time);
        return slotMins >= proposedStartMins && slotMins < proposedEndMins;
      });

      for (const slot of overlappingSlots) {
        const occupancy = getSlotOccupancyCount(selectedDayStr, slot.time);
        if (occupancy >= slot.maxCapacity) {
          setErrorMessage(`Capacidade esgotada no horário das ${slot.time} (${occupancy}/${slot.maxCapacity} vagas ocupadas). O serviço "${selectedService?.name}" (${serviceDuration} min) ocuparia este período.`);
          setIsSaving(false);
          return;
        }
      }
    } else {
      // Just check the exact starting slot capacity
      const startSlot = agenda.timeSlots.find((s: any) => s.time === apptTime);
      if (startSlot) {
        const occupancy = getSlotOccupancyCount(selectedDayStr, startSlot.time);
        if (occupancy >= startSlot.maxCapacity) {
          setErrorMessage(`O horário das ${apptTime} já atingiu a capacidade máxima de ${startSlot.maxCapacity} veículos.`);
          setIsSaving(false);
          return;
        }
      }
    }

    try {
      if (editingApptId) {
        if (onUpdateAppointment) {
          await onUpdateAppointment(editingApptId, {
            customerId: formData.customerId,
            vehicleId: formData.vehicleId,
            serviceId: formData.serviceId,
            dateTime: dateTimeStr,
            value: formData.value,
            employeeId: formData.employeeId,
            notes: formData.notes
          });
        }
        setEditingApptId(null);
      } else {
        await onAddAppointment({
          customerId: formData.customerId,
          vehicleId: formData.vehicleId,
          serviceId: formData.serviceId,
          dateTime: dateTimeStr,
          status: 'agendado',
          value: formData.value,
          employeeId: formData.employeeId,
          notes: formData.notes
        });
      }
      setIsAddOpen(false);
    } catch (err: any) {
      console.error('Erro ao salvar agendamento:', err);
      setErrorMessage(err.message || 'Erro ao processar agendamento no Supabase.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: AppointmentStatus, notes?: string) => {
    setErrorMessage(null);
    setActiveStatusTransitionId(id);
    try {
      await onUpdateStatus(id, status, notes);
    } catch (err: any) {
      console.error('Erro ao atualizar status do agendamento:', err);
      alert(err.message || 'Erro ao atualizar status no Supabase.');
    } finally {
      setActiveStatusTransitionId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setErrorMessage(null);
    setActiveStatusTransitionId(id);
    try {
      await onDeleteAppointment(id);
    } catch (err: any) {
      console.error('Erro ao deletar agendamento:', err);
      alert(err.message || 'Erro ao deletar agendamento no Supabase.');
    } finally {
      setActiveStatusTransitionId(null);
    }
  };

  const getStatusBadgeClass = (status: AppointmentStatus) => {
    switch (status) {
      case 'agendado': return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      case 'confirmado': return 'bg-violet-500/10 text-violet-400 border border-violet-500/20';
      case 'em_andamento': return 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse';
      case 'finalizado': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'cancelado': return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
    }
  };

  const getStatusLabel = (status: AppointmentStatus) => {
    switch (status) {
      case 'agendado': return 'Agendado';
      case 'confirmado': return 'Confirmado';
      case 'em_andamento': return 'Em Andamento';
      case 'finalizado': return 'Finalizado';
      case 'cancelado': return 'Cancelado';
    }
  };

  // Generate calendar cells
  const calendarCells = [];
  // Pads
  for (let i = 0; i < firstDayOffset; i++) {
    calendarCells.push(<div key={`pad-${i}`} className="h-14 sm:h-20 bg-slate-950/20 border border-slate-800/40 opacity-30" />);
  }
  // Days
  for (let d = 1; d <= daysInMonth; d++) {
    const dayAppts = getDayAppointments(d);
    const isSelected = selectedDay === d;
    const isToday = d === 15; // Simulated today date is July 15

    calendarCells.push(
      <button
        key={`day-${d}`}
        onClick={() => {
          setSelectedDay(d);
          setViewMode('day');
        }}
        className={`h-14 sm:h-20 p-2 border border-slate-800 flex flex-col justify-between items-start transition-all relative outline-none cursor-pointer ${
          isSelected 
            ? 'bg-sky-500/10 border-sky-500 text-sky-400 ring-1 ring-sky-500/30' 
            : isToday 
              ? 'bg-slate-850 border-slate-700 hover:bg-slate-800' 
              : 'bg-slate-900 hover:bg-slate-850'
        }`}
      >
        <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
          isToday ? 'bg-sky-500 text-white shadow-sm' : isSelected ? 'text-sky-400' : 'text-slate-400'
        }`}>
          {d}
        </span>

        {dayAppts.length > 0 && (
          <div className="flex gap-1 flex-wrap w-full">
            {dayAppts.map((appt) => {
              let dotColor = 'bg-blue-400';
              if (appt.status === 'confirmado') dotColor = 'bg-violet-400';
              if (appt.status === 'em_andamento') dotColor = 'bg-amber-400';
              if (appt.status === 'finalizado') dotColor = 'bg-emerald-400';
              if (appt.status === 'cancelado') dotColor = 'bg-rose-400';

              return (
                <span 
                  key={appt.id} 
                  className={`w-1.5 h-1.5 rounded-full ${dotColor}`}
                  title={`${appt.dateTime.split('T')[1]} - ${appt.notes}`}
                />
              );
            })}
          </div>
        )}
      </button>
    );
  }

  // Filter vehicles for currently chosen customer in booking form
  const bookingVehicles = vehicles.filter(v => v.customerId === formData.customerId);

  // Render time slots dropdown options
  const activeSlotsOptions = agenda.timeSlots.map((slot: any) => {
    const occupancy = getSlotOccupancyCount(selectedDayStr, slot.time);
    const isFull = occupancy >= slot.maxCapacity;
    return {
      time: slot.time,
      capacity: slot.maxCapacity,
      occupancy,
      isFull
    };
  });

  const addModalElement = isAddOpen && (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-scaleUp">
        <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
          <div>
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
              {editingApptId ? 'Editar Agendamento' : 'Agendar Atendimento'}
            </h3>
            <p className="text-[10px] text-sky-400 font-mono">Agendando para: {String(selectedDay).padStart(2, '0')}/{String(currentMonthIdx + 1).padStart(2, '0')}/{currentYear}</p>
          </div>
          <button onClick={() => { setIsAddOpen(false); setEditingApptId(null); }} className="text-slate-400 hover:text-white transition-colors">
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
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Cliente *</label>
            <select 
              required
              disabled={isSaving}
              value={formData.customerId}
              onChange={(e) => handleCustomerChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white disabled:opacity-50"
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
              className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white disabled:opacity-50"
              disabled={isSaving || !formData.customerId}
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
              disabled={isSaving}
              value={formData.serviceId}
              onChange={(e) => handleServiceChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white disabled:opacity-50"
            >
              <option value="" disabled>Selecione o serviço comercial...</option>
              {services.map(s => (
                <option key={s.id} value={s.id}>{s.name} - R$ {s.basePrice.toFixed(2)}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Horário *</label>
              {activeSlotsOptions.length > 0 ? (
                <select 
                  required
                  disabled={isSaving}
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white font-mono disabled:opacity-50"
                >
                  <option value="" disabled>Selecione um horário...</option>
                  {activeSlotsOptions.map(opt => (
                    <option key={opt.time} value={opt.time} disabled={opt.isFull && !editingApptId}>
                      {opt.time} {opt.isFull ? '• Lotado' : `• (${opt.occupancy}/${opt.capacity} vagas)`}
                    </option>
                  ))}
                </select>
              ) : (
                <input 
                  type="time" 
                  required
                  disabled={isSaving}
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white font-mono disabled:opacity-50"
                />
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Preço Final (R$) *</label>
              <input 
                type="number" 
                required
                min="0"
                step="0.01"
                disabled={isSaving}
                value={formData.value || ''}
                onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white font-mono disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
              Responsável pela Execução (Comissão)
            </label>
            <select 
              disabled={isSaving}
              value={formData.employeeId}
              onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white disabled:opacity-50"
            >
              <option value="">Nenhum Responsável Alocado (Sem comissão)</option>
              {users.length > 0 ? (
                users.filter(u => u.status === 'ativo').map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role.toUpperCase()})
                  </option>
                ))
              ) : (
                <>
                  <option value="Gabriel">Gabriel (Polidor Sênior)</option>
                  <option value="Matheus">Matheus (Higienizador Sênior)</option>
                  <option value="Felipe">Felipe (Auxiliar Técnico)</option>
                </>
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Observações do Agendamento</label>
            <textarea 
              disabled={isSaving}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-xl px-3 py-2 text-white h-16 resize-none disabled:opacity-50"
              placeholder="Ex: Carro com muito piche na saia lateral, etc..."
            />
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-end gap-3 text-xs">
            <button 
              type="button" 
              disabled={isSaving}
              onClick={() => { setIsAddOpen(false); setEditingApptId(null); }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold rounded-xl disabled:opacity-50"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={isSaving || !formData.customerId || bookingVehicles.length === 0}
              className="px-5 py-2 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSaving ? 'Gravando...' : (editingApptId ? 'Salvar Alterações' : 'Marcar Atendimento')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (viewMode === 'day') {
    return (
      <div className="space-y-6 animate-fadeIn" id="agenda-module-view">
        {/* Day Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 p-6 rounded-2xl border border-slate-800">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse" />
              Agenda Diária • {String(selectedDay).padStart(2, '0')}/{String(currentMonthIdx + 1).padStart(2, '0')}/{currentYear}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Visualização operacional completa com quadro de horários em tempo real.
            </p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button 
              onClick={() => setViewMode('month')}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-2 border border-slate-750"
            >
              ← Voltar para Agenda Mensal
            </button>
            {canCreate && (
              <button 
                onClick={() => {
                  setEditingApptId(null);
                  setFormData({
                    customerId: customers[0]?.id || '',
                    vehicleId: vehicles.find(v => v.customerId === customers[0]?.id)?.id || '',
                    serviceId: services[0]?.id || '',
                    time: baseHours[0] || '08:00',
                    value: services[0]?.basePrice || 0,
                    employeeId: 'Gabriel',
                    notes: ''
                  });
                  setIsAddOpen(true);
                }}
                className="px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl shadow-[0_0_15px_rgba(14,165,233,0.35)] transition-all cursor-pointer"
              >
                + Novo Agendamento
              </button>
            )}
          </div>
        </div>

        {/* 3 Stats cards identical to the dashboard style */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 flex flex-col justify-between hover:border-slate-700/50 transition-all shadow-sm">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Atendimentos Agendados</span>
                <span className="text-xl font-extrabold text-white tracking-tight">{selectedDayAppointments.length}</span>
              </div>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center border border-sky-500/20 text-sky-400 bg-sky-500/10 shadow-inner shrink-0">
                <CalendarIcon size={16} />
              </div>
            </div>
            <div className="mt-3.5 pt-2.5 border-t border-slate-800/60 flex justify-between items-center text-[10px] text-slate-400">
              <span>Serviços agendados</span>
            </div>
          </div>

          <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 flex flex-col justify-between hover:border-slate-700/50 transition-all shadow-sm">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Faturamento Previsto</span>
                <span className="text-xl font-extrabold text-emerald-400 tracking-tight">
                  R$ {selectedDayAppointments.filter(a => a.status !== 'cancelado').reduce((sum, a) => sum + a.value, 0).toFixed(2)}
                </span>
              </div>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center border border-emerald-500/20 text-emerald-400 bg-emerald-500/10 shadow-inner shrink-0">
                <span className="font-bold text-xs">R$</span>
              </div>
            </div>
            <div className="mt-3.5 pt-2.5 border-t border-slate-800/60 flex justify-between items-center text-[10px] text-slate-400">
              <span>Serviços não cancelados</span>
            </div>
          </div>

          <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 flex flex-col justify-between hover:border-slate-700/50 transition-all shadow-sm">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Finalizados</span>
                <span className="text-xl font-extrabold text-violet-400 tracking-tight">
                  {selectedDayAppointments.filter(a => a.status === 'finalizado').length}
                </span>
              </div>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center border border-violet-500/20 text-violet-400 bg-violet-500/10 shadow-inner shrink-0">
                <CheckCircle size={16} />
              </div>
            </div>
            <div className="mt-3.5 pt-2.5 border-t border-slate-800/60 flex justify-between items-center text-[10px] text-slate-400">
              <span>Concluídos hoje</span>
            </div>
          </div>
        </div>

        {/* 3x3 chronological grid */}
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Quadro de Horários</h2>
            <span className="text-[10px] text-slate-400 font-mono">Ordenados Cronologicamente</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {baseHours.map((hour) => {
              const appt = selectedDayAppointments.find(a => {
                const timePart = a.dateTime.split('T')[1];
                return timePart && timePart.startsWith(hour);
              });

              if (appt) {
                return (
                  <AppointmentGridCard
                    key={appt.id}
                    appt={appt}
                    customers={customers}
                    vehicles={vehicles}
                    services={services}
                    onEditClick={handleEditClick}
                    onDuplicateClick={handleDuplicateAppointment}
                    onUpdateStatus={handleUpdateStatus}
                  />
                );
              } else {
                return (
                  <EmptySlotCard
                    key={hour}
                    hour={hour}
                    onBookClick={(h) => {
                      setEditingApptId(null);
                      setFormData({
                        customerId: customers[0]?.id || '',
                        vehicleId: vehicles.find(v => v.customerId === customers[0]?.id)?.id || '',
                        serviceId: services[0]?.id || '',
                        time: h,
                        value: services[0]?.basePrice || 0,
                        employeeId: 'Gabriel',
                        notes: ''
                      });
                      setIsAddOpen(true);
                    }}
                  />
                );
              }
            })}
          </div>
        </div>

        {addModalElement}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn" id="agenda-module-view">
      {/* Calendar Grid Container */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* MONTHLY CALENDAR GRID */}
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 lg:col-span-2 space-y-4 shadow-sm">
          <div className="flex justify-between items-center bg-slate-900">
            <div className="flex items-center gap-3">
              <CalendarIcon size={20} className="text-sky-500" />
              <h2 className="text-base font-bold text-white tracking-tight">{monthName}</h2>
            </div>
            <div className="flex items-center gap-1">
              <button disabled className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 cursor-not-allowed">
                <ChevronLeft size={16} />
              </button>
              <button disabled className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 cursor-not-allowed">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center font-semibold text-[10px] font-mono tracking-wider text-slate-400 uppercase py-2 border-b border-slate-800">
            <div>Dom</div>
            <div>Seg</div>
            <div>Ter</div>
            <div>Qua</div>
            <div>Qui</div>
            <div>Sex</div>
            <div>Sáb</div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarCells}
          </div>
        </div>

        {/* DAILY APPOINTMENTS WORKFLOW */}
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex flex-col shadow-sm gap-5">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-sky-400 font-bold">Fila Diária</span>
              <h3 className="text-sm font-bold text-white">Atendimentos do dia {selectedDay}/07</h3>
            </div>
            <button 
              onClick={() => {
                setFormData({
                  customerId: customers[0]?.id || '',
                  vehicleId: vehicles.find(v => v.customerId === customers[0]?.id)?.id || '',
                  serviceId: services[0]?.id || '',
                  time: agenda.timeSlots[0]?.time || '08:00',
                  value: services[0]?.basePrice || 0,
                  employeeId: 'Gabriel',
                  notes: ''
                });
                setIsAddOpen(true);
              }}
              className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 font-bold text-[11px] text-white rounded-xl shadow-md flex items-center gap-1.5 transition-colors cursor-pointer"
              id="btn-new-appointment"
            >
              <Plus size={13} />
              <span>Novo Agendamento</span>
            </button>
          </div>

          {selectedDayAppointments.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs italic space-y-2">
              <CalendarIcon size={24} className="mx-auto text-slate-600" />
              <p>Nenhum serviço agendado para este dia.</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
              {selectedDayAppointments.map((appt) => {
                const client = customers.find(c => c.id === appt.customerId);
                const vehicle = vehicles.find(v => v.id === appt.vehicleId);
                const service = services.find(s => s.id === appt.serviceId);
                const hour = appt.dateTime.split('T')[1] || '00:00';

                return (
                  <div key={appt.id} className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl relative hover:border-slate-700/60 transition-all text-xs space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2 font-mono font-bold text-white text-xs">
                        <Clock size={12} className="text-sky-400" />
                        <span>{hour}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${getStatusBadgeClass(appt.status)}`}>
                        {getStatusLabel(appt.status)}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-slate-300">
                      <div className="font-semibold text-white flex items-center gap-1.5">
                        <User size={12} className="text-slate-500" />
                        <span>{client ? client.name : 'Cliente Desconhecido'}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
                        <Car size={12} className="text-slate-500" />
                        <span>{vehicle ? `${vehicle.brand} ${vehicle.model} [${vehicle.plate}]` : 'Sem Veículo'}</span>
                      </div>
                      <div className="pt-1.5 font-bold text-sky-400">
                        {appt.serviceIds && appt.serviceIds.length > 0 
                          ? appt.serviceIds.map(id => services.find(s => s.id === id)?.name).filter(Boolean).join(' + ')
                          : (service ? service.name : 'Serviço')}
                      </div>
                      <div className="text-emerald-400 font-mono font-bold">
                        Valor: R$ {appt.value.toFixed(2)}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        Responsável: <span className="text-slate-200 font-medium">{appt.employeeId}</span>
                      </div>
                      {appt.notes && (
                        <p className="text-[11px] text-slate-400 italic bg-slate-900/50 p-2 rounded-lg border border-slate-850">
                          Obs: {appt.notes}
                        </p>
                      )}
                    </div>

                    {/* Operational Status Transitions */}
                    <div className="pt-3 border-t border-slate-800/80 flex gap-2 justify-end flex-wrap">
                      {appt.status === 'agendado' && (
                        <button 
                          disabled={activeStatusTransitionId === appt.id}
                          onClick={() => handleUpdateStatus(appt.id, 'confirmado')}
                          className="px-2.5 py-1 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 border border-violet-500/25 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 disabled:opacity-50"
                        >
                          <Check size={11} />
                          <span>{activeStatusTransitionId === appt.id ? 'Salvando...' : 'Confirmar'}</span>
                        </button>
                      )}
                      {appt.status === 'confirmado' && (
                        <button 
                          disabled={activeStatusTransitionId === appt.id}
                          onClick={() => handleUpdateStatus(appt.id, 'em_andamento')}
                          className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/25 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 disabled:opacity-50"
                        >
                          <Play size={11} />
                          <span>{activeStatusTransitionId === appt.id ? 'Salvando...' : 'Iniciar'}</span>
                        </button>
                      )}
                      {appt.status === 'em_andamento' && (
                        <button 
                          disabled={activeStatusTransitionId === appt.id}
                          onClick={() => handleUpdateStatus(appt.id, 'finalizado')}
                          className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 disabled:opacity-50"
                        >
                          <CheckCircle size={11} />
                          <span>{activeStatusTransitionId === appt.id ? 'Salvando...' : 'Finalizar'}</span>
                        </button>
                      )}
                      {appt.status !== 'finalizado' && appt.status !== 'cancelado' && (
                        <button 
                          disabled={activeStatusTransitionId === appt.id}
                          onClick={() => {
                            if (confirm('Deseja realmente cancelar este agendamento?')) {
                              handleUpdateStatus(appt.id, 'cancelado');
                            }
                          }}
                          className="px-2 py-1 bg-slate-800 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/25 border border-slate-750 text-slate-400 rounded-lg text-[10px] transition-all disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                      )}
                      <button 
                        disabled={activeStatusTransitionId === appt.id}
                        onClick={() => {
                          if (confirm('Excluir agendamento?')) {
                            handleDelete(appt.id);
                          }
                        }}
                        className="px-2 py-1 bg-slate-900 hover:bg-red-500/10 border border-slate-800 text-[10px] text-red-500 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {addModalElement}
    </div>
  );
}
