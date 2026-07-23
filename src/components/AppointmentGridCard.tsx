import React from 'react';
import { Appointment, Customer, Vehicle, Service, AppointmentStatus } from '../types';
import { Clock } from 'lucide-react';
import { dbInstance, renderTemplateText } from '../db/localDb';
import { getCurrentDate } from '../utils/dateUtils';

// Format phone for WhatsApp compatibility
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

export const getStatusBadgeStyles = (status: AppointmentStatus) => {
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

export const getStatusLabel = (status: AppointmentStatus) => {
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

interface AppointmentGridCardProps {
  appt: Appointment;
  customers: Customer[];
  vehicles: Vehicle[];
  services: Service[];
  nextApptId?: string | null;
  onEditClick: (id: string) => void;
  onDuplicateClick: (id: string) => void;
  onUpdateStatus: (id: string, status: AppointmentStatus) => void;
}

export const AppointmentGridCard: React.FC<AppointmentGridCardProps> = ({
  appt,
  customers,
  vehicles,
  services,
  nextApptId,
  onEditClick,
  onDuplicateClick,
  onUpdateStatus
}) => {
  const client = customers.find(c => c.id === appt.customerId);
  const vehicle = vehicles.find(v => v.id === appt.vehicleId);
  const mainService = services.find(s => s.id === appt.serviceId);
  
  const isEmAndamento = appt.status === 'em_andamento';
  const isNext = appt.id === nextApptId;

  const serviceIds = appt.serviceIds || [appt.serviceId];
  const allServicesNames = serviceIds
    .map(id => services.find(s => s.id === id)?.name)
    .filter(Boolean);

  const hour = appt.dateTime.split('T')[1]?.slice(0, 5) || '08:00';

  const getWhatsAppTemplateURLForAppointment = (appt: Appointment) => {
    if (!client) return '#';

    const phoneSanitized = getCleanPhoneForWhatsApp(client.whatsapp, client.phone);

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

  return (
    <div 
      onClick={() => onEditClick(appt.id)}
      className={`relative group rounded-xl p-4 bg-slate-950 border transition-all flex flex-col justify-between h-[165px] cursor-pointer ${
        isEmAndamento 
          ? 'border-amber-500/50 bg-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/20' 
          : isNext 
          ? 'border-sky-500/40 bg-slate-950 shadow-[0_0_12px_rgba(14,165,233,0.1)]' 
          : 'border-slate-800 hover:border-slate-700 bg-slate-950/85'
      }`}
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs font-black text-white">{hour}</span>
          {isEmAndamento && (
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
          )}
        </div>
        
        {isEmAndamento ? (
          <span className="text-[9px] font-extrabold uppercase bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30 tracking-wider">
            EM CURSO
          </span>
        ) : isNext ? (
          <span className="text-[9px] font-extrabold uppercase bg-sky-500/20 text-sky-400 px-1.5 py-0.5 rounded border border-sky-500/30 tracking-wider animate-pulse">
            PRÓXIMO
          </span>
        ) : (
          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${getStatusBadgeStyles(appt.status)}`}>
            {getStatusLabel(appt.status)}
          </span>
        )}
      </div>

      {/* Hover action icons layer (Editar, Duplicar, WhatsApp, Finalizar) */}
      <div className="absolute inset-x-0 bottom-12 flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent pt-3 pb-1 z-10">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onEditClick(appt.id);
          }}
          title="Editar"
          className="p-1.5 bg-slate-800 hover:bg-sky-500 hover:text-slate-950 text-sky-400 border border-slate-700/80 rounded-md transition-all text-[10px] font-bold flex items-center gap-1"
        >
          ✏️ <span className="text-[9px]">Editar</span>
        </button>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onDuplicateClick(appt.id);
          }}
          title="Duplicar"
          className="p-1.5 bg-slate-800 hover:bg-violet-500 hover:text-white text-violet-400 border border-slate-700/80 rounded-md transition-all text-[10px] font-bold flex items-center gap-1"
        >
          📋 <span className="text-[9px]">Clonar</span>
        </button>
        <a 
          onClick={(e) => {
            e.stopPropagation();
          }}
          href={getWhatsAppTemplateURLForAppointment(appt)}
          target="_blank"
          rel="noopener noreferrer"
          title="Enviar WhatsApp"
          className="p-1.5 bg-slate-800 hover:bg-emerald-500 hover:text-white text-emerald-400 border border-slate-700/80 rounded-md transition-all text-[10px] font-bold flex items-center gap-1"
        >
          📲 <span className="text-[9px]">Whats</span>
        </a>
        {appt.status !== 'finalizado' && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onUpdateStatus(appt.id, 'finalizado');
            }}
            title="Finalizar"
            className="p-1.5 bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 border border-slate-700/80 rounded-md transition-all text-[10px] font-bold flex items-center gap-1"
          >
            ✔ <span className="text-[9px]">Ok</span>
          </button>
        )}
      </div>

      {/* Main card details (Will fade slightly on hover so quick icons are visible) */}
      <div className="my-2.5 space-y-1 group-hover:opacity-40 transition-opacity">
        <div className="font-bold text-white text-xs truncate" title={client?.name}>
          {client ? client.name : 'Cliente Desconhecido'}
        </div>
        
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <span className="font-mono font-medium truncate">
            {vehicle ? `${vehicle.brand} ${vehicle.model}` : 'Veículo não cadastrado'}
          </span>
          {vehicle?.plate && (
            <span className="bg-slate-850 px-1.5 py-0.2 rounded border border-slate-800 text-sky-400 text-[9px] font-bold uppercase shrink-0 font-mono">
              {vehicle.plate}
            </span>
          )}
        </div>

        <div className="text-[10px] text-slate-300 font-medium truncate" title={allServicesNames.join(', ')}>
          Serviços: {allServicesNames.length > 0 ? allServicesNames.join(', ') : (mainService ? mainService.name : 'Outro / Avulso')}
        </div>
      </div>

      {/* Footer value + duration */}
      <div className="flex justify-between items-center pt-2.5 border-t border-slate-850">
        <span className="font-mono text-xs font-bold text-emerald-400">
          R$ {appt.value.toFixed(2)}
        </span>
        
        <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
          <Clock size={11} />
          {appt.durationTotal || mainService?.estimatedTime || 60} min
        </span>
      </div>
    </div>
  );
};

interface EmptySlotCardProps {
  hour: string;
  onBookClick: (hour: string) => void;
}

export const EmptySlotCard: React.FC<EmptySlotCardProps> = ({ hour, onBookClick }) => {
  return (
    <div 
      onClick={() => onBookClick(hour)}
      className="group cursor-pointer rounded-xl p-4 bg-slate-950/40 border border-dashed border-slate-800 hover:border-sky-500/50 hover:bg-slate-950/80 transition-all flex flex-col justify-between h-[165px]"
    >
      <div className="flex justify-between items-center">
        <span className="font-mono text-xs font-bold text-slate-500 group-hover:text-sky-400 transition-colors">
          {hour}
        </span>
        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600 group-hover:text-sky-500/80 transition-colors bg-slate-900/50 px-1.5 py-0.5 rounded">
          Livre
        </span>
      </div>

      <div className="my-auto text-center space-y-1">
        <span className="text-[10px] uppercase font-mono tracking-wider font-semibold text-slate-500 group-hover:text-slate-300 block transition-colors">
          Horário Disponível
        </span>
        <p className="text-[9px] text-slate-600 line-clamp-1">
          Nenhum serviço agendado neste horário.
        </p>
      </div>

      <button 
        onClick={(e) => {
          e.stopPropagation();
          onBookClick(hour);
        }}
        className="w-full py-1.5 bg-slate-900 hover:bg-sky-500 text-slate-400 hover:text-slate-950 group-hover:border-sky-500/30 group-hover:bg-slate-900 font-bold text-[10px] uppercase tracking-wider rounded-lg border border-slate-850/80 transition-all flex items-center justify-center gap-1.5"
      >
        <Clock size={11} className="stroke-[3]" />
        <span>Agendar Cliente</span>
      </button>
    </div>
  );
};
