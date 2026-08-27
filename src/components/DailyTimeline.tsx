import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clock, Copy, Edit3, MessageCircle, MoreVertical, Repeat } from 'lucide-react';
import { AgendaConfig, Appointment, AppointmentStatus, Customer, Service, Vehicle } from '../types';
import { dbInstance, renderTemplateText } from '../db/localDb';
import { getStatusBadgeStyles, getStatusLabel } from './AppointmentGridCard';

interface DailyTimelineProps {
  date: string;
  agenda: AgendaConfig;
  appointments: Appointment[];
  customers: Customer[];
  vehicles: Vehicle[];
  services: Service[];
  nextAppointmentId?: string | null;
  onCreateAppointment: (time: string) => void;
  onEditAppointment: (id: string) => void;
  onDuplicateAppointment: (id: string) => void;
  onUpdateStatus: (id: string, status: AppointmentStatus) => void;
  canCreate?: boolean;
  canEdit?: boolean;
  className?: string;
}

const PIXELS_PER_MINUTE = 1.6;
const TIMELINE_VERTICAL_PADDING = 14;
const TIME_ACCENT_CLASS = 'text-[#F0B86A]';

const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.slice(0, 5).split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const getAppointmentDuration = (appointment: Appointment, services: Service[]): number => {
  const service = services.find(candidate => candidate.id === appointment.serviceId);
  return appointment.durationTotal || service?.estimatedTime || 60;
};

const getSlotIntervalMinutes = (agenda: AgendaConfig): number => {
  const sortedSlots = [...agenda.timeSlots]
    .map(slot => timeToMinutes(slot.time))
    .sort((a, b) => a - b);
  const intervals = sortedSlots
    .slice(1)
    .map((slot, index) => slot - sortedSlots[index])
    .filter(interval => interval > 0);
  return Math.min(...intervals, 30);
};

const getCleanPhoneForWhatsApp = (whatsapp?: string, phone?: string): string => {
  let clean = (whatsapp || phone || '').replace(/\D/g, '');
  if (!clean) return '';
  if (!clean.startsWith('55') && (clean.length === 10 || clean.length === 11)) {
    clean = `55${clean}`;
  }
  return clean;
};

