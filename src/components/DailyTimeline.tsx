import React, { useMemo } from 'react';
import { Clock } from 'lucide-react';
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
const MIN_CARD_HEIGHT = 64;

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
  const dayConfig = useMemo(() => {
    const dayOfWeek = new Date(`${date}T00:00:00`).getDay();
    return agenda.days.find(day => day.dayOfWeek === dayOfWeek);
  }, [agenda.days, date]);

  const intervalMinutes = useMemo(() => getSlotIntervalMinutes(agenda), [agenda]);
  const openMinutes = timeToMinutes(dayConfig?.openTime || agenda.timeSlots[0]?.time || '08:00');
  const closeMinutes = timeToMinutes(dayConfig?.closeTime || agenda.timeSlots.at(-1)?.time || '18:00');
  const timelineMinutes = Math.max(intervalMinutes, closeMinutes - openMinutes);
  const timelineHeight = timelineMinutes * PIXELS_PER_MINUTE;

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
    <div className={`relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/40 ${className}`}>
      <div className="grid grid-cols-[64px_1fr]">
        <div className="relative border-r border-slate-800 bg-slate-950/70" style={{ height: timelineHeight }}>
          {ticks.map(minute => (
            <div
              key={minute}
              className="absolute left-0 right-0 -translate-y-2 pr-2 text-right font-mono text-[10px] font-bold text-slate-500"
              style={{ top: (minute - openMinutes) * PIXELS_PER_MINUTE }}
            >
              {minutesToTime(minute)}
            </div>
          ))}
        </div>

        <div className="relative" style={{ height: timelineHeight }}>
          {ticks.slice(0, -1).map((minute, index) => {
            const nextMinute = ticks[index + 1] || minute + intervalMinutes;
            const top = (minute - openMinutes) * PIXELS_PER_MINUTE;
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
            const top = Math.max(0, (start - openMinutes) * PIXELS_PER_MINUTE);
            const height = Math.max(MIN_CARD_HEIGHT, duration * PIXELS_PER_MINUTE);
            const width = `calc(${100 / columnCount}% - 8px)`;
            const left = `calc(${(100 / columnCount) * column}% + 4px)`;
            const isNext = appointment.id === nextAppointmentId;
            const isRunning = appointment.status === 'em_andamento';

            return (
              <div
                key={appointment.id}
                onClick={(event) => {
                  event.stopPropagation();
                  if (canEdit) onEditAppointment(appointment.id);
                }}
                className={`group absolute z-10 rounded-xl border bg-slate-950 p-3 shadow-lg transition-all ${
                  canEdit ? 'cursor-pointer' : 'cursor-default'
                } ${
                  isRunning
                    ? 'border-amber-500/50 ring-1 ring-amber-500/20 shadow-amber-500/10'
                    : isNext
                      ? 'border-sky-500/40 shadow-sky-500/10'
                      : 'border-slate-800 hover:border-slate-700'
                }`}
                style={{ top, height, left, width }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-mono text-[11px] font-black text-white">
                    {minutesToTime(start)} -&gt; {minutesToTime(end)}
                  </div>
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${getStatusBadgeStyles(appointment.status)}`}>
                    {getStatusLabel(appointment.status)}
                  </span>
                </div>

                <div className="mt-2 space-y-1 overflow-hidden">
                  <div className="truncate text-xs font-bold text-white" title={customer?.name}>
                    {customer ? customer.name : 'Cliente desconhecido'}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span className="truncate">
                      {vehicle ? `${vehicle.brand} ${vehicle.model}` : 'Veiculo nao cadastrado'}
                    </span>
                    {vehicle?.plate && (
                      <span className="shrink-0 rounded border border-slate-800 bg-slate-900 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-sky-400">
                        {vehicle.plate}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-[10px] font-semibold text-slate-300" title={serviceNames.join(', ')}>
                    {serviceNames.length > 0 ? serviceNames.join(', ') : 'Servico'}
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between border-t border-slate-850 pt-2">
                  <span className="font-mono text-xs font-bold text-emerald-400">
                    R$ {appointment.value.toFixed(2)}
                  </span>
                  <span className="flex items-center gap-1 font-mono text-[10px] text-slate-400">
                    <Clock size={11} />
                    {duration} min
                  </span>
                </div>

                <div className="absolute inset-x-2 bottom-2 z-20 hidden justify-center gap-1 rounded-lg bg-slate-950/95 p-1 shadow-xl group-hover:flex">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEditAppointment(appointment.id);
                      }}
                      className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[9px] font-bold text-sky-400 hover:bg-sky-500 hover:text-slate-950"
                    >
                      Editar
                    </button>
                  )}
                  {canCreate && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDuplicateAppointment(appointment.id);
                      }}
                      className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[9px] font-bold text-violet-400 hover:bg-violet-500 hover:text-white"
                    >
                      Clonar
                    </button>
                  )}
                  <a
                    href={getWhatsAppUrl(appointment)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[9px] font-bold text-emerald-400 hover:bg-emerald-500 hover:text-white"
                  >
                    Whats
                  </a>
                  {canEdit && appointment.status !== 'finalizado' && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onUpdateStatus(appointment.id, 'finalizado');
                      }}
                      className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[9px] font-bold text-emerald-400 hover:bg-emerald-500 hover:text-slate-950"
                    >
                      Ok
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
