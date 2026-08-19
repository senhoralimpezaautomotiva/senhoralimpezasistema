import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  CalendarPlus,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Gift,
  History,
  KeyRound,
  MessageCircle,
  Search,
  ShieldCheck,
  UserRound
} from 'lucide-react';
import type { AgendaConfig, Appointment, Customer, LoyaltyRewardCredit, Service, SystemConfig, Vehicle } from '../types';
import { loadPortalData } from '../portal/portalSupabase';

export type ClientPortalSection =
  | 'home'
  | 'booking'
  | 'catalog'
  | 'loyalty'
  | 'history'
  | 'availability'
  | 'profile'
  | 'change-password';

interface ClientPortalHomeProps {
  section: Exclude<ClientPortalSection, 'booking'>;
  onNavigate: (section: ClientPortalSection) => void;
  customer: Customer;
  vehicles: Vehicle[];
  services: Service[];
  appointments: Appointment[];
  config?: SystemConfig;
  referralProgress: number;
  portalSettings: {
    catalogSource: 'system' | 'whatsapp';
    whatsappCatalogUrl: string;
    loyaltyTarget: number;
    agenda?: AgendaConfig;
  };
  protectRewardCredit?: LoyaltyRewardCredit | null;
  protectRewardService?: Service | null;
  onScheduleProtectReward?: () => void;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

export interface PortalAvailabilitySlot {
  time: string;
  occupied: boolean;
  selected?: boolean;
}

interface PortalAvailabilityPanelProps {
  date: string;
  onDateChange: (date: string) => void;
  slots: PortalAvailabilitySlot[];
  minDate?: string;
  maxDate?: string;
  onSlotSelect?: (time: string) => void;
  onConsult?: () => void;
  loading?: boolean;
  error?: string;
  emptyMessage?: string;
  helperText?: string;
}

const dateLabel = (value: string): string =>
  new Date(`${value.split('T')[0]}T12:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

const money = (value: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const PortalBack = ({ onClick, title }: { onClick: () => void; title: string }) => (
  <div className="flex items-center justify-between gap-3 mb-6">
    <div>
      <p className="text-[10px] uppercase tracking-[0.2em] text-sky-400 font-bold">Portal do cliente</p>
      <h2 className="text-xl font-black text-white mt-1">{title}</h2>
    </div>
    <button type="button" onClick={onClick} className="px-3 py-2 rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 flex items-center gap-1.5 font-bold">
      <ArrowLeft size={14} /> Voltar
    </button>
  </div>
);

export default function ClientPortalHome({
  section,
  onNavigate,
  customer,
  vehicles,
  services,
  appointments,
  config,
  referralProgress,
  portalSettings,
  protectRewardCredit,
  protectRewardService,
  onScheduleProtectReward,
  onChangePassword
}: ClientPortalHomeProps) {
  const loyaltyTarget = Math.max(1, portalSettings.loyaltyTarget || config?.loyaltyReferralTarget || 10);
  const completedReferrals = Math.min(referralProgress, loyaltyTarget);
  const remainingReferrals = Math.max(0, loyaltyTarget - completedReferrals);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmation: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const completedAppointments = useMemo(
    () => appointments
      .filter(item => item.status === 'finalizado' || item.status === 'entregue')
      .sort((a, b) => b.dateTime.localeCompare(a.dateTime)),
    [appointments]
  );
  const lastAppointment = completedAppointments[0] || null;
  const lastService = lastAppointment
    ? services.find(item => item.id === lastAppointment.serviceId)?.name || 'Serviço realizado'
    : 'Nenhum serviço concluído';
  const handleCopyReferralCode = async () => {
    if (!customer.referralCode) return;
    await navigator.clipboard.writeText(customer.referralCode);
    setCopyFeedback(true);
    window.setTimeout(() => setCopyFeedback(false), 2000);
  };

  const submitPasswordChange = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    if (passwordForm.newPassword !== passwordForm.confirmation) {
      setPasswordError('A nova senha e a confirmacao nao coincidem.');
      return;
    }
    setPasswordSaving(true);
    try {
      await onChangePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordSuccess('Senha alterada com sucesso. Voce sera redirecionado para entrar novamente.');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmation: '' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (/invalid login|invalid credentials|senha atual/i.test(message)) {
        setPasswordError('A senha atual esta incorreta.');
      } else if (/rate|too many|over.*limit/i.test(message)) {
        setPasswordError('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
      } else if (/password|senha/i.test(message)) {
        setPasswordError('Nao foi possivel salvar essa senha. Verifique as regras e tente novamente.');
      } else {
        setPasswordError(message || 'Nao foi possivel alterar a senha. Tente novamente.');
      }
    } finally {
      setPasswordSaving(false);
    }
  };

  if (section === 'home') {
    return (
      <div className="space-y-6">
        <div className="text-center pt-1">
          <p className="text-slate-400">Olá,</p>
          <h2 className="text-2xl font-black text-white">{customer.name}!</h2>
          {customer.referralCode && (
            <div className="mt-3 flex flex-col sm:flex-row items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => void handleCopyReferralCode()}
                className="inline-flex items-center gap-2 rounded-2xl border border-sky-500/30 bg-slate-950/80 px-3 py-2 text-sky-300 hover:bg-sky-500/10 transition-colors"
                title="Copiar código de indicação"
              >
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Código de indicação</span>
                <strong className="font-mono text-sm tracking-widest text-sky-400">{customer.referralCode}</strong>
                {copyFeedback ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              </button>
              {copyFeedback && (
                <span className="text-[10px] text-emerald-300 font-bold">Código copiado com sucesso</span>
              )}
            </div>
          )}
          <p className="text-slate-400 mt-1">Como podemos cuidar do seu carro hoje?</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-2xl border-2 border-sky-500/30 bg-sky-500/[0.07] p-4">
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Prêmio fidelidade</span>
            <strong className="block text-sm text-white mt-1">{remainingReferrals === 0 ? 'Prêmio conquistado' : `Faltam ${remainingReferrals} indicações`}</strong>
            <span className="text-[10px] text-slate-400">{completedReferrals} de {loyaltyTarget} concluídas</span>
          </div>
          <div className="rounded-2xl border-2 border-indigo-500/30 bg-indigo-500/[0.07] p-4">
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Último serviço</span>
            <strong className="block text-sm text-white mt-1">{lastService}</strong>
            <span className="text-[10px] text-slate-400">{lastAppointment ? dateLabel(lastAppointment.dateTime) : 'Seu histórico aparecerá aqui'}</span>
          </div>
        </div>

        {protectRewardCredit && protectRewardService && (
          <div className="rounded-3xl border-2 border-emerald-400/40 bg-gradient-to-br from-emerald-500/15 via-slate-950 to-sky-500/10 p-5 shadow-xl shadow-emerald-500/5">
            <div className="flex items-start gap-4">
              <span className="w-12 h-12 rounded-2xl bg-emerald-400/15 border border-emerald-300/30 text-emerald-300 flex items-center justify-center shrink-0">
                <Gift size={23} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-300 font-black">Beneficio disponivel</p>
                <h3 className="text-lg font-black text-white mt-1">Parabens! Voce ganhou uma limpeza Protect gratuita.</h3>
                <p className="text-slate-300 mt-1 leading-relaxed">
                  Seu beneficio esta disponivel. Agende quando desejar.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onScheduleProtectReward}
              className="mt-4 w-full rounded-2xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black py-3.5 transition-colors flex items-center justify-center gap-2"
            >
              <CalendarPlus size={17} />
              <span>Agendar minha Limpeza Protect</span>
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 auto-rows-[142px]">
          <button type="button" onClick={() => onNavigate('booking')} className="rounded-2xl border-2 border-sky-500/35 bg-sky-500/[0.06] hover:bg-sky-500/10 flex flex-col items-center justify-center text-center gap-3 p-4 transition-colors">
            <CalendarPlus size={25} className="text-sky-400" />
            <span><strong className="block text-white">Agendar serviço</strong><small className="text-[10px] text-slate-400">Escolha serviço, data e horário</small></span>
          </button>
          <button type="button" onClick={() => onNavigate('catalog')} className="rounded-2xl border-2 border-indigo-500/35 bg-indigo-500/[0.06] hover:bg-indigo-500/10 flex flex-col items-center justify-center text-center gap-3 p-4 transition-colors">
            <BookOpen size={25} className="text-indigo-400" />
            <span><strong className="block text-white">Catálogo</strong><small className="text-[10px] text-slate-400">Conheça todos os serviços</small></span>
          </button>
          <button type="button" onClick={() => onNavigate('loyalty')} className="rounded-2xl border-2 border-sky-500/35 bg-sky-500/[0.06] hover:bg-sky-500/10 flex flex-col items-center justify-center text-center gap-3 p-4 transition-colors">
            <ShieldCheck size={25} className="text-sky-400" />
            <span><strong className="block text-white">Cartão fidelidade</strong><small className="text-[10px] text-slate-400">Acompanhe suas marcações</small></span>
          </button>
          <button type="button" onClick={() => onNavigate('history')} className="rounded-2xl border-2 border-indigo-500/35 bg-indigo-500/[0.06] hover:bg-indigo-500/10 flex flex-col items-center justify-center text-center gap-3 p-4 transition-colors">
            <History size={25} className="text-indigo-400" />
            <span><strong className="block text-white">Histórico</strong><small className="text-[10px] text-slate-400">Consulte serviços realizados</small></span>
          </button>
          <button type="button" onClick={() => onNavigate('profile')} className="col-span-2 h-16 rounded-2xl border-2 border-indigo-500/35 bg-indigo-500/[0.06] hover:bg-indigo-500/10 flex items-center justify-center gap-3 font-black text-white transition-colors">
            <UserRound size={18} className="text-indigo-400" /> Perfil <ChevronRight size={17} />
          </button>
          <button type="button" onClick={() => onNavigate('availability')} className="col-span-2 h-16 rounded-2xl border-2 border-sky-500/35 bg-sky-500/[0.07] hover:bg-sky-500/12 flex items-center justify-center gap-3 font-black text-white transition-colors">
            <Search size={18} className="text-sky-400" /> Consultar agenda <ChevronRight size={17} />
          </button>
        </div>
      </div>
    );
  }

  if (section === 'catalog') {
    const useWhatsApp = portalSettings.catalogSource === 'whatsapp';
    return (
      <div>
        <PortalBack title="Catálogo" onClick={() => onNavigate('home')} />
        {useWhatsApp ? (
          <div className="rounded-3xl border-2 border-sky-500/30 bg-sky-500/[0.06] p-8 text-center">
            <MessageCircle size={42} className="text-sky-400 mx-auto mb-4" />
            <h3 className="text-lg font-black text-white">Catálogo do WhatsApp</h3>
            <p className="text-slate-400 mt-2 mb-5">Veja fotos, descrições completas, opções e valores atualizados.</p>
            {portalSettings.whatsappCatalogUrl ? (
              <a href={portalSettings.whatsappCatalogUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black">
                Abrir catálogo <ExternalLink size={16} />
              </a>
            ) : (
              <p className="text-amber-300 border border-amber-500/25 bg-amber-500/10 rounded-2xl p-3">O link do catálogo ainda não foi configurado pela loja.</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {services.map((service, index) => (
              <div key={service.id} className={`rounded-2xl border-2 p-4 flex items-start justify-between gap-4 ${index % 2 ? 'border-indigo-500/25 bg-indigo-500/[0.05]' : 'border-sky-500/25 bg-sky-500/[0.05]'}`}>
                <div><strong className="text-white block">{service.name}</strong><p className="text-slate-400 mt-1">{service.description || 'Consulte os detalhes com nossa equipe.'}</p></div>
                <span className="font-mono font-bold text-sky-300 whitespace-nowrap">{money(service.basePrice)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (section === 'loyalty') {
    return (
      <div>
        <PortalBack title="Cartão fidelidade" onClick={() => onNavigate('home')} />
        <div className="rounded-3xl border-2 border-sky-500/35 bg-gradient-to-br from-sky-500/15 via-slate-900 to-indigo-500/15 p-6 overflow-hidden relative">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-[10px] tracking-[0.2em] text-sky-300 font-bold">SENHORA LIMPEZA</p><h3 className="text-lg font-black text-white mt-1">Clube de vantagens</h3></div>
            <img src="/senhora-limpeza-logo.jpeg" alt="Logotipo Senhora Limpeza" className="w-16 h-16 object-cover rounded-2xl border-2 border-sky-500/30" />
          </div>
          <div className="grid grid-cols-5 gap-3 my-7">
            {Array.from({ length: loyaltyTarget }, (_, index) => (
              <span key={index} className={`aspect-square rounded-full border-2 flex items-center justify-center font-black ${index < completedReferrals ? 'bg-sky-500 border-sky-400 text-slate-950' : 'border-dashed border-slate-600 text-slate-500'}`}>
                {index < completedReferrals ? <Check size={16} /> : index + 1}
              </span>
            ))}
          </div>
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden"><div className="h-full bg-gradient-to-r from-sky-500 to-indigo-400" style={{ width: `${Math.min(100, (completedReferrals / loyaltyTarget) * 100)}%` }} /></div>
        </div>
        <div className="mt-5 flex items-center gap-4">
          <span className="w-12 h-12 rounded-full bg-sky-500 text-slate-950 flex items-center justify-center shrink-0"><Gift size={22} /></span>
          <div><p className="text-[10px] tracking-wider text-slate-400">SEU PRÓXIMO PRÊMIO</p><h3 className="text-lg font-black text-white">{remainingReferrals === 0 ? 'Cartão completo!' : `Faltam ${remainingReferrals} indicações`}</h3><p className="text-slate-400">Acompanhe aqui cada indicação concluída.</p></div>
        </div>
      </div>
    );
  }

  if (section === 'history') {
    return (
      <div>
        <PortalBack title="Histórico" onClick={() => onNavigate('home')} />
        <div className="space-y-3">
          {appointments.length ? appointments.map((appointment, index) => {
            const service = services.find(item => item.id === appointment.serviceId);
            const vehicle = vehicles.find(item => item.id === appointment.vehicleId);
            return (
              <div key={appointment.id} className={`rounded-2xl border-2 p-4 flex items-start justify-between gap-4 ${index % 2 ? 'border-indigo-500/25 bg-indigo-500/[0.05]' : 'border-sky-500/25 bg-sky-500/[0.05]'}`}>
                <div><strong className="text-white block">{service?.name || 'Serviço automotivo'}</strong><p className="text-slate-400 mt-1">{dateLabel(appointment.dateTime)} · {vehicle ? `${vehicle.brand} ${vehicle.model}` : 'Veículo'}</p><span className="inline-block mt-2 px-2 py-1 rounded-lg bg-slate-800 text-[9px] uppercase tracking-wider text-slate-300">{appointment.status.replaceAll('_', ' ')}</span></div>
                <span className="font-mono font-bold text-sky-300 whitespace-nowrap">{money(appointment.value)}</span>
              </div>
            );
          }) : <p className="text-center text-slate-400 py-12">Você ainda não possui agendamentos.</p>}
        </div>
      </div>
    );
  }

  if (section === 'profile') {
    return (
      <div>
        <PortalBack title="Perfil" onClick={() => onNavigate('home')} />
        <div className="space-y-4">
          <div className="rounded-3xl border-2 border-sky-500/30 bg-sky-500/[0.06] p-5">
            <div className="flex items-start gap-4">
              <span className="w-12 h-12 rounded-2xl bg-sky-500/15 border border-sky-500/25 text-sky-300 flex items-center justify-center shrink-0">
                <UserRound size={22} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Cliente</p>
                <h3 className="text-lg font-black text-white break-words">{customer.name}</h3>
                <p className="text-slate-400 mt-1 break-words">{customer.email || 'E-mail do portal'}</p>
                <p className="text-slate-500 mt-1">{customer.whatsapp || customer.phone}</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('change-password')}
            className="w-full rounded-2xl border-2 border-indigo-500/35 bg-indigo-500/[0.06] hover:bg-indigo-500/10 p-4 flex items-center justify-between gap-4 text-left transition-colors"
          >
            <span className="flex items-center gap-3 min-w-0">
              <span className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-300 flex items-center justify-center shrink-0">
                <KeyRound size={18} />
              </span>
              <span className="min-w-0">
                <strong className="block text-white">Alterar senha</strong>
                <small className="text-slate-400">Atualize seu acesso ao Portal do Cliente</small>
              </span>
            </span>
            <ChevronRight size={17} className="text-indigo-300 shrink-0" />
          </button>
        </div>
      </div>
    );
  }

  if (section === 'change-password') {
    return (
      <div>
        <PortalBack title="Alterar senha" onClick={() => onNavigate('profile')} />
        <form onSubmit={(event) => void submitPasswordChange(event)} className="space-y-4">
          {passwordError && (
            <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-3 text-rose-300">
              {passwordError}
            </div>
          )}
          {passwordSuccess && (
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-emerald-300 font-semibold">
              {passwordSuccess}
            </div>
          )}

          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1.5">Senha atual</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={passwordForm.currentPassword}
              onChange={event => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })}
              className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 outline-none rounded-2xl px-4 py-3 text-sm text-white"
            />
          </label>

          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1.5">Nova senha</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              value={passwordForm.newPassword}
              onChange={event => setPasswordForm({ ...passwordForm, newPassword: event.target.value })}
              className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 outline-none rounded-2xl px-4 py-3 text-sm text-white"
            />
            <span className="block text-[10px] text-slate-500 mt-1.5">
              MÃ­nimo de 8 caracteres, com maiÃºscula, minÃºscula e nÃºmero.
            </span>
          </label>

          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1.5">Confirmar nova senha</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              value={passwordForm.confirmation}
              onChange={event => setPasswordForm({ ...passwordForm, confirmation: event.target.value })}
              className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 outline-none rounded-2xl px-4 py-3 text-sm text-white"
            />
          </label>

          <button
            type="submit"
            disabled={passwordSaving || Boolean(passwordSuccess)}
            className="w-full rounded-2xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-black py-3.5"
          >
            {passwordSaving ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </form>
      </div>
    );
  }

  return <AvailabilityView agenda={portalSettings.agenda || config?.agenda} onBack={() => onNavigate('home')} />;
}

function AvailabilityView({ agenda, onBack }: { agenda?: AgendaConfig; onBack: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [busyTimes, setBusyTimes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const slots = agenda?.timeSlots || [];

  const consult = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await loadPortalData(date);
      setBusyTimes(data.busyAppointments.map(item => item.dateTime.split('T')[1]?.slice(0, 5)));
    } catch {
      setError('Não foi possível consultar essa data agora. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PortalBack title="Consultar agenda" onClick={onBack} />
      <PortalAvailabilityPanel
        date={date}
        onDateChange={setDate}
        minDate={today}
        slots={slots.map(slot => ({ time: slot.time, occupied: busyTimes.includes(slot.time) }))}
        onConsult={consult}
        loading={loading}
        error={error}
        helperText="Somente consulta. Nenhum horário é reservado nesta tela."
      />
    </div>
  );
}

export function PortalAvailabilityPanel({
  date,
  onDateChange,
  slots,
  minDate,
  maxDate,
  onSlotSelect,
  onConsult,
  loading = false,
  error = '',
  emptyMessage = 'Por favor, escolha um dia para consultar horários livres.',
  helperText
}: PortalAvailabilityPanelProps) {
  return (
    <div className="space-y-4 min-w-0">
      <div className="rounded-2xl border-2 border-sky-500/30 bg-sky-500/[0.06] p-4">
        <label className="text-[10px] uppercase tracking-wider text-slate-400 block mb-2">Escolha uma data</label>
        <div className="flex flex-col sm:flex-row gap-2 min-w-0">
          <input
            type="date"
            min={minDate}
            max={maxDate}
            value={date}
            onChange={event => onDateChange(event.target.value)}
            className="min-w-0 flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white"
          />
          {onConsult && (
            <button type="button" onClick={() => void onConsult()} className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-sky-500 text-slate-950 font-black">
              {loading ? 'Consultando...' : 'Consultar'}
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-rose-300 border border-rose-500/25 bg-rose-500/10 rounded-xl p-3">{error}</p>}

      {date ? (
        <div className="space-y-2.5 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Horários Disponíveis em <span className="text-white font-mono">{new Date(date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
            </label>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1 text-slate-500">
                <span className="w-2 h-2 rounded bg-slate-950/40 border border-slate-850" />
                Livre
              </span>
              <span className="flex items-center gap-1 text-slate-500">
                <span className="w-2 h-2 rounded bg-red-500/10 border border-red-500/20" />
                Ocupado
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 min-w-0">
            {slots.map(slot => {
              const clickable = Boolean(onSlotSelect) && !slot.occupied;
              const classes = slot.occupied
                ? 'bg-red-500/5 text-red-500/30 border-red-500/10 cursor-not-allowed opacity-40'
                : slot.selected
                  ? 'bg-sky-500 border-sky-500 text-slate-950 shadow-md shadow-sky-500/10'
                  : 'bg-slate-950/40 border-slate-850 text-slate-300 hover:border-slate-700';
              return (
                <button
                  key={slot.time}
                  type="button"
                  disabled={!clickable}
                  onClick={() => onSlotSelect?.(slot.time)}
                  className={`min-w-0 rounded-xl border p-3 text-center transition-all ${classes}`}
                >
                  <strong className="font-mono text-[11px]">{slot.time}</strong>
                  <span className="block text-[9px] mt-1">{slot.occupied ? 'Ocupado' : 'Disponível'}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-slate-950/40 border border-slate-850 rounded-2xl py-8 px-4 text-center text-slate-500">
          <Calendar size={22} className="mx-auto mb-2 text-slate-600" />
          <span>{emptyMessage}</span>
        </div>
      )}

      {helperText && <p className="text-center text-[10px] text-slate-500">{helperText}</p>}
    </div>
  );
}
