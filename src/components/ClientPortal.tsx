/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Phone, User, Mail, Car, Calendar, Clock, ChevronRight, ChevronLeft, 
  Plus, Check, ShieldAlert, AlertCircle, LogOut,
  Clock3, CheckCircle2, X, FileSignature,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { dbInstance } from '../db/localDb';
import { Customer, Vehicle, Service, Appointment, AppointmentStatus, SystemConfig } from '../types';
import { safeLog } from '../security/safeOutput';
import { useVehicleCatalog } from '../hooks/useVehicleCatalog';
import { sizeCategoryToPorte } from '../utils/vehicleCatalog';
import PortalAuthGate from '../portal/PortalAuthGate';
import {
  addPortalVehicle,
  cancelPortalAppointment,
  createPortalAppointment,
  createPortalCustomer,
  loadPortalData,
  validatePortalReferralCode,
  type PortalData
} from '../portal/portalSupabase';
import { activePortalAuthProvider } from '../portal/auth/emailPasswordAuthProvider';
import ClientPortalHome, { type ClientPortalSection } from './ClientPortalHome';

const BrandLogo = ({ brand }: { brand: string }) => {
  const name = brand.trim().toLowerCase();
  switch (name) {
    case 'chevrolet':
      return (
        <svg viewBox="0 0 100 40" className="w-10 h-5 fill-amber-400" xmlns="http://www.w3.org/2000/svg">
          <path d="M 35 15 L 65 15 L 65 25 L 35 25 Z" />
          <path d="M 43 10 L 57 10 L 57 30 L 43 30 Z" />
        </svg>
      );
    case 'volkswagen':
      return (
        <svg viewBox="0 0 40 40" className="w-6 h-6 stroke-white stroke-2 fill-none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="20" cy="20" r="18" className="stroke-white" strokeWidth="2" />
          <path d="M 10 13 L 20 27 L 30 13" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M 14 13 L 20 22 L 26 13" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'fiat':
      return (
        <div className="bg-red-700 px-1.5 py-0.5 rounded font-black tracking-widest text-[8px] text-white italic font-sans flex items-center justify-center h-4.5 w-10 border border-red-500 shadow">
          FIAT
        </div>
      );
    case 'ford':
      return (
        <div className="bg-sky-900 border border-sky-600 rounded-full h-4.5 w-11 flex items-center justify-center font-extrabold text-[7.5px] text-white italic font-serif shadow-inner">
          Ford
        </div>
      );
    case 'honda':
      return (
        <svg viewBox="0 0 40 40" className="w-6 h-6 stroke-slate-300 stroke-2 fill-none" xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="4" width="32" height="32" rx="5" strokeWidth="1.8" />
          <path d="M 12 10 L 12 30 M 28 10 L 28 30 M 12 20 L 28 20" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'toyota':
      return (
        <svg viewBox="0 0 50 35" className="w-9 h-6 stroke-slate-300 stroke-2 fill-none" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="25" cy="17.5" rx="23" ry="14" strokeWidth="1.8" />
          <ellipse cx="25" cy="14" rx="14" ry="9" strokeWidth="1.2" />
          <ellipse cx="25" cy="17.5" rx="5" ry="14" strokeWidth="1.2" />
        </svg>
      );
    case 'hyundai':
      return (
        <svg viewBox="0 0 50 35" className="w-9 h-6 stroke-slate-300 stroke-2 fill-none" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="25" cy="17.5" rx="22" ry="13" strokeWidth="1.5" transform="rotate(-10 25 17.5)" />
          <path d="M 18 10 L 24 25 M 32 10 L 26 25 M 21 17.5 L 29 17.5" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'renault':
      return (
        <svg viewBox="0 0 30 40" className="w-5 h-7 stroke-slate-300 stroke-2 fill-none" xmlns="http://www.w3.org/2000/svg">
          <path d="M 15 2 L 28 15 L 15 38 L 2 15 Z" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M 15 10 L 22 17 L 15 29 L 8 17 Z" strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
      );
    case 'nissan':
      return (
        <svg viewBox="0 0 40 40" className="w-6 h-6 stroke-slate-300 stroke-2 fill-none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="20" cy="20" r="14" strokeWidth="1.8" />
          <rect x="4" y="17" width="32" height="6" rx="1" fill="#0f172a" stroke="#cbd5e1" strokeWidth="1.2" />
        </svg>
      );
    case 'jeep':
      return (
        <div className="font-sans font-bold text-[9px] tracking-widest text-slate-300 uppercase bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded h-4.5 w-11 flex items-center justify-center">
          JEEP
        </div>
      );
    default:
      return (
        <div className="w-6 h-6 rounded-full bg-sky-950 border border-sky-850 flex items-center justify-center text-[9px] font-bold text-sky-400">
          {brand.slice(0, 2).toUpperCase()}
        </div>
      );
  }
};

const COMMON_COLORS = [
  { name: 'Branco', class: 'bg-white border border-slate-700', textClass: 'text-slate-800' },
  { name: 'Preto', class: 'bg-black border border-slate-800', textClass: 'text-white' },
  { name: 'Prata', class: 'bg-zinc-300 border border-zinc-400', textClass: 'text-slate-800' },
  { name: 'Cinza', class: 'bg-slate-500', textClass: 'text-white' },
  { name: 'Vermelho', class: 'bg-red-600', textClass: 'text-white' },
  { name: 'Azul', class: 'bg-blue-600', textClass: 'text-white' },
  { name: 'Verde', class: 'bg-emerald-600', textClass: 'text-white' },
  { name: 'Amarelo', class: 'bg-yellow-400', textClass: 'text-slate-800' },
  { name: 'Marrom', class: 'bg-amber-900', textClass: 'text-white' },
  { name: 'Bege', class: 'bg-amber-100', textClass: 'text-slate-800' }
];

interface ClientPortalProps {
  onBackToAdmin?: () => void;
  onSyncNeeded?: () => void;
  config?: SystemConfig;
}

interface AuthenticatedClientPortalProps extends ClientPortalProps {
  authenticatedEmail: string;
  authenticatedPhone: string;
  initialData: PortalData;
}

export default function ClientPortal(props: ClientPortalProps) {
  return (
    <PortalAuthGate onBackToAdmin={props.onBackToAdmin}>
      {(session, initialData) => (
        <AuthenticatedClientPortal
          {...props}
          authenticatedEmail={session.user.email || ''}
          authenticatedPhone={session.user.phone || ''}
          initialData={initialData}
        />
      )}
    </PortalAuthGate>
  );
}

function AuthenticatedClientPortal({
  onBackToAdmin,
  config,
  authenticatedEmail,
  authenticatedPhone,
  initialData
}: AuthenticatedClientPortalProps) {
  // Navigation steps: 
  // 2 = Client Registration (Name, Email) - if not exists
  // 3 = Vehicle Selection / Creation
  // 4 = Service Selection
  // 5 = Date & Time Slot Selection
  // 6 = Summary & Confirmation
  // 7 = Success screen
  // 'my_bookings' = Manage Bookings screen
  const [step, setStep] = useState<number | 'my_bookings'>(
    initialData.customer ? 4 : 2
  );
  const [portalSection, setPortalSection] = useState<ClientPortalSection>(
    initialData.customer ? 'home' : 'booking'
  );
  const [showSuggestionsScreen, setShowSuggestionsScreen] = useState(false);
  const [whatsapp, setWhatsapp] = useState(authenticatedPhone.replace(/\D/g, ''));
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [duplicatePlateError, setDuplicatePlateError] = useState(false);

  // Core domain states
  const [customer, setCustomer] = useState<Customer | null>(initialData.customer);
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialData.vehicles);
  const [services, setServices] = useState<Service[]>(initialData.services);
  const [appointments, setAppointments] = useState<Appointment[]>(
    initialData.appointments
  );
  const [referralProgress] = useState(initialData.referralProgress);
  const [portalSettings] = useState(initialData.portalSettings);

  // Selection states for booking
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedMainServiceId, setSelectedMainServiceId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(''); // YYYY-MM-DD
  const [selectedTime, setSelectedTime] = useState<string>(''); // HH:MM
  const [appointmentNotes, setAppointmentNotes] = useState<string>('');

  // Sub-forms
  const [newCustomer, setNewCustomer] = useState({ 
    name: '', 
    email: authenticatedEmail,
    birthDate: '',
    origin: '',
    referralCode: ''
  });
  const [newVehicle, setNewVehicle] = useState({
    brand: '',
    model: '',
    year: '',
    color: '',
    plate: '',
    porte: 'Médio' as 'Pequeno' | 'Médio' | 'Grande'
  });
  const [, setIsAddingVehicle] = useState(false);
  const [isCustomColor, setIsCustomColor] = useState(false);
  const [plateError, setPlateError] = useState(false);

  // Schema state variables
  const [servicosPrecos, setServicosPrecos] = useState(initialData.servicePrices);
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [brandSearch, setBrandSearch] = useState<string>('');
  const [modelSearch, setModelSearch] = useState<string>('');
  const vehicleCatalog = useVehicleCatalog();

  // Success summary details
  const [createdAppointment, setCreatedAppointment] = useState<Appointment | null>(null);

  // View booking detail state
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);

  // Inicialização e sincronização automática do veículo selecionado
  useEffect(() => {
    if (vehicles.length > 0) {
      const exists = vehicles.some(v => v.id === selectedVehicleId);
      if (!selectedVehicleId || !exists) {
        setSelectedVehicleId(vehicles[0].id);
      }
    } else if (selectedVehicleId) {
      setSelectedVehicleId('');
    }
  }, [vehicles, selectedVehicleId]);

  // Consulta somente intervalos agregados da data escolhida. Nenhum cadastro
  // de outro cliente é retornado ao navegador.
  useEffect(() => {
    let disposed = false;
    const refreshAvailability = async () => {
      if (!selectedDate) return;
      try {
        const data = await loadPortalData(selectedDate);
        if (!disposed) {
          setCustomer(data.customer);
          setVehicles(data.vehicles);
          setServices(data.services);
          setServicosPrecos(data.servicePrices);
          setAppointments([...data.appointments, ...data.busyAppointments]);
        }
      } catch (err) {
        safeLog('error', 'client_portal.availability.load', 'error', { error: err });
        if (!disposed) {
          setErrorMessage('Não foi possível atualizar os horários disponíveis.');
        }
      }
    };

    void refreshAvailability();
    return () => {
      disposed = true;
    };
  }, [selectedDate]);

  const getCleanPhoneForWhatsApp = () => {
    const raw = dbInstance.config.phone || '11999998888';
    const digits = raw.replace(/\D/g, '');
    if (digits.startsWith('55')) {
      return digits;
    }
    return '55' + digits;
  };

  const handlePhoneChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setWhatsapp(event.target.value.replace(/\D/g, '').slice(0, 13));
  };

  // Register New Customer
  const handleRegisterCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.name.trim()) {
      setErrorMessage('Por favor, preencha o seu nome completo.');
      return;
    }
    if (whatsapp.length < 10) {
      setErrorMessage('Por favor, informe um número de WhatsApp válido com DDD.');
      return;
    }
    
    if (!newCustomer.birthDate) {
      setErrorMessage('Por favor, informe a sua data de aniversário.');
      return;
    }
    if (!newCustomer.origin) {
      setErrorMessage('Por favor, responda "Como conheceu a nossa empresa?".');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const isIndication = newCustomer.origin === 'indicação';
      const hasCode = isIndication && newCustomer.referralCode.trim() !== '';

      if (hasCode) {
        const validReferral = await validatePortalReferralCode(newCustomer.referralCode);
        if (!validReferral) {
          setErrorMessage('Código de indicação inválido.');
          setLoading(false);
          return;
        }
      }

      const finalOrigin = isIndication 
        ? (hasCode ? 'Indicação' : 'Indicação sem código')
        : newCustomer.origin.charAt(0).toUpperCase() + newCustomer.origin.slice(1);

      await createPortalCustomer({
        name: newCustomer.name,
        email: newCustomer.email,
        birthDate: newCustomer.birthDate,
        origin: finalOrigin,
        phone: whatsapp,
        referralCode: hasCode ? newCustomer.referralCode : undefined
      });

      const data = await loadPortalData();
      if (data.customer) {
        setCustomer(data.customer);
        setVehicles(data.vehicles);
        setServices(data.services);
        setAppointments(data.appointments);
        setServicosPrecos(data.servicePrices);
        setStep(3);
      } else {
        throw new Error('Cadastro não retornado após a criação.');
      }
    } catch (err: any) {
      safeLog('error', 'client_portal.customer.register', 'error', { error: err });
      setErrorMessage('Erro ao salvar seu cadastro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleStep3Back = () => {
    if (newVehicle.model) {
      setNewVehicle(prev => ({ ...prev, model: '' }));
    } else if (newVehicle.brand) {
      setNewVehicle(prev => ({ ...prev, brand: '' }));
      setSelectedBrandId('');
    } else {
      setStep(2);
    }
  };

  // Register Vehicle
  const handleRegisterVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;

    setDuplicatePlateError(false);
    setPlateError(false);
    setErrorMessage(null);

    if (!newVehicle.brand.trim() || !newVehicle.model.trim() || !newVehicle.year.trim() || !newVehicle.color.trim()) {
      setErrorMessage('Os campos Marca, Modelo, Ano e Cor são obrigatórios.');
      return;
    }

    // Normalizing plate by converting to uppercase, removing spaces and hyphens
    const normalizedPlate = newVehicle.plate.trim().toUpperCase().replace(/\s+/g, '').replace(/-/g, '');

    if (!normalizedPlate) {
      setErrorMessage('Informe a placa do veículo para prosseguir.');
      setPlateError(true);
      return;
    }

    // Friendly validation for Mercosul and Old standards
    const isOldPattern = /^[A-Z]{3}[0-9]{4}$/.test(normalizedPlate);
    const isMercosulPattern = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(normalizedPlate);

    if (!isOldPattern && !isMercosulPattern) {
      setErrorMessage('A placa informada não é válida. Insira no padrão Mercosul (ABC1D23) ou antigo (ABC1234).');
      setPlateError(true);
      return;
    }

    // Check duplicate locally using normalized values
    const isDuplicateLocally = vehicles.some(v => {
      const dbNorm = v.plate.trim().toUpperCase().replace(/\s+/g, '').replace(/-/g, '');
      return dbNorm === normalizedPlate;
    });

    if (isDuplicateLocally) {
      setDuplicatePlateError(true);
      setPlateError(true);
      setErrorMessage('Este veículo já está cadastrado em nosso sistema.');
      return;
    }

    setLoading(true);

    try {
      const added = await addPortalVehicle(customer.id, {
        brand: newVehicle.brand,
        model: newVehicle.model,
        version: 'N/A',
        year: newVehicle.year,
        plate: normalizedPlate, // save in normalized format
        color: newVehicle.color,
        mileage: '0',
        porte: newVehicle.porte
      });

      if (added) {
        const updatedVehicles = [...vehicles, added];
        setVehicles(updatedVehicles);
        setSelectedVehicleId(added.id);
        
        setIsAddingVehicle(false);
        // Clean form
        setNewVehicle({ brand: '', model: '', year: '', color: '', plate: '', porte: 'Médio' });
        setSelectedBrandId('');
        setIsCustomColor(false);
        setPlateError(false);
        
        // Go to service selection
        setStep(4);
      }
    } catch (err: any) {
      safeLog('error', 'client_portal.vehicle.register', 'error', { error: err });
      const errString = (err.message || '').toLowerCase();
      const isDuplicateDb = errString.includes('duplicate') || errString.includes('already exists') || errString.includes('23505') || errString.includes('unique_constraint') || errString.includes('placa') || errString.includes('plate');
      
      if (isDuplicateDb) {
        setDuplicatePlateError(true);
        setPlateError(true);
        setErrorMessage('Este veículo já está cadastrado em nosso sistema.');
      } else {
        setErrorMessage('Erro ao registrar veículo. Verifique os dados e tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Selection helpers for main & complementary services
  const handleSelectMainService = (serviceId: string) => {
    setSelectedServiceIds(prev => {
      let next;
      if (prev.includes(serviceId)) {
        next = prev.filter(id => id !== serviceId);
      } else {
        next = [...prev, serviceId];
      }
      setSelectedMainServiceId(next[0] || '');
      return next;
    });
  };

  // Compute adjusted services based on the selected vehicle's size category
  const adjustedServices = useMemo(() => {
    const currentVehicle = vehicles.find(v => v.id === selectedVehicleId);
    const currentPorte = currentVehicle?.porte || 'Médio';
    
    let porteCode: 'P' | 'M' | 'G' = 'M';
    if (currentPorte === 'Pequeno') porteCode = 'P';
    if (currentPorte === 'Grande') porteCode = 'G';

    return services.map(s => {
      // 0. New pricingType logic
      if (s.pricingType === 'porte') {
        let finalPrice = s.basePrice;
        if (porteCode === 'P') finalPrice = s.priceP ?? s.basePrice;
        else if (porteCode === 'M') finalPrice = s.priceM ?? s.basePrice;
        else if (porteCode === 'G') finalPrice = s.priceG ?? s.basePrice;
        
        return {
          ...s,
          basePrice: finalPrice
        };
      } else if (s.pricingType === 'unico') {
        return {
          ...s,
          basePrice: s.basePrice
        };
      }

      // 1. Try finding in servicos_precos table
      const customPrice = servicosPrecos.find(
        sp => sp.servico_id === s.id && sp.porte === currentPorte
      );
      if (customPrice) {
        return {
          ...s,
          basePrice: Number(customPrice.preco),
          estimatedTime: Number(customPrice.tempo_estimado_minutos)
        };
      }
      
      // 2. Fallback to standard multipliers if not found in database table
      let adjustedPrice = s.basePrice;
      let adjustedTime = s.estimatedTime;
      
      if (porteCode === 'P') {
        adjustedPrice = s.basePrice * 0.9; // 10% discount for Pequeno
        adjustedTime = Math.max(30, s.estimatedTime - 15); // 15 min faster
      } else if (porteCode === 'G') {
        adjustedPrice = s.basePrice * 1.2; // 20% increase for Grande
        adjustedTime = s.estimatedTime + 30; // 30 min slower
      }
      
      return {
        ...s,
        basePrice: Math.round(adjustedPrice),
        estimatedTime: adjustedTime
      };
    });
  }, [selectedVehicleId, vehicles, services, servicosPrecos]);

  // Computations for Selected Services
  const { totalValue, totalTime } = useMemo(() => {
    let val = 0;
    let time = 0;
    selectedServiceIds.forEach(id => {
      const s = adjustedServices.find(srv => srv.id === id);
      if (s) {
        val += s.basePrice;
        time += s.estimatedTime;
      }
    });
    return { totalValue: val, totalTime: time };
  }, [selectedServiceIds, adjustedServices]);

  // Format total duration to hours and minutes
  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hrs}h ${mins}min` : `${hrs}h`;
  };

  // Load agenda settings or use defaults
  const agenda = useMemo(() => {
    return config?.agenda || dbInstance.config?.agenda || {
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
  }, [config]);

  // List of available days (Next days starting from today based on maxAdvanceDays, excluding inactive days)
  const availableDaysList = useMemo(() => {
    const list = [];
    const today = new Date();
    const maxDays = Math.min(agenda.maxAdvanceDays || 60, 60);
    
    for (let i = 0; i < maxDays; i++) {
      const current = new Date(today);
      current.setDate(today.getDate() + i);
      
      const dayOfWeek = current.getDay();
      const dayConfig = agenda.days.find((d: any) => d.dayOfWeek === dayOfWeek);
      
      if (dayConfig && dayConfig.isActive) {
        const yyyy = current.getFullYear();
        const mm = String(current.getMonth() + 1).padStart(2, '0');
        const dd = String(current.getDate()).padStart(2, '0');
        const formattedDate = `${yyyy}-${mm}-${dd}`;
        
        list.push({
          dateStr: formattedDate,
          weekday: current.toLocaleDateString('pt-BR', { weekday: 'short' }),
          dayNum: current.getDate(),
          monthLabel: current.toLocaleDateString('pt-BR', { month: 'short' })
        });
      }
    }
    return list;
  }, [agenda]);

  // Standard time slots generated for the selected date
  const timeSlots = useMemo(() => {
    return agenda.timeSlots.map((s: any) => s.time);
  }, [agenda]);

  // Map of taken slots on the selected date to prevent conflicts
  const takenSlots = useMemo(() => {
    if (!selectedDate) return [];
    
    const timeToMinutes = (timeStr: string) => {
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + (m || 0);
    };

    const list: string[] = [];

    // Find the day of week configuration
    const dateOfBooking = new Date(selectedDate + 'T00:00:00');
    const dayOfWeekIdx = dateOfBooking.getDay();
    const dayConfig = agenda.days.find((d: any) => d.dayOfWeek === dayOfWeekIdx);

    // Filter active bookings on the chosen date
    const dayBookings = appointments.filter(a => {
      return a.dateTime.startsWith(selectedDate) && a.status !== 'cancelado';
    });

    // Antecedence Check: If selectedDate is today, check minAdvanceHours
    const today = new Date();
    const isToday = selectedDate === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const currentMins = today.getHours() * 60 + today.getMinutes();
    const minAdvanceMins = (agenda.minAdvanceHours || 2) * 60;

    for (const slot of agenda.timeSlots) {
      const slotTimeStr = slot.time;
      const slotMins = timeToMinutes(slotTimeStr);

      // Check operating hours for this day
      if (dayConfig) {
        if (slotTimeStr < dayConfig.openTime || slotTimeStr >= dayConfig.closeTime) {
          list.push(slotTimeStr);
          continue;
        }
        if (dayConfig.hasLunchBreak && slotTimeStr >= dayConfig.lunchStart && slotTimeStr < dayConfig.lunchEnd) {
          list.push(slotTimeStr);
          continue;
        }
      }

      // Check min advance hours
      if (isToday) {
        if (slotMins - currentMins < minAdvanceMins) {
          list.push(slotTimeStr);
          continue;
        }
      }

      // Calculate occupancy count
      let count = 0;
      for (const appt of dayBookings) {
        const apptTimeStr = appt.dateTime.split('T')[1];
        const apptService = services.find(s => s.id === appt.serviceId);
        const duration = apptService?.estimatedTime || 60;
        
        const startMins = timeToMinutes(apptTimeStr);
        const endMins = startMins + duration;
        
        if (agenda.autoBlockDuration) {
          if (slotMins >= startMins && slotMins < endMins) {
            count++;
          }
        } else {
          if (apptTimeStr === slotTimeStr) {
            count++;
          }
        }
      }

      if (count >= slot.maxCapacity) {
        list.push(slotTimeStr);
      }
    }

    return list;
  }, [selectedDate, appointments, agenda, services]);

  // Final confirmation submit
  const handleConfirmBooking = async () => {
    if (!customer || !selectedVehicleId || selectedServiceIds.length === 0 || !selectedDate || !selectedTime) {
      setErrorMessage('Dados incompletos. Por favor revise todos os passos.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await createPortalAppointment({
        vehicleId: selectedVehicleId,
        serviceIds: selectedServiceIds,
        date: selectedDate,
        time: selectedTime,
        notes: appointmentNotes || 'Agendado pelo Portal do Cliente'
      });

      if (response) {
        setCreatedAppointment(response);
        const data = await loadPortalData();
        setCustomer(data.customer);
        setVehicles(data.vehicles);
        setServices(data.services);
        setAppointments(data.appointments);
        setServicosPrecos(data.servicePrices);
        // Clear booking choices
        setSelectedServiceIds([]);
        setSelectedDate('');
        setSelectedTime('');
        setAppointmentNotes('');
        
        setStep(7); // Show Success Screen!
      } else {
        throw new Error('Não foi possível realizar o agendamento no momento.');
      }
    } catch (err: any) {
      safeLog('error', 'client_portal.appointment.create', 'error', { error: err });
      setErrorMessage('Erro ao registrar seu agendamento. Tente outro horário.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch client bookings for "Meus Agendamentos" screen
  const myBookings = useMemo(() => {
    if (!customer) return [];
    return appointments
      .filter(a => a.customerId === customer.id)
      .sort((a, b) => b.dateTime.localeCompare(a.dateTime));
  }, [customer, appointments]);

  // Handle Cancellation of a booking
  const handleCancelBooking = async (apptId: string) => {
    const appt = appointments.find(a => a.id === apptId);
    if (!appt) return;

    // Check if appointment is more than 24 hours away
    const appointmentTime = new Date(appt.dateTime).getTime();
    const now = new Date().getTime();
    const differenceInHours = (appointmentTime - now) / (1000 * 60 * 60);

    if (differenceInHours < 24) {
      alert(`Não é possível cancelar online quando faltar menos de 24 horas para o agendamento.\n\nPor favor, entre em contato direto pelo nosso WhatsApp: (11) 99999-8888.`);
      return;
    }

    if (!confirm('Deseja realmente cancelar este agendamento?')) {
      return;
    }

    setLoading(true);
    try {
      await cancelPortalAppointment(apptId);
      const data = await loadPortalData();
      setAppointments(data.appointments);
    } catch (err: any) {
      safeLog('error', 'client_portal.appointment.cancel', 'error', {
        entityId: apptId,
        error: err
      });
      alert('Erro ao cancelar agendamento. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Helper formatting values
  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const getGoogleCalendarUrl = (apt: Appointment) => {
    if (!apt) return '#';
    const datePart = apt.dateTime.split('T')[0]; // YYYY-MM-DD
    const timePart = apt.dateTime.split('T')[1]; // HH:MM
    const startIso = datePart.replace(/-/g, '') + 'T' + timePart.replace(/:/g, '') + '00';
    
    // Calculate end time
    const [h, m] = timePart.split(':').map(Number);
    const startMinutes = h * 60 + m;
    const totalMinutes = apt.serviceIds?.reduce((acc, id) => {
      const s = adjustedServices.find(srv => srv.id === id);
      return acc + (s?.estimatedTime || 60);
    }, 0) || apt.durationTotal || 120;

    const endMinutes = startMinutes + totalMinutes;
    const endH = Math.floor(endMinutes / 60) % 24;
    const endM = endMinutes % 60;
    const endHStr = String(endH).padStart(2, '0');
    const endMStr = String(endM).padStart(2, '0');
    const endIso = datePart.replace(/-/g, '') + 'T' + endHStr + endMStr + '00';
    
    const serviceNames = (apt.serviceIds || []).map(id => adjustedServices.find(s => s.id === id)?.name).filter(Boolean).join(', ');
    const title = encodeURIComponent(`Senhora Limpeza: ${serviceNames}`);
    const details = encodeURIComponent(`Olá! Seu agendamento de estética automotiva na Senhora Limpeza está confirmado!\n\nID do Agendamento: #${apt.id.slice(0, 8)}\nVeículo: ${vehicles.find(v => v.id === apt.vehicleId)?.brand || ''} ${vehicles.find(v => v.id === apt.vehicleId)?.model || ''}\nServiços: ${serviceNames}\nValor: ${formatBRL(apt.value)}`);
    const location = encodeURIComponent('Senhora Limpeza Estética Automotiva');
    
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startIso}/${endIso}&details=${details}&location=${location}`;
  };

  const getWhatsAppSuporteUrl = (apt: Appointment) => {
    if (!apt) return '#';
    const dateFormatted = new Date(apt.dateTime.split('T')[0] + 'T00:00:00').toLocaleDateString('pt-BR');
    const timeFormatted = apt.dateTime.split('T')[1].slice(0, 5);
    const serviceNames = apt.serviceIds.map(id => adjustedServices.find(s => s.id === id)?.name).filter(Boolean).join(', ');
    const vehicleName = `${vehicles.find(v => v.id === apt.vehicleId)?.brand || ''} ${vehicles.find(v => v.id === apt.vehicleId)?.model || ''}`;
    
    const message = `Olá! Acabei de realizar o agendamento no portal:\n\n*ID:* #${apt.id.slice(0, 8)}\n*Dia:* ${dateFormatted}\n*Horário:* ${timeFormatted}\n*Veículo:* ${vehicleName}\n*Serviços:* ${serviceNames}\n*Valor Total:* ${formatBRL(apt.value)}\n\n_Gostaria de confirmar o recebimento da minha solicitação._`;
    const cleanPhone = '5511999998888'; // Senhora Limpeza WhatsApp support number
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  const getStatusConfig = (status: AppointmentStatus) => {
    switch (status) {
      case 'agendado': return { label: 'Agendado', bg: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
      case 'confirmado': return { label: 'Confirmado', bg: 'bg-violet-500/10 text-violet-400 border-violet-500/20' };
      case 'em_andamento': return { label: 'Em Execução', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
      case 'finalizado': return { label: 'Pronto/Retirar', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
      case 'entregue': return { label: 'Entregue', bg: 'bg-slate-500/20 text-slate-400 border-slate-700/20' };
      case 'cancelado': return { label: 'Cancelado', bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
      default: return { label: 'Pendente', bg: 'bg-slate-500/10 text-slate-300' };
    }
  };

  const handlePortalSignOut = async () => {
    setLoading(true);
    try {
      await activePortalAuthProvider.signOut();
    } catch (error) {
      safeLog('warn', 'client_portal.auth.logout', 'error', { error });
      setErrorMessage('Não foi possível sair. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-gradient-to-t from-indigo-950/45 via-slate-900 to-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative flex flex-col min-h-[580px] text-xs font-sans text-slate-100" id="client-portal-card">
      
      {/* Decorative Top Accent Glow */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-sky-500 via-indigo-500 to-sky-500" />
      
      {/* Portal Header */}
      <header className="px-6 py-4 border-b border-sky-500/20 bg-sky-500/[0.08] flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2.5">
          <img src="/senhora-limpeza-logo.jpeg" alt="Logotipo Senhora Limpeza" className="w-12 h-12 rounded-xl object-cover border border-sky-500/25" />
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">Senhora Limpeza</h1>
            <p className="text-[10px] text-sky-400 font-mono tracking-wider uppercase font-bold">Portal do Cliente</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {customer && portalSection === 'booking' && (
            <button 
              onClick={() => setPortalSection('home')}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white rounded-xl border border-slate-700/60 font-semibold transition-all flex items-center gap-1.5"
            >
              <ChevronLeft size={13} />
              <span>Início</span>
            </button>
          )}
          {onBackToAdmin && (
            <button 
              onClick={onBackToAdmin}
              className="p-1.5 bg-slate-950/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl border border-slate-800/80 transition-colors"
              title="Voltar ao Painel Admin"
            >
              <LogOut size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={() => void handlePortalSignOut()}
            className="px-3 py-1.5 bg-slate-950/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl border border-slate-800/80 transition-colors flex items-center gap-1.5"
            title="Sair do Portal do Cliente"
          >
            <LogOut size={13} />
            <span>Sair</span>
          </button>
        </div>
      </header>

      {/* Main Form content viewport */}
      <div className="flex-1 p-6 overflow-y-auto">
        {customer && portalSection !== 'booking' ? (
          <ClientPortalHome
            section={portalSection}
            onNavigate={(section) => {
              if (section === 'booking') {
                setSelectedServiceIds([]);
                setStep(4);
              }
              setPortalSection(section);
            }}
            customer={customer}
            vehicles={vehicles}
            services={services}
            appointments={appointments}
            config={config}
            referralProgress={referralProgress}
            portalSettings={portalSettings}
          />
        ) : (
        <>
        <AnimatePresence mode="wait">

          {/* STEP 2: New Customer Registration Form */}
          {step === 2 && (
            <motion.div 
              key="step-2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              <div>
                <h2 className="text-lg font-black text-white tracking-tight">Criar seu Cadastro</h2>
                <p className="text-slate-400 text-xs">Identificamos que é a sua primeira visita! Insira seus dados rápidos abaixo:</p>
              </div>

              {errorMessage && (
                <div className="bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-3 rounded-2xl flex items-start gap-2.5">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span className="font-mono text-xs">{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleRegisterCustomer} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Seu Nome Completo *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                        <User size={15} />
                      </div>
                      <input 
                        type="text"
                        required
                        value={newCustomer.name}
                        onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                        placeholder="Ex: João da Silva"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded-2xl pl-10 pr-4 py-3 text-white transition-all text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      WhatsApp *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                        <Phone size={15} />
                      </div>
                      <input 
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        required
                        value={whatsapp}
                        onChange={handlePhoneChange}
                        placeholder="Ex: 11999998888"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded-2xl pl-10 pr-4 py-3 text-white font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      E-mail da Conta
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                        <Mail size={15} />
                      </div>
                      <input 
                        type="email"
                        disabled
                        value={newCustomer.email}
                        className="w-full bg-slate-950/60 border border-slate-850 rounded-2xl pl-10 pr-4 py-3 text-slate-400 text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Data de Aniversário *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                        <Calendar size={15} />
                      </div>
                      <input 
                        type="date"
                        required
                        value={newCustomer.birthDate}
                        onChange={(e) => setNewCustomer({ ...newCustomer, birthDate: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded-2xl pl-10 pr-4 py-3 text-white transition-all text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    Como conheceu a nossa empresa? *
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'google', label: 'Google' },
                      { id: 'instagram', label: 'Instagram' },
                      { id: 'facebook', label: 'Facebook' },
                      { id: 'youtube', label: 'YouTube' },
                      { id: 'indicação', label: 'Indicação' },
                      { id: 'outro', label: 'Outro' }
                    ].map(opt => {
                      const isSelected = newCustomer.origin === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setNewCustomer({ 
                            ...newCustomer, 
                            origin: opt.id,
                            referralCode: opt.id !== 'indicação' ? '' : newCustomer.referralCode
                          })}
                          className={`py-2.5 px-3 rounded-xl border text-center font-semibold transition-all text-xs ${
                            isSelected 
                              ? 'bg-sky-500/10 border-sky-500 text-sky-400 font-bold' 
                              : 'bg-slate-950/40 border-slate-850 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <AnimatePresence>
                  {newCustomer.origin === 'indicação' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-2">
                        <label className="block text-[11px] font-bold text-sky-400 uppercase tracking-wider mb-1.5">
                          Informe o código do seu amigo (Opcional)
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                            <FileSignature size={15} />
                          </div>
                          <input 
                            type="text"
                            value={newCustomer.referralCode}
                            onChange={(e) => setNewCustomer({ ...newCustomer, referralCode: e.target.value })}
                            placeholder="Ex: INDICACAO, AMIGO15"
                            className="w-full bg-slate-950 border border-sky-500/30 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded-2xl pl-10 pr-4 py-3 text-white transition-all text-xs uppercase font-mono"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => void handlePortalSignOut()}
                    className="px-5 py-3 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-2xl transition-colors flex items-center gap-1 text-xs"
                  >
                    <ChevronLeft size={15} />
                    <span>Voltar</span>
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-3 bg-sky-500 hover:bg-sky-600 text-slate-950 font-black rounded-2xl transition-all shadow-lg shadow-sky-500/10 hover:shadow-sky-500/20 flex items-center justify-center gap-1 text-xs"
                  >
                    {loading ? 'Salvando...' : 'Salvar e Cadastrar Veículo'}
                    <ChevronRight size={15} />
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* STEP 3: Vehicle Registration Flow */}
          {step === 3 && (
            <motion.div 
              key="step-3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              <div>
                <h2 className="text-lg font-black text-white tracking-tight">Cadastrar seu Veículo</h2>
                <p className="text-slate-400 text-xs">Selecione a marca e modelo do seu automóvel para prosseguir:</p>
              </div>

              {errorMessage && (
                <div className="bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-3 rounded-2xl flex flex-col gap-2.5">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle size={15} className="shrink-0 mt-0.5" />
                    <span className="font-mono text-xs">{errorMessage}</span>
                  </div>
                  {duplicatePlateError && (
                    <div className="mt-1">
                      <a
                        href={`https://wa.me/${getCleanPhoneForWhatsApp()}?text=${encodeURIComponent(`Olá! Tentei cadastrar meu veículo com a placa ${newVehicle.plate.toUpperCase()}, mas ele já consta cadastrado no sistema. Gostaria de agendar o atendimento diretamente.`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-md shadow-emerald-600/10 hover:shadow-emerald-600/20 text-xs w-full justify-center"
                      >
                        <Phone size={14} />
                        <span>Falar com a equipe pelo WhatsApp</span>
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Phase 1: Brand Selection */}
              {!newVehicle.brand ? (
                <div className="space-y-4">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    Selecione a Marca *
                  </label>
                  
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                    <input 
                      type="text" 
                      value={brandSearch} 
                      onChange={(e) => setBrandSearch(e.target.value)} 
                      placeholder="Pesquisar marca..." 
                      className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded-2xl pl-10 pr-4 py-3 text-white text-xs transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[250px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                    {vehicleCatalog.brands
                      .filter(brand => brand.name.toLowerCase().includes(brandSearch.toLowerCase()))
                      .map(b => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => {
                            setNewVehicle(prev => ({ ...prev, brand: b.name }));
                            setSelectedBrandId(b.id);
                            setBrandSearch('');
                          }}
                          className="p-4 bg-slate-950 border border-slate-800 hover:border-sky-500 hover:bg-slate-950/80 rounded-2xl flex flex-col items-center justify-center gap-2 text-center transition-all cursor-pointer group"
                        >
                          <div className="h-10 flex items-center justify-center transition-transform group-hover:scale-110">
                            <BrandLogo brand={b.name} />
                          </div>
                          <span className="text-slate-300 text-[11px] font-bold tracking-wide group-hover:text-white transition-colors">{b.name}</span>
                        </button>
                      ))}
                    {vehicleCatalog.brands.filter(brand => brand.name.toLowerCase().includes(brandSearch.toLowerCase())).length === 0 && (
                      <p className="text-slate-500 text-xs text-center col-span-full py-4 font-mono">Nenhuma marca ativa encontrada.</p>
                    )}
                  </div>

                  <div className="pt-2">
                    <button 
                      type="button"
                      onClick={() => setStep(2)}
                      className="w-full py-3 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-2xl transition-colors flex items-center justify-center gap-1 text-xs"
                    >
                      <ChevronLeft size={15} />
                      <span>Voltar</span>
                    </button>
                  </div>
                </div>
              ) : /* Phase 2: Model Selection */
              !newVehicle.model ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-slate-950 border border-slate-850 p-3 rounded-2xl">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-slate-900 rounded-lg">
                        <BrandLogo brand={newVehicle.brand} />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none">Marca Selecionada</p>
                        <p className="text-white font-bold text-xs mt-0.5">{newVehicle.brand}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setNewVehicle(prev => ({ ...prev, brand: '' }));
                        setSelectedBrandId('');
                        setModelSearch('');
                      }}
                      className="text-sky-400 hover:text-sky-300 font-bold text-xs"
                    >
                      Alterar
                    </button>
                  </div>

                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mt-2">
                    Selecione o Modelo *
                  </label>

                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                    <input 
                      type="text" 
                      value={modelSearch} 
                      onChange={(e) => setModelSearch(e.target.value)} 
                      placeholder="Pesquisar modelo..." 
                      className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded-2xl pl-10 pr-4 py-3 text-white text-xs transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 max-h-[250px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                    {vehicleCatalog.models
                      .filter(model => model.brandId === selectedBrandId && model.name.toLowerCase().includes(modelSearch.toLowerCase()))
                      .map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setNewVehicle(prev => ({ 
                              ...prev, 
                              model: m.name,
                              porte: sizeCategoryToPorte(m.sizeCategory)
                            }));
                            setModelSearch('');
                          }}
                          className="p-3 bg-slate-950 border border-slate-800 hover:border-sky-500 hover:bg-slate-950/80 rounded-2xl text-left font-bold text-slate-300 hover:text-white text-xs transition-all cursor-pointer"
                        >
                          {m.name}
                        </button>
                      ))}
                    {vehicleCatalog.models.filter(model => model.brandId === selectedBrandId && model.name.toLowerCase().includes(modelSearch.toLowerCase())).length === 0 && (
                      <p className="text-slate-500 text-xs text-center col-span-full py-4 font-mono">Nenhum modelo cadastrado para esta marca.</p>
                    )}
                  </div>

                  <div className="pt-2">
                    <button 
                      type="button"
                      onClick={handleStep3Back}
                      className="w-full py-3 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-2xl transition-colors flex items-center justify-center gap-1 text-xs"
                    >
                      <ChevronLeft size={15} />
                      <span>Voltar</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Phase 3: Year, Color, and Plate inputs */
                <form onSubmit={handleRegisterVehicle} className="space-y-4">
                  <div className="flex items-center justify-between bg-slate-950 border border-slate-850 p-3 rounded-2xl">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-slate-900 rounded-lg">
                        <BrandLogo brand={newVehicle.brand} />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none">Automóvel Selecionado</p>
                        <p className="text-white font-bold text-xs mt-0.5">{newVehicle.brand} {newVehicle.model}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setNewVehicle(prev => ({ ...prev, model: '' }));
                      }}
                      className="text-sky-400 hover:text-sky-300 font-bold text-xs"
                    >
                      Alterar Modelo
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                        Ano do Modelo *
                      </label>
                      <input 
                        type="number"
                        required
                        min="1950"
                        max="2030"
                        value={newVehicle.year}
                        onChange={(e) => setNewVehicle({ ...newVehicle, year: e.target.value })}
                        placeholder="Ex: 2021"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded-2xl px-4 py-3 text-white transition-all font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex justify-between items-center">
                        <span>Cor Dominante *</span>
                        {newVehicle.color && (
                          <span className="text-[10px] text-sky-400 font-mono normal-case truncate max-w-[80px]" title={newVehicle.color}>
                            {newVehicle.color}
                          </span>
                        )}
                      </label>
                      
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {COMMON_COLORS.map(color => {
                          const isSelected = !isCustomColor && newVehicle.color.trim().toLowerCase() === color.name.toLowerCase();
                          return (
                            <button
                              key={color.name}
                              type="button"
                              title={color.name}
                              onClick={() => {
                                setNewVehicle(prev => ({ ...prev, color: color.name }));
                                setIsCustomColor(false);
                              }}
                              className={`w-7 h-7 rounded-full transition-all cursor-pointer relative flex items-center justify-center ${color.class} ${
                                isSelected 
                                  ? 'ring-2 ring-sky-500 ring-offset-2 ring-offset-slate-950 scale-110' 
                                  : 'hover:scale-105 opacity-80 hover:opacity-100'
                              }`}
                            >
                              {isSelected && (
                                <Check size={12} className={color.textClass} />
                              )}
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomColor(true);
                            setNewVehicle(prev => {
                              const isStandard = COMMON_COLORS.some(c => c.name.toLowerCase() === prev.color.trim().toLowerCase());
                              return { ...prev, color: isStandard ? '' : prev.color };
                            });
                          }}
                          className={`w-7 h-7 rounded-full border border-dashed text-[8px] font-bold flex items-center justify-center transition-all cursor-pointer ${
                            isCustomColor 
                              ? 'bg-sky-500/10 border-sky-500 text-sky-400 ring-2 ring-sky-500 ring-offset-2 ring-offset-slate-950 scale-110' 
                              : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                          }`}
                        >
                          Outra
                        </button>
                      </div>

                      {isCustomColor && (
                        <div className="mt-2">
                          <input 
                            type="text"
                            required
                            value={newVehicle.color}
                            onChange={(e) => setNewVehicle({ ...newVehicle, color: e.target.value })}
                            placeholder="Escreva a cor..."
                            className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded-2xl px-3 py-2 text-white transition-all text-xs"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className={`block text-[11px] font-bold uppercase tracking-wider mb-1.5 ${
                      plateError ? 'text-red-400' : 'text-slate-300'
                    }`}>
                      Placa do Veículo *
                    </label>
                    <input 
                      type="text"
                      required
                      value={newVehicle.plate}
                      onChange={(e) => {
                        setPlateError(false);
                        setNewVehicle({ 
                          ...newVehicle, 
                          plate: e.target.value.toUpperCase().replace(/\s+/g, '') 
                        });
                      }}
                      placeholder="Ex: ABC1D23"
                      className={`w-full bg-slate-950 border focus:outline-none focus:ring-1 rounded-2xl px-4 py-3 text-white transition-all font-mono placeholder:font-sans uppercase text-xs ${
                        plateError 
                          ? 'border-red-500 focus:border-red-500 focus:ring-red-500 ring-1 ring-red-500' 
                          : 'border-slate-800 focus:border-sky-500 focus:ring-sky-500'
                      }`}
                    />
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button 
                      type="button"
                      onClick={handleStep3Back}
                      className="px-5 py-3 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-2xl transition-colors flex items-center gap-1 text-xs"
                    >
                      <ChevronLeft size={15} />
                      <span>Voltar</span>
                    </button>
                    <button 
                      type="submit"
                      disabled={loading}
                      className="flex-1 py-3 bg-sky-500 hover:bg-sky-600 text-slate-950 font-black rounded-2xl transition-all shadow-lg shadow-sky-500/10 hover:shadow-sky-500/20 flex items-center justify-center gap-1 text-xs"
                    >
                      {loading ? 'Cadastrando...' : 'Cadastrar e Escolher Serviço'}
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          )}

          {/* STEP 4: Choose Services */}
          {step === 4 && (
            <AnimatePresence mode="wait">
              {!showSuggestionsScreen ? (
                <motion.div 
                  key="step-4-list"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-5"
                >
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div>
                      <h2 className="text-lg font-black text-white tracking-tight">Escolha o Serviço Comercial</h2>
                      <p className="text-slate-400 text-xs">Olá, <strong className="text-white">{customer?.name}</strong>! Selecione os cuidados desejados para o seu veículo:</p>
                    </div>
                    {/* Vehicle Selection dropdown in case the customer has existing vehicles */}
                    <div className="bg-slate-950 p-2 border border-slate-800 rounded-2xl flex items-center gap-2 max-w-[240px]">
                      <Car size={15} className="text-sky-400 shrink-0" />
                      <select 
                        value={selectedVehicleId}
                        onChange={(e) => {
                          if (e.target.value === 'new_v') {
                            setIsAddingVehicle(true);
                            setStep(3);
                          } else {
                            setSelectedVehicleId(e.target.value);
                          }
                        }}
                        className="bg-transparent text-white border-none focus:outline-none focus:ring-0 text-xs font-semibold w-full cursor-pointer pr-1"
                      >
                        {vehicles.map(v => (
                          <option key={v.id} value={v.id} className="bg-slate-950 text-white">
                            {v.brand} {v.model} ({v.plate || 'Sem Placa'})
                          </option>
                        ))}
                        <option value="new_v" className="bg-slate-950 text-sky-400 font-bold">
                          + Adicionar Novo Veículo
                        </option>
                      </select>
                    </div>
                  </div>

                  {errorMessage && (
                    <div className="bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-3 rounded-2xl flex items-start gap-2.5">
                      <AlertCircle size={15} className="shrink-0 mt-0.5" />
                      <span className="font-mono text-xs">{errorMessage}</span>
                    </div>
                  )}

                  {/* Realtime Pricing Board */}
                  <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Serviços</span>
                        <p className="text-xs font-black text-white font-mono">{selectedServiceIds.length} selecionado(s)</p>
                      </div>
                      <div className="space-y-0.5 sm:border-l border-slate-850 sm:pl-3">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Tempo Total</span>
                        <p className="text-xs font-black text-slate-300 font-mono flex items-center gap-1">
                          <Clock3 size={11} className="text-sky-400" />
                          {formatDuration(totalTime)}
                        </p>
                      </div>
                      <div className="space-y-0.5 sm:text-right">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Valor Estimado</span>
                        <p className="text-sm font-black text-sky-400 font-mono">{formatBRL(totalValue)}</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button 
                        onClick={() => setStep(3)}
                        className="px-5 py-3.5 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-2xl transition-colors text-xs"
                      >
                        Voltar
                      </button>
                      <button 
                        onClick={() => {
                          if (selectedServiceIds.length === 0) {
                            setErrorMessage('Por favor, selecione pelo menos um serviço para o seu agendamento.');
                            return;
                          }
                          setErrorMessage(null);
                          const hasSuggestions = adjustedServices.some(s => s.portalVisibility === 'sugestao' || (!s.portalVisibility && s.isFeatured));
                          if (hasSuggestions) {
                            setShowSuggestionsScreen(true);
                          } else {
                            setStep(5);
                          }
                        }}
                        className="flex-1 py-3.5 bg-sky-500 hover:bg-sky-600 text-slate-950 font-black rounded-2xl transition-all shadow-lg shadow-sky-500/10 hover:shadow-sky-500/20 flex items-center justify-center gap-1 text-xs cursor-pointer"
                      >
                        <span>Avançar</span>
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Main Service cards grid (only listed services) */}
                  <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1 scrollbar-thin">
                    {adjustedServices
                      .filter(s => s.portalVisibility === 'lista' || (!s.portalVisibility && !s.isFeatured))
                      .map(s => {
                        const isSelected = selectedServiceIds.includes(s.id);
                        return (
                          <div 
                            key={s.id}
                            onClick={() => handleSelectMainService(s.id)}
                            className={`p-3.5 border rounded-2xl cursor-pointer transition-all flex justify-between items-center gap-4 ${
                              isSelected 
                                ? 'bg-sky-500/5 border-sky-500 shadow-lg shadow-sky-500/5 font-bold' 
                                : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-950/70'
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-xs">{s.name}</span>
                                <span className="px-2 py-0.5 bg-slate-900 border border-slate-800 rounded-lg text-[9px] text-slate-400 font-mono flex items-center gap-1 shrink-0">
                                  <Clock3 size={10} className="text-sky-400" />
                                  {formatDuration(s.estimatedTime)}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 line-clamp-1 leading-relaxed">
                                {s.description || 'Nenhuma observação comercial descrita.'}
                              </p>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-xs font-bold text-sky-400 font-mono">
                                {formatBRL(s.basePrice)}
                              </span>
                              <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                                isSelected ? 'bg-sky-500 border-sky-500 text-slate-950' : 'border-slate-800 bg-slate-950/40'
                              }`}>
                                {isSelected && <Check size={12} strokeWidth={3} />}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>

                </motion.div>
              ) : (
                <motion.div 
                  key="step-4-suggestions"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-5"
                >
                  <div>
                    <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold uppercase tracking-wider rounded-lg">
                      ✨ Sugestões Exclusivas
                    </span>
                    <h2 className="text-lg font-black text-white tracking-tight mt-1.5">Gostaria de adicionar algo mais?</h2>
                    <p className="text-slate-400 text-xs leading-relaxed">
                      Selecione serviços complementares em destaque para um cuidado completo do seu veículo:
                    </p>
                  </div>

                  {/* Suggestion cards list */}
                  <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin">
                    {adjustedServices
                      .filter(s => s.portalVisibility === 'sugestao' || (!s.portalVisibility && s.isFeatured))
                      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
                      .map(s => {
                        const isAdded = selectedServiceIds.includes(s.id);
                        return (
                          <div 
                            key={s.id}
                            className={`p-4 border rounded-2xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden group ${
                              isAdded 
                                ? 'bg-amber-500/[0.04] border-amber-500/60 shadow-lg shadow-amber-500/5' 
                                : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-950/70'
                            }`}
                          >
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-white text-xs">{s.name}</span>
                                <span className="px-2 py-0.5 bg-slate-900 border border-slate-800 rounded-lg text-[9px] text-slate-400 font-mono flex items-center gap-1 shrink-0">
                                  <Clock3 size={10} className="text-amber-400" />
                                  {formatDuration(s.estimatedTime)}
                                </span>
                              </div>
                              {s.offerText && (
                                <p className="text-[10px] text-amber-400 font-semibold italic leading-snug">
                                  ★ "{s.offerText}"
                                </p>
                              )}
                              <p className="text-[10px] text-slate-400 leading-normal">
                                {s.description || 'Aproveite esta recomendação profissional para o seu veículo.'}
                              </p>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-t-0 border-slate-800/60 pt-2 sm:pt-0">
                              <span className="text-xs font-bold text-amber-400 font-mono">
                                {formatBRL(s.basePrice)}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedServiceIds(prev => {
                                    if (prev.includes(s.id)) {
                                      return prev.filter(id => id !== s.id);
                                    } else {
                                      // Toggle on
                                      const next = [...prev, s.id];
                                      if (!selectedMainServiceId) {
                                        setSelectedMainServiceId(s.id);
                                      }
                                      return next;
                                    }
                                  });
                                }}
                                className={`px-4 py-2 rounded-xl text-center font-bold text-[10px] transition-all flex items-center gap-1.5 cursor-pointer min-w-[90px] justify-center ${
                                  isAdded
                                    ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20'
                                    : 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-black'
                                }`}
                              >
                                {isAdded ? (
                                  <>
                                    <X size={11} strokeWidth={2.5} />
                                    <span>Remover</span>
                                  </>
                                ) : (
                                  <>
                                    <Plus size={11} strokeWidth={2.5} />
                                    <span>Adicionar</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  {/* Bottom Realtime Pricing Board */}
                  <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl flex justify-between items-center flex-wrap gap-4">
                    <div className="flex gap-4">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold font-mono">Total Serviços</span>
                        <p className="text-xs font-black text-white font-mono">{selectedServiceIds.length} selecionado(s)</p>
                      </div>
                      <div className="space-y-0.5 border-l border-slate-850 pl-4">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold font-mono">Tempo Estimado</span>
                        <p className="text-xs font-black text-slate-300 font-mono flex items-center gap-1">
                          <Clock3 size={11} className="text-sky-400" />
                          {formatDuration(totalTime)}
                        </p>
                      </div>
                    </div>

                    <div className="text-right space-y-0.5">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold font-mono">Valor Total</span>
                      <p className="text-sm font-black text-sky-400 font-mono">{formatBRL(totalValue)}</p>
                    </div>
                  </div>

                  <div className="pt-2 flex gap-3">
                    <button 
                      onClick={() => setShowSuggestionsScreen(false)}
                      className="px-5 py-3.5 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-2xl transition-colors text-xs cursor-pointer"
                    >
                      Voltar
                    </button>
                    <button 
                      onClick={() => {
                        setErrorMessage(null);
                        setStep(5);
                      }}
                      className="flex-1 py-3.5 bg-sky-500 hover:bg-sky-600 text-slate-950 font-black rounded-2xl transition-all shadow-lg shadow-sky-500/10 hover:shadow-sky-500/20 flex items-center justify-center gap-1 text-xs cursor-pointer"
                    >
                      <span>Ir para Data e Horário</span>
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* STEP 5: Choose Date and Time Slot */}
          {step === 5 && (
            <motion.div 
              key="step-5"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              <div>
                <h2 className="text-lg font-black text-white tracking-tight">Escolha de Data e Horário</h2>
                <p className="text-slate-400">Selecione uma data disponível no calendário e escolha o melhor horário livre:</p>
              </div>

              {errorMessage && (
                <div className="bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-3 rounded-2xl flex items-start gap-2.5">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span className="font-mono">{errorMessage}</span>
                </div>
              )}

              {/* Day horizontal scroll selector */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Selecione o Dia
                </label>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent snap-x">
                  {availableDaysList.map(d => {
                    const isSelected = selectedDate === d.dateStr;
                    return (
                      <div 
                        key={d.dateStr}
                        onClick={() => {
                          setSelectedDate(d.dateStr);
                          setSelectedTime(''); // Reset selected time
                        }}
                        className={`flex-none snap-start w-[64px] py-3 border rounded-2xl text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1 ${
                          isSelected 
                            ? 'bg-sky-500 border-sky-500 text-slate-950 font-bold shadow-lg shadow-sky-500/10' 
                            : 'bg-slate-950/40 border-slate-850 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        <span className={`text-[9px] uppercase tracking-wider font-semibold ${isSelected ? 'text-slate-950' : 'text-slate-500'}`}>
                          {d.weekday}
                        </span>
                        <span className="text-sm font-extrabold font-mono">
                          {d.dayNum}
                        </span>
                        <span className={`text-[9px] capitalize ${isSelected ? 'text-slate-900' : 'text-slate-400'}`}>
                          {d.monthLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Grid of hourly slots */}
              {selectedDate ? (
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Horários Disponíveis em <span className="text-white font-mono">{new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
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

                  <div className="grid grid-cols-5 gap-2">
                    {timeSlots.map(time => {
                      const isTaken = takenSlots.includes(time);
                      const isSelected = selectedTime === time;

                      return (
                        <button 
                          key={time}
                          type="button"
                          disabled={isTaken}
                          onClick={() => setSelectedTime(time)}
                          className={`py-2 px-1 border rounded-xl text-center font-bold font-mono transition-all text-[11px] ${
                            isTaken
                              ? 'bg-red-500/5 text-red-500/30 border-red-500/10 cursor-not-allowed opacity-40'
                              : isSelected
                                ? 'bg-sky-500 border-sky-500 text-slate-950 shadow-md shadow-sky-500/10'
                                : 'bg-slate-950/40 border-slate-850 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          {time}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-950/40 border border-slate-850 rounded-2xl py-8 text-center text-slate-500">
                  <Calendar size={22} className="mx-auto mb-2 text-slate-600" />
                  <span>Por favor, escolha um dia para consultar horários livres.</span>
                </div>
              )}

              {/* Extra booking comments */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Observações Especiais do Atendimento (Opcional)
                </label>
                <textarea 
                  value={appointmentNotes}
                  onChange={(e) => setAppointmentNotes(e.target.value)}
                  placeholder="Ex: Levar chave sobressalente, barulho na suspensão ao esterçar, etc..."
                  className="w-full bg-slate-950 border border-slate-850 rounded-2xl p-3 text-white h-16 resize-none focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 transition-all placeholder-slate-600"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button 
                  onClick={() => setStep(4)}
                  className="px-5 py-3.5 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-2xl transition-colors"
                >
                  Serviços
                </button>
                <button 
                  onClick={() => {
                    if (!selectedDate || !selectedTime) {
                      setErrorMessage('Por favor, defina o dia e o horário do atendimento.');
                      return;
                    }
                    setErrorMessage(null);
                    setStep(6);
                  }}
                  className="flex-1 py-3.5 bg-sky-500 hover:bg-sky-600 text-slate-950 font-black rounded-2xl transition-all shadow-lg shadow-sky-500/10 hover:shadow-sky-500/20 flex items-center justify-center gap-1"
                >
                  <span>Revisar Agendamento</span>
                  <ChevronRight size={15} />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 6: Summary and Confirmation */}
          {step === 6 && (
            <motion.div 
              key="step-6"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              <div>
                <h2 className="text-lg font-black text-white tracking-tight">Confirmar Agendamento</h2>
                <p className="text-slate-400">Por favor, revise o resumo dos seus dados e clique em Confirmar:</p>
              </div>

              {errorMessage && (
                <div className="bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-3 rounded-2xl flex items-start gap-2.5">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span className="font-mono">{errorMessage}</span>
                </div>
              )}

              {/* Review Dashboard Summary Box */}
              <div className="border border-slate-800 bg-slate-950/40 rounded-3xl overflow-hidden divide-y divide-slate-850">
                {/* Customer & Vehicle */}
                <div className="p-4 flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-sky-400 shrink-0">
                    <Car size={18} />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Cliente e Veículo</span>
                    <p className="text-white font-bold leading-none">{customer?.name}</p>
                    <p className="text-slate-400 text-[10.5px]">
                      {vehicles.find(v => v.id === selectedVehicleId)?.brand} {vehicles.find(v => v.id === selectedVehicleId)?.model} - Cor {vehicles.find(v => v.id === selectedVehicleId)?.color} (Placa: <strong className="font-mono">{vehicles.find(v => v.id === selectedVehicleId)?.plate || 'N/A'}</strong>)
                    </p>
                  </div>
                </div>

                {/* Selected Services list summary */}
                <div className="p-4 space-y-2">
                  <span className="text-[9px] text-slate-500 uppercase tracking-wider font-bold block">Serviços Selecionados</span>
                  <div className="space-y-1.5">
                    {selectedServiceIds.map(id => {
                      const s = adjustedServices.find(srv => srv.id === id);
                      return (
                        <div key={id} className="flex justify-between items-center gap-4 text-[10.5px]">
                          <span className="text-slate-300 font-semibold">{s?.name}</span>
                          <span className="font-mono font-bold text-sky-400">{formatBRL(s?.basePrice || 0)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Date & Time Slot summary */}
                <div className="p-4 flex justify-between gap-4 flex-wrap">
                  <div className="flex gap-3 items-start">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-sky-400 shrink-0">
                      <Calendar size={18} />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Data e Horário</span>
                      <p className="text-white font-bold leading-none font-mono">
                        {new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </p>
                      <p className="text-sky-400 text-[10.5px] font-mono font-bold flex items-center gap-1">
                        <Clock size={11} />
                        Slot: {selectedTime}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 border-l border-slate-850 pl-4">
                    <div className="space-y-1">
                      <span className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Duração Total</span>
                      <p className="text-white font-bold leading-none font-mono flex items-center gap-1">
                        <Clock3 size={11} className="text-sky-400" />
                        {formatDuration(totalTime)}
                      </p>
                    </div>
                    <div className="space-y-1 text-right pl-4">
                      <span className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Valor Previsto</span>
                      <p className="text-sm font-black text-sky-400 font-mono leading-none pt-0.5">{formatBRL(totalValue)}</p>
                    </div>
                  </div>
                </div>

                {/* Notes if exist */}
                {appointmentNotes && (
                  <div className="p-4 space-y-1">
                    <span className="text-[9px] text-slate-500 uppercase tracking-wider font-bold block">Observações</span>
                    <p className="text-slate-400 italic leading-relaxed text-[10px]">"{appointmentNotes}"</p>
                  </div>
                )}
              </div>

              <div className="pt-2 flex gap-3">
                <button 
                  disabled={loading}
                  onClick={() => setStep(5)}
                  className="px-5 py-3.5 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-2xl transition-colors disabled:opacity-50"
                >
                  Voltar
                </button>
                <button 
                  onClick={handleConfirmBooking}
                  disabled={loading}
                  className="flex-1 py-3.5 bg-sky-500 hover:bg-sky-600 text-slate-950 font-black rounded-2xl transition-all shadow-lg shadow-sky-500/10 hover:shadow-sky-500/20 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  <Check size={16} strokeWidth={3} />
                  <span>{loading ? 'Processando Agendamento...' : 'Confirmar Agendamento'}</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 7: Success screen */}
          {step === 7 && (
            <motion.div 
              key="step-7"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="text-center space-y-6 py-6"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 size={36} className="animate-bounce" />
              </div>

              <div className="space-y-1">
                <h2 className="text-xl font-black text-white tracking-tight">Agendamento Realizado com Sucesso!</h2>
                <p className="text-slate-400 text-xs">Seu horário foi reservado e está garantido no nosso sistema.</p>
              </div>

              {/* Receipt Summary Block */}
              <div className="max-w-md mx-auto border border-emerald-500/10 bg-slate-950/40 rounded-3xl p-5 space-y-4 text-left">
                <div className="flex justify-between border-b border-slate-850 pb-3">
                  <span className="text-slate-400 font-mono text-[10px] uppercase">Número do Agendamento</span>
                  <span className="text-white font-mono font-bold uppercase tracking-wider">
                    #{createdAppointment?.id?.slice(0, 8) || 'AG102'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-slate-500 text-[9px] uppercase tracking-wider block">Dia</span>
                    <span className="text-white font-bold font-mono text-xs">
                      {createdAppointment ? new Date(createdAppointment.dateTime.split('T')[0] + 'T00:00:00').toLocaleDateString('pt-BR') : ''}
                    </span>
                  </div>
                  <div className="space-y-1 text-right">
                    <span className="text-slate-500 text-[9px] uppercase tracking-wider block">Horário Reservado</span>
                    <span className="text-sky-400 font-extrabold font-mono text-xs">
                      {createdAppointment?.dateTime?.split('T')[1]?.slice(0, 5)}
                    </span>
                  </div>
                </div>

                <div className="space-y-1 border-t border-slate-850 pt-3">
                  <span className="text-slate-500 text-[9px] uppercase tracking-wider block">Serviços Contratados</span>
                  <div className="space-y-1">
                    {createdAppointment?.serviceIds?.map(id => {
                      const s = services.find(srv => srv.id === id);
                      return (
                        <div key={id} className="text-slate-300 font-semibold text-[10.5px] flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-sky-400 shrink-0" />
                          <span>{s?.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-between items-center border-t border-slate-850 pt-3">
                  <span className="text-slate-400 text-[10px]">Valor Total</span>
                  <span className="text-sm font-black text-sky-400 font-mono">
                    {formatBRL(createdAppointment?.value || 0)}
                  </span>
                </div>
              </div>

              {/* Direct Action Buttons: Calendar & WhatsApp */}
              {createdAppointment && (
                <div className="max-w-md mx-auto grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <a
                    href={getGoogleCalendarUrl(createdAppointment)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-3 px-4 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-200 font-bold rounded-2xl transition-all flex items-center justify-center gap-2 text-xs"
                  >
                    <Calendar size={15} className="text-sky-400" />
                    <span>Adicionar ao Calendário</span>
                  </a>
                  <a
                    href={getWhatsAppSuporteUrl(createdAppointment)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-3 px-4 bg-emerald-500/10 border border-emerald-500/25 hover:border-emerald-500/40 text-emerald-400 font-bold rounded-2xl transition-all flex items-center justify-center gap-2 text-xs"
                  >
                    <Phone size={15} />
                    <span>Confirmar no WhatsApp</span>
                  </a>
                </div>
              )}

              <div className="max-w-md mx-auto flex gap-3 pt-4 border-t border-slate-850">
                <button 
                  onClick={() => {
                    setStep(4);
                    setSelectedMainServiceId('');
                    setSelectedServiceIds([]);
                    setShowSuggestionsScreen(false);
                  }}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-2xl transition-colors text-xs"
                >
                  Novo Agendamento
                </button>
                <button 
                  onClick={() => setStep('my_bookings')}
                  className="flex-1 py-3 bg-sky-500/10 border border-sky-500/20 hover:bg-sky-500/20 text-sky-400 font-black rounded-2xl transition-all text-xs"
                >
                  Meus Agendamentos
                </button>
              </div>
            </motion.div>
          )}

          {/* SCREEN: Meus Agendamentos (Consultar) */}
          {step === 'my_bookings' && (
            <motion.div 
              key="my-bookings"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              <div className="flex justify-between items-center flex-wrap gap-3">
                <div>
                  <h2 className="text-lg font-black text-white tracking-tight">Meus Agendamentos</h2>
                  <p className="text-slate-400">Histórico de reservas para <strong className="text-white">{customer?.name}</strong>:</p>
                </div>
                <button 
                  onClick={() => {
                    setSelectedServiceIds([]);
                    setStep(4); // Back to booking step
                  }}
                  className="px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/25 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1"
                >
                  <Plus size={11} />
                  <span>Novo Agendamento</span>
                </button>
              </div>

              {/* Grid or list of bookings */}
              {myBookings.length > 0 ? (
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {myBookings.map(b => {
                    const statusConfig = getStatusConfig(b.status);
                    const vehicle = vehicles.find(v => v.id === b.vehicleId);
                    
                    // Determine if cancellable (more than 24 hours away and not finalized/cancelled)
                    const appointmentTime = new Date(b.dateTime).getTime();
                    const now = new Date().getTime();
                    const differenceInHours = (appointmentTime - now) / (1000 * 60 * 60);
                    const canCancel = differenceInHours > 24 && b.status !== 'cancelado' && b.status !== 'finalizado' && b.status !== 'entregue';

                    const isDetailsActive = activeBookingId === b.id;

                    return (
                      <div 
                        key={b.id}
                        className="bg-slate-950/40 border border-slate-850 rounded-2xl overflow-hidden transition-colors hover:border-slate-800"
                      >
                        {/* Summary bar */}
                        <div 
                          onClick={() => setActiveBookingId(isDetailsActive ? null : b.id)}
                          className="p-4 flex justify-between items-center gap-4 cursor-pointer"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-white text-xs">
                                {new Date(b.dateTime.split('T')[0] + 'T00:00:00').toLocaleDateString('pt-BR')} às {b.dateTime.split('T')[1]?.slice(0, 5)}
                              </span>
                              <span className={`px-2 py-0.5 border rounded-lg text-[9px] font-bold font-mono tracking-wider ${statusConfig.bg}`}>
                                {statusConfig.label}
                              </span>
                            </div>
                            <p className="text-[10.5px] text-slate-400 leading-none">
                              {vehicle ? `${vehicle.brand} ${vehicle.model} (${vehicle.plate})` : 'Veículo'}
                            </p>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-xs font-bold text-sky-400 font-mono">
                              {formatBRL(b.value)}
                            </span>
                            <ChevronRight size={14} className={`text-slate-500 transition-transform ${isDetailsActive ? 'rotate-90' : ''}`} />
                          </div>
                        </div>

                        {/* Details drawer expanded */}
                        {isDetailsActive && (
                          <div className="px-4 pb-4 pt-1 border-t border-slate-850 bg-slate-950/20 space-y-3 text-[10.5px]">
                            <div className="grid grid-cols-2 gap-3 text-slate-400">
                              <div>
                                <span className="text-[9px] uppercase tracking-wider text-slate-500 block">Duração Estimada</span>
                                <span className="text-slate-200 font-semibold">{formatDuration(b.durationTotal || 60)}</span>
                              </div>
                              <div>
                                <span className="text-[9px] uppercase tracking-wider text-slate-500 block">Responsável Alocado</span>
                                <span className="text-slate-200 font-semibold">{b.employeeId || 'Gabriel'}</span>
                              </div>
                            </div>

                            <div>
                              <span className="text-[9px] uppercase tracking-wider text-slate-500 block">Serviços Escolhidos</span>
                              <div className="space-y-0.5 pl-1 text-slate-200">
                                {b.serviceIds?.map(id => {
                                  const s = services.find(srv => srv.id === id);
                                  return (
                                    <div key={id} className="flex justify-between text-slate-300">
                                      <span>• {s?.name || 'Serviço Estético'}</span>
                                      <span className="font-mono text-[10px] text-slate-400">{formatBRL(s?.basePrice || 0)}</span>
                                    </div>
                                  );
                                }) || <div className="text-slate-300">• {services.find(s => s.id === b.serviceId)?.name || 'Serviço'}</div>}
                              </div>
                            </div>

                            {b.notes && (
                              <div>
                                <span className="text-[9px] uppercase tracking-wider text-slate-500 block">Observações do Cliente</span>
                                <span className="text-slate-400 italic">"{b.notes}"</span>
                              </div>
                            )}

                            {/* Cancellation triggers */}
                            <div className="pt-2 flex justify-end">
                              {canCancel ? (
                                <button 
                                  onClick={() => handleCancelBooking(b.id)}
                                  className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 rounded-xl font-bold flex items-center gap-1 text-[10px]"
                                >
                                  <X size={11} strokeWidth={2.5} />
                                  <span>Cancelar Agendamento</span>
                                </button>
                              ) : (
                                b.status !== 'cancelado' && b.status !== 'finalizado' && b.status !== 'entregue' && (
                                  <div className="p-2.5 bg-rose-500/5 text-rose-400/80 border border-rose-500/15 rounded-xl text-[10px] max-w-sm flex gap-1.5 leading-normal">
                                    <ShieldAlert size={14} className="shrink-0 text-rose-400" />
                                    <span>
                                      Restando menos de 24h, o cancelamento online está bloqueado. Fale com o suporte no WhatsApp: (11) 99999-8888.
                                    </span>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-slate-950/40 border border-slate-850 rounded-2xl py-12 text-center text-slate-500">
                  <Calendar size={26} className="mx-auto mb-2 text-slate-600" />
                  <span>Você ainda não possui agendamentos marcados.</span>
                </div>
              )}

              <div className="pt-2">
                <button 
                  onClick={() => setStep(4)}
                  className="w-full py-3.5 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-2xl transition-colors text-xs"
                >
                  Voltar para Escolha de Serviços
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
        </>
        )}
      </div>

      {/* Footer Branding credits */}
      <footer className="px-6 py-4 border-t border-slate-800/80 bg-slate-950/60 shrink-0 flex justify-between items-center text-[10px] text-slate-500">
        <span>© 2026 Senhora Limpeza Estética Automotiva</span>
        <div className="flex gap-1 items-center">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
          <span className="font-mono text-slate-400 font-semibold uppercase">Ambiente Conectado</span>
        </div>
      </footer>
    </div>
  );
}