export default function DailyTimeline({
  date,
  agenda,
  appointments,
  customers,
  vehicles,
  services,
  nextAppointmentId,
  onCreateAppointment,
  onEditAppointment,
  onDuplicateAppointment,
  onUpdateStatus,
  canCreate = true,
  canEdit = true,
  className = ''
}: DailyTimelineProps) {
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const dayConfig = useMemo(() => {
    const dayOfWeek = new Date(`${date}T00:00:00`).getDay();
    return agenda.days.find(day => day.dayOfWeek === dayOfWeek);
  }, [agenda.days, date]);

  const intervalMinutes = useMemo(() => getSlotIntervalMinutes(agenda), [agenda]);
  const openMinutes = timeToMinutes(dayConfig?.openTime || agenda.timeSlots[0]?.time || '08:00');
  const closeMinutes = timeToMinutes(dayConfig?.closeTime || agenda.timeSlots.at(-1)?.time || '18:00');
  const timelineMinutes = Math.max(intervalMinutes, closeMinutes - openMinutes);
  const timelineHeight = timelineMinutes * PIXELS_PER_MINUTE;
  const timelineCanvasHeight = timelineHeight + TIMELINE_VERTICAL_PADDING * 2;

  const ticks = useMemo(() => {
    const result: number[] = [];
    for (let minute = openMinutes; minute <= closeMinutes; minute += intervalMinutes) {
      result.push(minute);
    }
    if (result[result.length - 1] !== closeMinutes) result.push(closeMinutes);
    return result;
  }, [closeMinutes, intervalMinutes, openMinutes]);

  const visibleAppointments = useMemo(() => {
    const sorted = appointments
      .filter(appointment => appointment.dateTime.startsWith(date))
      .map(appointment => {
        const start = timeToMinutes(appointment.dateTime.split('T')[1] || '00:00');
        const duration = getAppointmentDuration(appointment, services);
        return {
          appointment,
          start,
          end: start + duration,
          duration
        };
      })
      .sort((a, b) => a.start - b.start || a.end - b.end);

    const columns: number[] = [];
    return sorted.map(item => {
      const column = columns.findIndex(end => end <= item.start);
      const resolvedColumn = column >= 0 ? column : columns.length;
      columns[resolvedColumn] = item.end;
      return {
        ...item,
        column: resolvedColumn,
        columnCount: Math.max(columns.length, 1)
      };
    }).map((item, _index, positioned) => ({
      ...item,
      columnCount: Math.max(...positioned.map(candidate => candidate.column + 1), 1)
    }));
  }, [appointments, date, services]);

  const getWhatsAppUrl = (appointment: Appointment): string => {
    const customer = customers.find(candidate => candidate.id === appointment.customerId);
    if (!customer) return '#';
    const phone = getCleanPhoneForWhatsApp(customer.whatsapp, customer.phone);
    const serviceIds = appointment.serviceIds && appointment.serviceIds.length > 0
      ? appointment.serviceIds
      : [appointment.serviceId];
    const serviceNames = serviceIds
      .map(id => services.find(service => service.id === id)?.name)
      .filter(Boolean)
      .join(', ');
    const automation = dbInstance.automations.find(item => (
      appointment.status === 'em_andamento'
        ? item.event === 'servico_iniciado'
        : appointment.status === 'finalizado' || appointment.status === 'entregue'
          ? item.event === 'servico_finalizado'
          : item.event === 'novo_agendamento'
    ));
    const vehicle = vehicles.find(candidate => candidate.id === appointment.vehicleId);
    const mainService = services.find(candidate => candidate.id === appointment.serviceId);
    const text = automation
      ? renderTemplateText(automation.template, {
        customer,
        vehicle,
        service: mainService ? { ...mainService, name: serviceNames } : undefined,
        appointment
      })
      : `Ola, ${customer.name}! Passando para falar sobre o servico de ${serviceNames} do seu veiculo.`;
    return `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
  };

  if (!dayConfig?.isActive) {
    return (
      <div className={`bg-slate-950/50 border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-500 ${className}`}>
        Estabelecimento fechado neste dia.
      </div>
    );
  }

  return (
    <div className={`relative overflow-x-hidden rounded-xl sm:rounded-2xl border border-slate-800 bg-slate-950/40 ${className}`}>
      <div className="grid grid-cols-[52px_1fr] sm:grid-cols-[68px_1fr]">
        <div className="relative border-r border-slate-800 bg-slate-950/70" style={{ height: timelineCanvasHeight }}>
          {ticks.map(minute => (
            <div
              key={minute}
              className={`absolute left-0 right-0 -translate-y-1/2 pr-1.5 sm:pr-2 text-right font-mono text-[10px] font-bold leading-none ${TIME_ACCENT_CLASS}`}
              style={{ top: TIMELINE_VERTICAL_PADDING + (minute - openMinutes) * PIXELS_PER_MINUTE }}
            >
              {minutesToTime(minute)}
            </div>
          ))}
        </div>

        <div className="relative" style={{ height: timelineCanvasHeight }}>
          {ticks.slice(0, -1).map((minute, index) => {
            const nextMinute = ticks[index + 1] || minute + intervalMinutes;
            const top = TIMELINE_VERTICAL_PADDING + (minute - openMinutes) * PIXELS_PER_MINUTE;
            const height = Math.max((nextMinute - minute) * PIXELS_PER_MINUTE, 28);
            const time = minutesToTime(minute);
            return (
              <button
                key={minute}
                type="button"
                title={`Agendar as ${time}`}
                disabled={!canCreate}
                onClick={() => onCreateAppointment(time)}
                className="absolute left-0 right-0 border-t border-slate-900/90 text-left transition-colors hover:bg-sky-500/5 disabled:cursor-default"
                style={{ top, height }}
              >
                <span className="sr-only">Agendar as {time}</span>
              </button>
            );
          })}

          {visibleAppointments.map(({ appointment, start, end, duration, column, columnCount }) => {
            const customer = customers.find(candidate => candidate.id === appointment.customerId);
            const vehicle = vehicles.find(candidate => candidate.id === appointment.vehicleId);
            const serviceIds = appointment.serviceIds && appointment.serviceIds.length > 0
              ? appointment.serviceIds
              : [appointment.serviceId];
            const serviceNames = serviceIds
              .map(id => services.find(service => service.id === id)?.name)
              .filter(Boolean);
            const top = TIMELINE_VERTICAL_PADDING + Math.max(0, (start - openMinutes) * PIXELS_PER_MINUTE);
            const height = Math.max(1, duration * PIXELS_PER_MINUTE);
            const width = `calc(${100 / columnCount}% - 8px)`;
            const left = `calc(${(100 / columnCount) * column}% + 4px)`;
            const isNext = appointment.id === nextAppointmentId;
            const isRunning = appointment.status === 'em_andamento';
            const isCompact = height < 58;

            return (
              <div
                key={appointment.id}
                onClick={(event) => {
                  event.stopPropagation();
                  if (canEdit) onEditAppointment(appointment.id);
                }}
                className={`group absolute z-10 overflow-hidden rounded-lg border border-l-4 bg-slate-900/95 p-2 shadow-lg transition-all sm:p-2.5 ${
                  canEdit ? 'cursor-pointer' : 'cursor-default'
                } ${
                  isRunning
                    ? 'border-amber-400/70 ring-1 ring-amber-400/25 shadow-amber-500/15'
                    : isNext
                      ? 'border-sky-400/60 shadow-sky-500/15'
                      : 'border-slate-700/90 shadow-black/25 hover:border-slate-500'
                }`}
                style={{ top, height, left, width }}
                title={`${minutesToTime(start)} -> ${minutesToTime(end)} | ${customer?.name || 'Cliente desconhecido'} | ${vehicle ? `${vehicle.brand} ${vehicle.model}${vehicle.plate ? ` ${vehicle.plate}` : ''}` : 'Veiculo nao cadastrado'} | ${serviceNames.join(', ') || 'Servico'} | R$ ${appointment.value.toFixed(2)} | ${duration} min`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className={`flex min-w-0 items-center gap-1.5 font-mono text-[11px] font-black leading-none ${TIME_ACCENT_CLASS}`}>
                    {minutesToTime(start)} -&gt; {minutesToTime(end)}
                    {appointment.recurrenceId && (
                      <Repeat size={11} className="text-sky-300" aria-label="Agendamento recorrente" />
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${isCompact ? 'hidden md:inline-block' : ''} ${getStatusBadgeStyles(appointment.status)}`}>
                      {getStatusLabel(appointment.status)}
                    </span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setOpenActionMenuId(current => current === appointment.id ? null : appointment.id);
                      }}
                      className="sm:hidden rounded-md border border-slate-700 bg-slate-900 p-1 text-slate-300 hover:text-white"
                      title="Acoes"
                    >
                      <MoreVertical size={14} />
                    </button>
                  </div>
                </div>

                <div className="mt-1.5 space-y-0.5 overflow-hidden">
                  <div
                    className="truncate text-[11px] font-bold leading-tight text-white"
                    title={[customer?.name || 'Cliente desconhecido', vehicle ? `${vehicle.brand} ${vehicle.model}` : 'Veiculo nao cadastrado', vehicle?.plate].filter(Boolean).join(' - ')}
                  >
                    {customer ? customer.name : 'Cliente desconhecido'}
                    <span className="px-1 text-slate-500">•</span>
                    {vehicle ? `${vehicle.brand} ${vehicle.model}` : 'Veiculo nao cadastrado'}
                    {vehicle?.plate && (
                      <>
                        <span className="px-1 text-slate-500">•</span>
                        <span className="font-mono uppercase text-slate-300">{vehicle.plate}</span>
                      </>
                    )}
                  </div>
                  <div className="truncate text-[10px] font-semibold leading-tight text-slate-300" title={serviceNames.join(', ')}>
                    {serviceNames.length > 0 ? serviceNames.join(', ') : 'Servico'}
                  </div>
                </div>

                {!isCompact && (
                  <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-slate-800/80 pt-1.5">
                    <span className="truncate font-mono text-[10px] font-bold text-emerald-400">
                      R$ {appointment.value.toFixed(2)}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] text-slate-400">
                      <Clock size={11} />
                      {duration} min
                    </span>
                  </div>
                )}

                <div className="absolute inset-x-2 bottom-2 z-20 hidden justify-center gap-1 rounded-lg bg-slate-950/95 p-1 shadow-xl sm:group-hover:flex">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEditAppointment(appointment.id);
                      }}
                      className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[9px] font-bold text-sky-400 hover:bg-sky-500 hover:text-slate-950"
                    >
                      <Edit3 size={11} />
                      <span>Editar</span>
                    </button>
                  )}
                  {canCreate && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDuplicateAppointment(appointment.id);
                      }}
                      className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[9px] font-bold text-violet-400 hover:bg-violet-500 hover:text-white"
                    >
                      <Copy size={11} />
                      <span>Clonar</span>
                    </button>
                  )}
                  <a
                    href={getWhatsAppUrl(appointment)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[9px] font-bold text-emerald-400 hover:bg-emerald-500 hover:text-white"
                  >
                    <MessageCircle size={11} />
                    <span>Whats</span>
                  </a>
                  {canEdit && appointment.status !== 'finalizado' && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onUpdateStatus(appointment.id, 'finalizado');
                      }}
                      className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[9px] font-bold text-emerald-400 hover:bg-emerald-500 hover:text-slate-950"
                    >
                      <CheckCircle2 size={11} />
                      <span>Ok</span>
                    </button>
                  )}
                </div>
                {openActionMenuId === appointment.id && (
                  <div
                    className="absolute right-2 top-9 z-30 flex min-w-36 flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-950 shadow-2xl sm:hidden"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {canEdit && (
                      <button type="button" onClick={() => onEditAppointment(appointment.id)} className="flex items-center gap-2 px-3 py-2 text-left text-[11px] font-bold text-sky-300 hover:bg-slate-900">
                        <Edit3 size={13} /> Editar
                      </button>
                    )}
                    {canCreate && (
                      <button type="button" onClick={() => onDuplicateAppointment(appointment.id)} className="flex items-center gap-2 px-3 py-2 text-left text-[11px] font-bold text-violet-300 hover:bg-slate-900">
                        <Copy size={13} /> Clonar
                      </button>
                    )}
                    <a href={getWhatsAppUrl(appointment)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 text-left text-[11px] font-bold text-emerald-300 hover:bg-slate-900">
                      <MessageCircle size={13} /> WhatsApp
                    </a>
                    {canEdit && appointment.status !== 'finalizado' && (
                      <button type="button" onClick={() => onUpdateStatus(appointment.id, 'finalizado')} className="flex items-center gap-2 px-3 py-2 text-left text-[11px] font-bold text-emerald-300 hover:bg-slate-900">
                        <CheckCircle2 size={13} /> Finalizar
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
