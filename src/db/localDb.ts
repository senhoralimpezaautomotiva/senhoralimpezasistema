/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getSharedSupabaseClient } from './supabaseClient';
import { 
  Customer, 
  Vehicle, 
  Service, 
  Appointment, 
  AppointmentStatus,
  HistoryRecord, 
  CashTransaction, 
  SystemConfig, 
  AutomationLog,
  AutomationTrigger,
  VehicleModel,
  AutomationExecution,
  User,
  CreateUserInput,
  UserRole,
  SystemModuleId,
  ModulePermission,
  ServiceCommissionRule,
  CommissionRecord
} from '../types';
import { PREFILLED_VEHICLE_MODELS } from '../data/prefilledModels';
import { getCurrentDateStr } from '../utils/dateUtils';
import { sanitizeLegacyConfigStorage, toPublicSystemConfig } from '../security/publicConfig';
import { maskPhone, safeLog } from '../security/safeOutput';
import { getPublicSupabaseEnvironment } from '../config/publicEnvironment';
import { isWithinOperationalWindow, getNextStartTime } from '../utils/operationalWindow';
export { getServicePrice } from '../utils/servicePricing';

// Constants for Local Storage Keys
const KEYS = {
  CUSTOMERS: 'sl_customers',
  VEHICLES: 'sl_vehicles',
  SERVICES: 'sl_services',
  APPOINTMENTS: 'sl_appointments',
  HISTORY: 'sl_history',
  FINANCES: 'sl_finances',
  CONFIG: 'sl_config',
  AUTOMATIONS: 'sl_automations',
  LOGS: 'sl_logs',
  VEHICLE_MODELS: 'sl_vehicle_models',
  USERS: 'sl_users',
  COMMISSIONS: 'sl_commissions'
};

const SENSITIVE_BROWSER_STORAGE_KEYS = new Set<string>([
  KEYS.CUSTOMERS,
  KEYS.VEHICLES,
  KEYS.APPOINTMENTS,
  KEYS.HISTORY,
  KEYS.FINANCES,
  KEYS.LOGS,
  KEYS.USERS,
  KEYS.COMMISSIONS,
  'sl_executions'
]);

// Default Role Permissions Matrix
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Record<SystemModuleId, ModulePermission>> = {
  admin: {
    dashboard: { view: true, create: true, edit: true, delete: true },
    clientes: { view: true, create: true, edit: true, delete: true },
    servicos: { view: true, create: true, edit: true, delete: true },
    agenda: { view: true, create: true, edit: true, delete: true },
    historico: { view: true, create: true, edit: true, delete: true },
    financeiro: { view: true, create: true, edit: true, delete: true },
    relatorios: { view: true, create: true, edit: true, delete: true },
    mensagens: { view: true, create: true, edit: true, delete: true },
    automacoes: { view: true, create: true, edit: true, delete: true },
    indicacoes: { view: true, create: true, edit: true, delete: true },
    configuracoes: { view: true, create: true, edit: true, delete: true },
    usuarios: { view: true, create: true, edit: true, delete: true },
  },
  gerente: {
    dashboard: { view: true, create: true, edit: true, delete: true },
    clientes: { view: true, create: true, edit: true, delete: true },
    servicos: { view: true, create: true, edit: true, delete: true },
    agenda: { view: true, create: true, edit: true, delete: true },
    historico: { view: true, create: true, edit: true, delete: true },
    financeiro: { view: true, create: true, edit: true, delete: true },
    relatorios: { view: true, create: true, edit: true, delete: false },
    mensagens: { view: true, create: true, edit: true, delete: true },
    automacoes: { view: true, create: true, edit: true, delete: false },
    indicacoes: { view: true, create: true, edit: true, delete: true },
    configuracoes: { view: true, create: false, edit: true, delete: false },
    usuarios: { view: true, create: true, edit: true, delete: false },
  },
  atendente: {
    dashboard: { view: true, create: false, edit: false, delete: false },
    clientes: { view: true, create: true, edit: true, delete: false },
    servicos: { view: true, create: false, edit: false, delete: false },
    agenda: { view: true, create: true, edit: true, delete: false },
    historico: { view: true, create: true, edit: false, delete: false },
    financeiro: { view: true, create: true, edit: false, delete: false },
    relatorios: { view: true, create: false, edit: false, delete: false },
    mensagens: { view: true, create: true, edit: false, delete: false },
    automacoes: { view: false, create: false, edit: false, delete: false },
    indicacoes: { view: true, create: true, edit: true, delete: false },
    configuracoes: { view: false, create: false, edit: false, delete: false },
    usuarios: { view: false, create: false, edit: false, delete: false },
  },
  tecnico: {
    dashboard: { view: true, create: false, edit: false, delete: false },
    clientes: { view: true, create: false, edit: false, delete: false },
    servicos: { view: true, create: false, edit: false, delete: false },
    agenda: { view: true, create: false, edit: true, delete: false },
    historico: { view: true, create: true, edit: false, delete: false },
    financeiro: { view: false, create: false, edit: false, delete: false },
    relatorios: { view: false, create: false, edit: false, delete: false },
    mensagens: { view: false, create: false, edit: false, delete: false },
    automacoes: { view: false, create: false, edit: false, delete: false },
    indicacoes: { view: false, create: false, edit: false, delete: false },
    configuracoes: { view: false, create: false, edit: false, delete: false },
    usuarios: { view: false, create: false, edit: false, delete: false },
  },
  personalizado: {
    dashboard: { view: true, create: false, edit: false, delete: false },
    clientes: { view: true, create: true, edit: true, delete: false },
    servicos: { view: true, create: false, edit: false, delete: false },
    agenda: { view: true, create: true, edit: true, delete: false },
    historico: { view: true, create: false, edit: false, delete: false },
    financeiro: { view: false, create: false, edit: false, delete: false },
    relatorios: { view: false, create: false, edit: false, delete: false },
    mensagens: { view: false, create: false, edit: false, delete: false },
    automacoes: { view: false, create: false, edit: false, delete: false },
    indicacoes: { view: false, create: false, edit: false, delete: false },
    configuracoes: { view: false, create: false, edit: false, delete: false },
    usuarios: { view: false, create: false, edit: false, delete: false },
  },
};

// Initial Seed Users
export const DEFAULT_USERS: User[] = [
  {
    id: 'u_admin_1',
    name: 'Administrador Master',
    phone: '(11) 99999-8888',
    email: 'contato@senhoralimpeza.com.br',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    status: 'ativo',
    role: 'admin',
    permissions: DEFAULT_ROLE_PERMISSIONS.admin,
    commissions: [],
    defaultCommissionPercent: 15,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'u_tecnico_1',
    name: 'Gabriel Silva',
    phone: '(11) 98888-7777',
    email: 'gabriel@senhoralimpeza.com.br',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    status: 'ativo',
    role: 'tecnico',
    permissions: DEFAULT_ROLE_PERMISSIONS.tecnico,
    commissions: [
      { serviceId: '8350c53e-fa9b-4c1d-ba6b-d18198c7b94e', percentage: 20 },
      { serviceId: '7a2d3359-9e6b-41bc-a7f8-0e84c7bd083a', percentage: 25 }
    ],
    defaultCommissionPercent: 12,
    createdAt: '2026-01-02T00:00:00.000Z'
  },
  {
    id: 'u_atendente_1',
    name: 'Matheus Oliveira',
    phone: '(11) 97777-6666',
    email: 'matheus@senhoralimpeza.com.br',
    photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    status: 'ativo',
    role: 'atendente',
    permissions: DEFAULT_ROLE_PERMISSIONS.atendente,
    commissions: [],
    defaultCommissionPercent: 5,
    createdAt: '2026-01-03T00:00:00.000Z'
  }
];


const publicSupabaseEnvironment = getPublicSupabaseEnvironment();

// Initial Config Seed. Environment-specific connection values are injected at build/runtime.
const DEFAULT_CONFIG: SystemConfig = {
  companyName: 'Senhora Limpeza Estética Automotiva',
  phone: '(11) 99999-8888',
  email: 'contato@senhoralimpeza.com.br',
  cnpj: '45.123.789/0001-99',
  address: 'Av. das Nações Unidas, 14205 - Brooklin Novo, São Paulo - SP',
  hoursOfOperation: 'Segunda a Sexta: 08:00 às 18:00 | Sábado: 08:00 às 14:00',
  logoUrl: 'https://images.unsplash.com/photo-1607860108855-64acf2078ed9?w=150&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
  primaryColor: '#0F172A', // Slate 900
  accentColor: '#0EA5E9',  // Sky 500
  supabaseUrl: publicSupabaseEnvironment.supabaseUrl,
  supabaseAnonKey: publicSupabaseEnvironment.supabaseAnonKey,
  useRealSupabase: publicSupabaseEnvironment.isConfigured,
  referralActive: true,
  referralDiscountPercent: 10,
  automationStartHour: '08:00',
  automationEndHour: '20:00',
  theme: 'dark',
  agenda: {
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
  }
};

// Initial Services Seed using valid real-database UUIDs
const DEFAULT_SERVICES: Service[] = [
  { id: '8350c53e-fa9b-4c1d-ba6b-d18198c7b94e', name: 'Lavagem Completa', description: 'Inclui aspiração e pretinho', basePrice: 150.00, estimatedTime: 120, portalVisibility: 'lista' },
  { id: '7a2d3359-9e6b-41bc-a7f8-0e84c7bd083a', name: 'Polimento Técnico', description: 'Necessita agendamento prévio', basePrice: 850.00, estimatedTime: 480, portalVisibility: 'lista' },
  { id: '20970a7d-5e60-4965-a831-28562725f4fb', name: 'Higienização Interna Completa', description: 'Limpeza profunda de bancos (couro ou tecido) com extratora e sanitização.', basePrice: 380.00, estimatedTime: 240, portalVisibility: 'lista' },
  { id: '0f209673-bf00-4b07-a3ca-f8319688049e', name: 'Vitrificação de Pintura (Ceramic Coating)', description: 'Proteção de pintura por até 3 anos contra raios UV e seiva.', basePrice: 1400.00, estimatedTime: 360, portalVisibility: 'lista' },
  { id: '4ab97262-e64e-4b68-b3d9-a4773822a969', name: 'Limpeza Técnica de Motor', description: 'Limpeza a vapor do cofre do motor com verniz de motor protetor.', basePrice: 180.00, estimatedTime: 90, isFeatured: true, offerText: 'Remove graxa/óleo e protege plásticos e borrachas do cofre.', displayOrder: 3, portalVisibility: 'sugestao' },
  { id: '8170c0c0-6bf7-4b71-b8ef-ca1c9a66b7fb', name: 'Cristalização de Vidros', description: 'Remoção de chuva ácida nos vidros e aplicação de selante repelente.', basePrice: 130.00, estimatedTime: 60, isFeatured: true, offerText: 'Garante visibilidade máxima e segurança sob chuvas fortes.', displayOrder: 1, portalVisibility: 'sugestao' },
  { id: '3a73967f-94d3-469b-9807-68b209e53b6d', name: 'Revitalização de Plásticos', description: 'Aplicação de renovador de plásticos externos para reverter desbotamento.', basePrice: 100.00, estimatedTime: 45, isFeatured: true, offerText: 'Devolve a cor original e protege plásticos externos de raios UV.', displayOrder: 2, portalVisibility: 'sugestao' },
  { id: '50d30fe9-ca60-4286-9a25-97da259d57a2', name: 'Restauração de Faróis', description: 'Lixamento de faróis amarelados/foscos e aplicação de selante UV.', basePrice: 160.00, estimatedTime: 90, isFeatured: true, offerText: 'Elimina o amarelado, aumentando o poder de iluminação à noite.', displayOrder: 4, portalVisibility: 'sugestao' },
  { id: 'e97fa1f2-1b63-4ba0-a0de-47120df05bf9', name: 'Detalhamento Completo (Full Detail)', description: 'Lavagem de motor, higienização profunda, polimento e vitrificação.', basePrice: 2400.00, estimatedTime: 960, portalVisibility: 'lista' }
];

// Initial Customers Seed using valid real-database UUIDs
const DEFAULT_CUSTOMERS: Customer[] = [
  {
    id: '1d7f5c76-7b8c-4687-89b5-750f6808f2f3',
    name: 'Cliente Demonstrativo',
    phone: '5511999998888',
    whatsapp: '5511999998888',
    email: 'cliente.demonstrativo@exemplo.com',
    cpf: '',
    birthDate: '1990-01-01',
    address: 'Av. Paulista, 1000',
    neighborhood: 'Bela Vista',
    city: 'São Paulo',
    notes: 'Cliente demonstrativo padrão do sistema.',
    clientSince: '2026-07-14',
    lastServiceDate: null,
    status: 'ativo',
    origin: 'Outros'
  }
];

// Initial Vehicles Seed matching the real customer UUID and vehicle UUID
const DEFAULT_VEHICLES: Vehicle[] = [
  { 
    id: '0b412500-8415-4976-8fac-e76723debfb5', 
    customerId: '1d7f5c76-7b8c-4687-89b5-750f6808f2f3', 
    brand: 'Honda', 
    model: 'Civic', 
    version: 'Touring 1.5 Turbo', 
    year: '2021', 
    plate: 'ABC1D23', 
    color: 'Preto', 
    mileage: '34200' 
  }
];

// Initial Appointments Seed
const DEFAULT_APPOINTMENTS: Appointment[] = [];

// Initial Automations Settings
const DEFAULT_AUTOMATIONS: AutomationTrigger[] = [
  {
    id: 'at1',
    name: 'Mensagem de Novo Cliente',
    description: 'Envia mensagem de boas-vindas ao cadastrar um novo cliente.',
    event: 'novo_cliente',
    isActive: true,
    template: 'Olá, *{nome}*! É um grande prazer ter você como cliente da Senhora Limpeza Estética Automotiva. 🚗✨ Cadastramos seu contato com sucesso e estamos à disposição para deixar seu veículo impecável!'
  },
  {
    id: 'at2',
    name: 'Confirmação de Agendamento',
    description: 'Envia confirmação imediata quando um agendamento é criado.',
    event: 'novo_agendamento',
    isActive: true,
    template: 'Olá, *{nome}*! Confirmamos seu agendamento para o veículo *{veiculo}* em nosso espaço. \n\n📅 *Data/Hora:* {data_hora}\n🛠️ *Serviço:* {servico}\n💰 *Valor:* R$ {valor}\n\nTe aguardamos no endereço: Av. das Nações Unidas, 14205.'
  },
  {
    id: 'at_servico_iniciado',
    name: 'Serviço Iniciado',
    description: 'Envia notificação quando o veículo entra em processo de limpeza/estética.',
    event: 'servico_iniciado',
    isActive: true,
    template: 'Olá, *{nome}*! O serviço de *{servico}* no seu *{veiculo}* foi iniciado. 🛠️🚗✨\n\nAcompanhamos cada detalhe com o máximo cuidado para garantir um resultado impecável. Notificaremos você assim que o veículo estiver pronto!'
  },
  {
    id: 'at3',
    name: 'Serviço Finalizado / Retirada',
    description: 'Notifica que o serviço terminou e o carro está pronto para retirada.',
    event: 'servico_finalizado',
    isActive: true,
    template: 'Excelente notícia, *{nome}*! O serviço de *{servico}* no seu *{veiculo}* foi finalizado. O veículo ficou espetacular e já está pronto para retirada! 🧼🚗✨\n\nNosso horário de funcionamento é até as 18:00.'
  },
  {
    id: 'at4',
    name: 'Recuperação de Cliente Inativo',
    description: 'Alerta de lembrete de retorno para clientes há mais de 30 dias sem serviço.',
    event: 'cliente_inativo',
    isActive: true,
    template: 'Olá, *{nome}*! Faz um tempo que não vemos você e o seu *{veiculo}* por aqui. Que tal darmos aquele trato premium para proteger e brilhar a pintura? Agende hoje mesmo e ganhe uma cristalização de parabrisa cortesia!',
    inactiveDays: 30,
    minServices: 1
  },
  {
    id: 'at5',
    name: 'Parabéns de Aniversário',
    description: 'Envia mensagem com cupom de desconto no dia do aniversário do cliente.',
    event: 'aniversario',
    isActive: true,
    template: 'Parabéns, *{nome}*! 🎉🎈 A equipe da Senhora Limpeza te deseja muitos anos de vida, conquistas e estradas tranquilas! Para comemorar, você acaba de ganhar *15% de desconto* em qualquer serviço detalhado neste mês!'
  },
  {
    id: 'at6',
    name: 'Pesquisa de Satisfação',
    description: 'Envia um link de pesquisa após a finalização e entrega do veículo.',
    event: 'pagamento_recebido',
    isActive: true,
    template: 'Olá, *{nome}*! Agradecemos a preferência pela Senhora Limpeza. Sua opinião é fundamental para nós. Numa escala de 0 a 10, como você avalia o resultado do serviço em seu *{veiculo}*? Responda aqui mesmo!'
  },
  {
    id: 'at_lembrete_agendamento',
    name: 'Lembrete de Agendamento',
    description: 'Envia uma mensagem automática lembrando o cliente sobre seu agendamento iminente (60 minutos antes).',
    event: 'lembrete_agendamento',
    isActive: true,
    template: 'Olá, *{nome}*! Passando para lembrar que seu agendamento está agendado para hoje às *{data_hora}* com o veículo *{veiculo}* (Serviço: *{servico}*). Estamos te aguardando no endereço: Av. das Nações Unidas, 14205! ✨🚗'
  }
];

// Helper to secure reading from localStorage or memory store
const isServer = typeof window === 'undefined' || typeof localStorage === 'undefined';
const memStore: Record<string, string> = {};

const getLocalData = <T>(key: string, defaultValue: T): T => {
  try {
    if (!isServer && SENSITIVE_BROWSER_STORAGE_KEYS.has(key)) {
      localStorage.removeItem(key);
      return defaultValue;
    }
    const data = isServer ? memStore[key] : localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (error) {
    safeLog('error', 'local_storage.read', 'error', { operation: key, error });
    return defaultValue;
  }
};

// Helper to save to localStorage or memory store
const setLocalData = <T>(key: string, data: T): void => {
  try {
    if (!isServer && SENSITIVE_BROWSER_STORAGE_KEYS.has(key)) {
      localStorage.removeItem(key);
      return;
    }
    const str = JSON.stringify(data);
    if (isServer) {
      memStore[key] = str;
    } else {
      localStorage.setItem(key, str);
    }
  } catch (error) {
    safeLog('error', 'local_storage.write', 'error', { operation: key, error });
  }
};

const migrateLegacySensitiveBrowserStorage = (): void => {
  if (isServer) return;
  sanitizeLegacyConfigStorage(localStorage, true);
  if (typeof sessionStorage !== 'undefined') {
    sanitizeLegacyConfigStorage(sessionStorage, false);
  }
};

// Secure simple UUID Generator
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ==========================================
// MAPPING FUNCTIONS: SUPABASE <-> FRONTEND
// ==========================================

// Helper to generate a unique, non-sequential referral code
export function generateReferralCode(existingCustomers: Customer[]): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let attempts = 0;
  while (attempts < 200) {
    let code = 'SL-';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const isDup = existingCustomers.some(c => c.referralCode === code);
    if (!isDup) {
      safeLog('info', 'referral.code.generate', 'success');
      return code;
    }
    attempts++;
  }
  const fallback = 'SL-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  safeLog('warn', 'referral.code.generate', 'success', { reason: 'fallback_used' });
  return fallback;
}

export function mapDbCustomerToFrontend(row: any): Customer {
  let name = row.nome || 'Sem Nome';
  let email = '';
  let cpf = '';
  let address = '';
  let neighborhood = '';
  let city = 'São Paulo';
  let notes = '';
  let status: 'ativo' | 'inativo' = 'ativo';
  let origin = 'Outros';
  
  let referralCode = '';
  let referredBy = '';
  let referralDiscountAvailable = false;
  let referralDiscountUsed = false;
  let referralCreatedAt = '';
  let referralServiceValue = 0;
  let referralBonusPercentUsed = 0;
  let referralBonusAmount = 0;

  const metaRegex = /\[meta:([\s\S]*?)\]\s*$/;
  const match = name.match(metaRegex);
  if (match) {
    try {
      const meta = JSON.parse(match[1]);
      if (meta.email) email = meta.email;
      if (meta.cpf) cpf = meta.cpf;
      if (meta.address) address = meta.address;
      if (meta.neighborhood) neighborhood = meta.neighborhood;
      if (meta.city) city = meta.city;
      if (meta.notes) notes = meta.notes;
      if (meta.status) status = meta.status;
      if (meta.origin) origin = meta.origin;
      
      if (meta.referralCode) referralCode = meta.referralCode;
      if (meta.referredBy) referredBy = meta.referredBy;
      if (meta.referralDiscountAvailable !== undefined) referralDiscountAvailable = meta.referralDiscountAvailable;
      if (meta.referralDiscountUsed !== undefined) referralDiscountUsed = meta.referralDiscountUsed;
      if (meta.referralCreatedAt) referralCreatedAt = meta.referralCreatedAt;
      if (meta.referralServiceValue !== undefined) referralServiceValue = meta.referralServiceValue;
      if (meta.referralBonusPercentUsed !== undefined) referralBonusPercentUsed = meta.referralBonusPercentUsed;
      if (meta.referralBonusAmount !== undefined) referralBonusAmount = meta.referralBonusAmount;
      
      name = name.replace(metaRegex, '').trim();
    } catch (e) {
      safeLog('error', 'customer.metadata.parse', 'error', {
        entityId: String(row.id || 'unknown'),
        error: e
      });
    }
  }

  safeLog('info', 'referral.code.load', 'success', {
    entityId: String(row.id || 'unknown'),
    reason: referralCode ? 'code_present' : 'code_absent'
  });

  return {
    id: row.id,
    name: name,
    phone: row.telefone || '',
    whatsapp: row.telefone || '',
    email: email,
    cpf: cpf,
    birthDate: row.data_aniversario || '',
    address: address,
    neighborhood: neighborhood,
    city: city,
    notes: notes,
    clientSince: row.created_at ? row.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
    lastServiceDate: null,
    status: status,
    origin: origin,
    referralCode,
    referredBy,
    referralDiscountAvailable,
    referralDiscountUsed,
    referralCreatedAt,
    referralServiceValue,
    referralBonusPercentUsed,
    referralBonusAmount
  };
}

export function mapFrontendCustomerToDb(c: Partial<Customer>): any {
  const row: any = {};
  if (c.id) row.id = c.id;
  
  let name = c.name || '';
  const hasExtra = c.email || c.cpf || c.address || c.neighborhood || c.city || c.notes || c.status || c.origin || c.referralCode || c.referredBy || c.referralDiscountAvailable !== undefined || c.referralDiscountUsed !== undefined || c.referralCreatedAt || c.referralServiceValue !== undefined || c.referralBonusPercentUsed !== undefined || c.referralBonusAmount !== undefined;
  if (hasExtra && name) {
    const meta: any = {};
    if (c.email) meta.email = c.email;
    if (c.cpf) meta.cpf = c.cpf;
    if (c.address) meta.address = c.address;
    if (c.neighborhood) meta.neighborhood = c.neighborhood;
    if (c.city) meta.city = c.city;
    if (c.notes) meta.notes = c.notes;
    if (c.status) meta.status = c.status;
    if (c.origin) meta.origin = c.origin;
    
    if (c.referralCode) meta.referralCode = c.referralCode;
    if (c.referredBy) meta.referredBy = c.referredBy;
    if (c.referralDiscountAvailable !== undefined) meta.referralDiscountAvailable = c.referralDiscountAvailable;
    if (c.referralDiscountUsed !== undefined) meta.referralDiscountUsed = c.referralDiscountUsed;
    if (c.referralCreatedAt) meta.referralCreatedAt = c.referralCreatedAt;
    if (c.referralServiceValue !== undefined) meta.referralServiceValue = c.referralServiceValue;
    if (c.referralBonusPercentUsed !== undefined) meta.referralBonusPercentUsed = c.referralBonusPercentUsed;
    if (c.referralBonusAmount !== undefined) meta.referralBonusAmount = c.referralBonusAmount;
    
    name = `${name} [meta:${JSON.stringify(meta)}]`.trim();
  }
  
  if (name) row.nome = name;
  if (c.phone || c.whatsapp) {
    row.telefone = (c.phone || c.whatsapp).replace(/\D/g, '');
  }
  if (c.birthDate) row.data_aniversario = c.birthDate;
  return row;
}

export function mapDbUserToFrontend(row: any): User {
  let permissions: Record<SystemModuleId, ModulePermission> | undefined = undefined;

  if (row.permissions !== undefined && row.permissions !== null) {
    try {
      const parsed = typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions;
      if (parsed && typeof parsed === 'object') {
        permissions = parsed;
      }
    } catch (e) {
      safeLog('warn', 'user.permissions.parse', 'error', {
        entityId: String(row.id || 'unknown'),
        error: e
      });
    }
  }

  if (permissions === undefined) {
    const roleKey = (row.perfil as UserRole) || 'tecnico';
    permissions = DEFAULT_ROLE_PERMISSIONS[roleKey] || DEFAULT_ROLE_PERMISSIONS.tecnico;
  }

  let commissions: ServiceCommissionRule[] = [];
  if (row.commissions) {
    try {
      commissions = typeof row.commissions === 'string' ? JSON.parse(row.commissions) : row.commissions;
    } catch (e) {
      safeLog('warn', 'user.commissions.parse', 'error', {
        entityId: String(row.id || 'unknown'),
        error: e
      });
    }
  }

  return {
    id: row.id,
    authUserId: row.auth_user_id || undefined,
    name: row.nome || row.name || 'Usuário',
    phone: row.telefone || row.phone || '',
    email: row.email || '',
    status: row.status || 'ativo',
    role: (row.perfil as UserRole) || 'tecnico',
    photoUrl: row.foto_url || row.photo_url || '',
    permissions,
    commissions,
    defaultCommissionPercent: row.default_commission_percent !== undefined ? Number(row.default_commission_percent) : 10,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString()
  };
}

export function hasModulePermission(
  user: User | (Partial<User> & { role?: string; permissions?: Record<string, ModulePermission>; status?: string }) | null | undefined,
  moduleId: SystemModuleId | string,
  action: 'view' | 'create' | 'edit' | 'delete' = 'view'
): boolean {
  if (!user) return false;
  if (user.status === 'inativo') return false;

  // 1. If explicit user permissions object exists on user, rely EXCLUSIVELY on it
  if (user.permissions && typeof user.permissions === 'object') {
    const modPerm = (user.permissions as Record<string, ModulePermission>)[moduleId as SystemModuleId];
    if (modPerm && typeof modPerm === 'object' && typeof modPerm[action] === 'boolean') {
      return Boolean(modPerm[action]);
    }
    // Explicit permission object defined, but this module/action is false or not set => DENIED
    return false;
  }

  // 2. Only if user.permissions is completely omitted (undefined), fall back to role defaults
  if (user.role && DEFAULT_ROLE_PERMISSIONS[user.role as UserRole]) {
    const roleDefault = DEFAULT_ROLE_PERMISSIONS[user.role as UserRole][moduleId as SystemModuleId];
    if (roleDefault && typeof roleDefault[action] === 'boolean') {
      return Boolean(roleDefault[action]);
    }
  }

  return false;
}

export function mapFrontendUserToDb(user: Partial<User> & { authUserId?: string }) {
  return {
    id: user.id,
    auth_user_id: user.authUserId || null,
    nome: user.name,
    email: user.email,
    telefone: user.phone || '',
    status: user.status || 'ativo',
    perfil: user.role || 'tecnico',
    foto_url: user.photoUrl || '',
    permissions: user.permissions || DEFAULT_ROLE_PERMISSIONS.tecnico,
    commissions: user.commissions || [],
    default_commission_percent: user.defaultCommissionPercent ?? 10,
    updated_at: new Date().toISOString()
  };
}

function getVehiclePorte(brand: string, model: string): 'Pequeno' | 'Médio' | 'Grande' {
  if (!brand || !model) return 'Médio';
  const b = brand.trim().toLowerCase();
  const m = model.trim().toLowerCase();
  
  // Fetch from the prefilled list
  let found = PREFILLED_VEHICLE_MODELS.find(
    item => item.manufacturer.toLowerCase() === b && item.model.toLowerCase() === m
  );
  
  // Also try looking in localStorage to get any custom user added models!
  if (!found && !isServer) {
    try {
      const cached = localStorage.getItem('sl_vehicle_models');
      if (cached) {
        const list = JSON.parse(cached) as VehicleModel[];
        found = list.find(
          item => item.manufacturer.toLowerCase() === b && item.model.toLowerCase() === m
        );
      }
    } catch (e) {
      // Ignored
    }
  }
  
  if (found) {
    if (found.size_category === 'P') return 'Pequeno';
    if (found.size_category === 'G') return 'Grande';
  }
  return 'Médio';
}

export function mapDbVehicleToFrontend(row: any): Vehicle {
  let model = row.modelo || 'Sem Modelo';
  let version = '';
  let year = '';
  let mileage = '';
  let isPrincipal = false;

  const metaRegex = /\[meta:([\s\S]*?)\]\s*$/;
  const match = model.match(metaRegex);
  if (match) {
    try {
      const meta = JSON.parse(match[1]);
      if (meta.version) version = meta.version;
      if (meta.year) year = meta.year;
      if (meta.mileage) mileage = meta.mileage;
      if (meta.isPrincipal !== undefined) isPrincipal = !!meta.isPrincipal;
      model = model.replace(metaRegex, '').trim();
    } catch (e) {
      safeLog('error', 'vehicle.metadata.parse', 'error', {
        entityId: String(row.id || 'unknown'),
        error: e
      });
    }
  }

  // Determine porte
  let porteVal: 'Pequeno' | 'Médio' | 'Grande' = 'Médio';
  if (row.porte === 'Pequeno' || row.porte === 'Médio' || row.porte === 'Grande') {
    porteVal = row.porte;
  } else {
    porteVal = getVehiclePorte(row.marca || '', model);
  }

  return {
    id: row.id,
    customerId: row.cliente_id || '',
    brand: row.marca || 'Sem Marca',
    model: model,
    version: version,
    year: year,
    plate: row.plate || row.placa || '',
    color: row.cor || 'Sem Cor',
    mileage: mileage,
    porte: porteVal,
    isPrincipal: isPrincipal
  };
}

export function mapFrontendVehicleToDb(v: Partial<Vehicle>): any {
  const row: any = {};
  if (v.id) row.id = v.id;
  if (v.customerId) row.cliente_id = v.customerId;
  if (v.brand) row.marca = v.brand;
  
  let model = v.model || '';
  const hasExtra = v.version || v.year || v.mileage || v.isPrincipal !== undefined;
  if (hasExtra && model) {
    const meta: any = {};
    if (v.version) meta.version = v.version;
    if (v.year) meta.year = v.year;
    if (v.mileage) meta.mileage = v.mileage;
    if (v.isPrincipal !== undefined) meta.isPrincipal = v.isPrincipal;
    model = `${model} [meta:${JSON.stringify(meta)}]`.trim();
  }
  
  if (model) row.modelo = model;
  if (v.plate) {
    row.placa = v.plate;
  }
  if (v.color) row.cor = v.color;
  row.porte = v.porte || getVehiclePorte(v.brand || '', v.model || '');
  return row;
}

export function mapDbServiceToFrontend(row: any): Service {
  let basePrice = 150.00;
  let estimatedTime = 120;
  let description = row.observacao || '';
  let pricingType: 'unico' | 'porte' = 'unico';
  let priceP: number | undefined;
  let priceM: number | undefined;
  let priceG: number | undefined;
  let isFeatured = false;
  let offerText = '';
  let displayOrder = 0;
  let portalVisibility: 'lista' | 'sugestao' | 'oculto' = 'lista';

  const metaRegex = /\[meta:([\s\S]*?)\]\s*$/;
  const match = description.match(metaRegex);
  if (match) {
    try {
      const meta = JSON.parse(match[1]);
      if (meta.price !== undefined) basePrice = Number(meta.price);
      if (meta.time !== undefined) estimatedTime = Number(meta.time);
      if (meta.pricingType !== undefined) pricingType = meta.pricingType;
      if (meta.priceP !== undefined) priceP = Number(meta.priceP);
      if (meta.priceM !== undefined) priceM = Number(meta.priceM);
      if (meta.priceG !== undefined) priceG = Number(meta.priceG);
      if (meta.isFeatured !== undefined) isFeatured = Boolean(meta.isFeatured);
      if (meta.offerText !== undefined) offerText = String(meta.offerText);
      if (meta.displayOrder !== undefined) displayOrder = Number(meta.displayOrder);
      if (meta.portalVisibility !== undefined) {
        portalVisibility = meta.portalVisibility;
      } else if (isFeatured) {
        portalVisibility = 'sugestao';
      }
      description = description.replace(metaRegex, '').trim();
    } catch (e) {
      safeLog('error', 'service.metadata.parse', 'error', {
        entityId: String(row.id || 'unknown'),
        error: e
      });
    }
  }

  return {
    id: row.id,
    name: row.nome_servico || 'Sem Nome',
    description: description,
    basePrice: basePrice,
    estimatedTime: estimatedTime,
    pricingType: pricingType,
    priceP: priceP ?? basePrice,
    priceM: priceM ?? basePrice,
    priceG: priceG ?? basePrice,
    isFeatured: isFeatured || portalVisibility === 'sugestao',
    offerText: offerText,
    displayOrder: displayOrder,
    portalVisibility: portalVisibility
  };
}

function mapFrontendServiceToDb(s: Partial<Service>): any {
  const row: any = {};
  if (s.id) row.id = s.id;
  if (s.name) row.nome_servico = s.name;
  
  let obs = s.description || '';
  const portalVisibility = s.portalVisibility ?? (s.isFeatured ? 'sugestao' : 'lista');
  const meta: any = {
    price: s.basePrice ?? 150.00,
    time: s.estimatedTime ?? 120,
    pricingType: s.pricingType ?? 'unico',
    priceP: s.priceP ?? s.basePrice ?? 150.00,
    priceM: s.priceM ?? s.basePrice ?? 150.00,
    priceG: s.priceG ?? s.basePrice ?? 150.00,
    isFeatured: s.isFeatured ?? (portalVisibility === 'sugestao'),
    offerText: s.offerText ?? '',
    displayOrder: s.displayOrder ?? 0,
    portalVisibility: portalVisibility
  };
  obs = `${obs} [meta:${JSON.stringify(meta)}]`.trim();
  row.observacao = obs;
  row.ativo = true;
  row.categoria = 'Estética';
  return row;
}

export function mapDbAppointmentToFrontend(row: any): Appointment {
  let status: AppointmentStatus = 'agendado';
  const dbStatus = String(row.status || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
  
  if (dbStatus === 'agendado') {
    status = 'agendado';
  } else if (dbStatus === 'confirmado') {
    status = 'confirmado';
  } else if (dbStatus === 'em_andamento') {
    status = 'em_andamento';
  } else if (dbStatus === 'concluido' || dbStatus === 'finalizado') {
    status = 'finalizado';
  } else if (dbStatus === 'entregue') {
    status = 'entregue';
  } else if (dbStatus === 'cancelado') {
    status = 'cancelado';
  } else if (
    dbStatus === 'cliente_chegou'
    || dbStatus === 'aguardando_aprovacao'
    || dbStatus === 'aguardando_peca'
  ) {
    status = dbStatus as AppointmentStatus;
  }

  const dateStr = row.data_agendamento || getCurrentDateStr();
  const timeStr = row.hora_agendamento ? row.hora_agendamento.slice(0, 5) : '09:00';
  const dateTime = `${dateStr}T${timeStr}`;

  let notes = row.observacoes || '';
  let employeeId = 'Gabriel';
  let discount = 0;
  let addition = 0;
  let serviceIds: string[] = [row.servico_id || ''];
  let startedAt: string | undefined = undefined;
  let concludedAt: string | undefined = undefined;
  let reminderSent = false;

  const metaRegex = /\[meta:([\s\S]*?)\]\s*$/;
  const match = notes.match(metaRegex);
  if (match) {
    try {
      const meta = JSON.parse(match[1]);
      if (meta.employeeId) employeeId = meta.employeeId;
      if (meta.discount !== undefined) discount = Number(meta.discount);
      if (meta.addition !== undefined) addition = Number(meta.addition);
      if (meta.serviceIds) serviceIds = meta.serviceIds;
      if (meta.startedAt) startedAt = meta.startedAt;
      if (meta.concludedAt) concludedAt = meta.concludedAt;
      if (meta.reminderSent !== undefined) reminderSent = !!meta.reminderSent;
      notes = notes.replace(metaRegex, '').trim();
    } catch (e) {
      safeLog('error', 'appointment.metadata.parse', 'error', {
        entityId: String(row.id || 'unknown'),
        error: e
      });
    }
  }

  return {
    id: row.id,
    customerId: row.cliente_id || '',
    vehicleId: row.veiculo_id || '',
    serviceId: row.servico_id || '',
    serviceIds: serviceIds,
    dateTime: dateTime,
    status: status,
    value: Number(row.valor_servico) || 0,
    durationTotal: Number(row.tempo_real) || 120,
    employeeId: employeeId,
    discount: discount,
    addition: addition,
    notes: notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt,
    concludedAt,
    reminderSent
  };
}

export function mapFrontendAppointmentToDb(a: Partial<Appointment>): any {
  const row: any = {};
  if (a.id) row.id = a.id;
  if (a.customerId) row.cliente_id = a.customerId;
  if (a.vehicleId) row.veiculo_id = a.vehicleId;
  if (a.serviceId) row.servico_id = a.serviceId;
  
  if (a.dateTime) {
    const parts = a.dateTime.split('T');
    row.data_agendamento = parts[0];
    if (parts[1]) {
      row.hora_agendamento = parts[1].slice(0, 5) + ':00';
    }
  }
  
  if (a.status) {
    const dbStatusByFrontend: Record<AppointmentStatus, string> = {
      agendado: 'Agendado',
      confirmado: 'Confirmado',
      cliente_chegou: 'Cliente chegou',
      em_andamento: 'Em andamento',
      aguardando_aprovacao: 'Aguardando aprovação',
      aguardando_peca: 'Aguardando peça',
      finalizado: 'Finalizado',
      entregue: 'Entregue',
      cancelado: 'Cancelado'
    };
    row.status = dbStatusByFrontend[a.status];
  }
  
  if (a.value !== undefined) row.valor_servico = a.value;
  if (a.durationTotal !== undefined) row.tempo_real = a.durationTotal;
  
  let notes = a.notes || '';
  const hasExtra = a.employeeId || a.discount !== undefined || a.addition !== undefined || a.serviceIds || a.startedAt || a.concludedAt || a.reminderSent !== undefined;
  if (hasExtra) {
    const meta: any = {};
    if (a.employeeId) meta.employeeId = a.employeeId;
    if (a.discount !== undefined) meta.discount = a.discount;
    if (a.addition !== undefined) meta.addition = a.addition;
    if (a.serviceIds) meta.serviceIds = a.serviceIds;
    if (a.startedAt) meta.startedAt = a.startedAt;
    if (a.concludedAt) meta.concludedAt = a.concludedAt;
    if (a.reminderSent !== undefined) meta.reminderSent = a.reminderSent;
    notes = `${notes} [meta:${JSON.stringify(meta)}]`.trim();
  }
  row.observacoes = notes;
  
  return row;
}

// Database class
class LocalDatabase {
  customers: Customer[] = [];
  vehicles: Vehicle[] = [];
  services: Service[] = [];
  appointments: Appointment[] = [];
  history: HistoryRecord[] = [];
  finances: CashTransaction[] = [];
  config: SystemConfig = DEFAULT_CONFIG;
  supabaseServiceRoleKey?: string;
  automations: AutomationTrigger[] = [];
  logs: AutomationLog[] = [];
  vehicleModels: VehicleModel[] = [];
  executions: AutomationExecution[] = [];
  users: User[] = [];
  commissions: CommissionRecord[] = [];
  automationConfigUpdatedAt: string | null = null;
  lastSupabaseSync = {
    configLoaded: false,
    customersLoaded: false,
    vehiclesLoaded: false,
    servicesLoaded: false,
    appointmentsLoaded: false
  };
  
  onSyncCallback: (() => void) | null = null;

  constructor() {
    this.init();
  }

  init() {
    migrateLegacySensitiveBrowserStorage();

    this.customers = getLocalData<Customer[]>(KEYS.CUSTOMERS, isServer ? DEFAULT_CUSTOMERS : []);
    this.vehicles = getLocalData<Vehicle[]>(KEYS.VEHICLES, isServer ? DEFAULT_VEHICLES : []);
    this.services = getLocalData<Service[]>(KEYS.SERVICES, DEFAULT_SERVICES);
    this.appointments = getLocalData<Appointment[]>(KEYS.APPOINTMENTS, isServer ? DEFAULT_APPOINTMENTS : []);
    this.history = getLocalData<HistoryRecord[]>(KEYS.HISTORY, []);
    this.finances = getLocalData<CashTransaction[]>(KEYS.FINANCES, []);
    this.executions = isServer ? getLocalData<AutomationExecution[]>('sl_executions', []) : [];
    this.users = getLocalData<Array<User & { password?: string }>>(
      KEYS.USERS,
      isServer ? DEFAULT_USERS : []
    )
      .map(({ password: _legacyPassword, ...user }) => user);
    // Remove imediatamente qualquer senha deixada por versões antigas do cache.
    setLocalData(KEYS.USERS, this.users);
    this.commissions = getLocalData<CommissionRecord[]>(KEYS.COMMISSIONS, []);
    
    // Only public interface configuration may be cached in the browser.
    const savedConfig = toPublicSystemConfig(
      getLocalData<Partial<SystemConfig>>('sl_config_cache', DEFAULT_CONFIG)
    );
    this.config = { ...DEFAULT_CONFIG, ...savedConfig };
    
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(KEYS.AUTOMATIONS);
      localStorage.removeItem('sl_automations_cache');
    }
    this.automations = DEFAULT_AUTOMATIONS;
    this.ensureAllDefaultAutomationsExist();
    this.logs = isServer ? getLocalData<AutomationLog[]>(KEYS.LOGS, []) : [];
    this.vehicleModels = getLocalData<VehicleModel[]>(KEYS.VEHICLE_MODELS, PREFILLED_VEHICLE_MODELS);
    
    this.recalculateCommissions();

    // Automatically trigger initial fetch on load if Supabase is active
    if (isServer && this.config.useRealSupabase) {
      this.syncWithSupabase();
    }
  }

  save() {
    setLocalData(KEYS.CUSTOMERS, this.customers);
    setLocalData(KEYS.VEHICLES, this.vehicles);
    setLocalData(KEYS.SERVICES, this.services);
    setLocalData(KEYS.APPOINTMENTS, this.appointments);
    setLocalData(KEYS.HISTORY, this.history);
    setLocalData(KEYS.FINANCES, this.finances);
    // Store only non-critical interface cache, removing legacy configuration keys to meet requirement
    setLocalData('sl_config_cache', toPublicSystemConfig(this.config));
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('sl_automations_cache');
    }
    setLocalData(KEYS.VEHICLE_MODELS, this.vehicleModels);
    if (isServer) {
      setLocalData(KEYS.LOGS, this.logs);
      setLocalData('sl_executions', this.executions);
    }
    const usersWithoutPasswords = this.users.map(user => {
      const { password: _legacyPassword, ...safeUser } = user as User & { password?: string };
      return safeUser;
    });
    setLocalData(KEYS.USERS, usersWithoutPasswords);
    setLocalData(KEYS.COMMISSIONS, this.commissions);
  }

  ensureAllDefaultAutomationsExist() {
    if (!Array.isArray(this.automations)) {
      this.automations = [];
    }
    let updated = false;
    for (const defaultAuto of DEFAULT_AUTOMATIONS) {
      const exists = this.automations.some(a => a && a.event === defaultAuto.event);
      if (!exists) {
        safeLog('info', 'automation.restore_default', 'started', {
          eventType: defaultAuto.event
        });
        this.automations.push({ ...defaultAuto });
        updated = true;
      }
    }
    if (updated) {
      this.save();
    }
  }

  getSupabaseClient() {
    const key = (isServer && this.supabaseServiceRoleKey)
      ? this.supabaseServiceRoleKey
      : this.config.supabaseAnonKey;
    return getSharedSupabaseClient(this.config.supabaseUrl, key);
  }

  async loadConfigFromSupabase(supabase: any) {
    try {
      safeLog('info', 'supabase.config.load', 'started');
      const publicColumns = [
        'id',
        'company_name',
        'phone',
        'email',
        'cnpj',
        'address',
        'hours_of_operation',
        'logo_url',
        'primary_color',
        'accent_color',
        'referral_active',
        'referral_discount_percent',
        'agenda',
        'automations',
        'updated_at'
      ].join(',');
      const { data, error } = await supabase
        .from('configuracoes_empresa')
        .select(publicColumns)
        .eq('id', 'c0000000-0000-0000-0000-000000000000')
        .single();
      
      if (!error && data) {
        safeLog('info', 'supabase.config.load', 'success');
        this.config = {
          ...this.config,
          companyName: data.company_name || this.config.companyName,
          phone: data.phone || this.config.phone,
          email: data.email || this.config.email,
          cnpj: data.cnpj || this.config.cnpj,
          address: data.address || this.config.address,
          hoursOfOperation: data.hours_of_operation || this.config.hoursOfOperation,
          logoUrl: data.logo_url || this.config.logoUrl,
          primaryColor: data.primary_color || this.config.primaryColor,
          accentColor: data.accent_color || this.config.accentColor,
          referralActive: data.referral_active !== undefined ? data.referral_active : this.config.referralActive,
          referralDiscountPercent: data.referral_discount_percent !== undefined ? data.referral_discount_percent : this.config.referralDiscountPercent,
          agenda: data.agenda ? (typeof data.agenda === 'string' ? JSON.parse(data.agenda) : data.agenda) : this.config.agenda
        };
        
        const parsedAutomations = typeof data.automations === 'string'
          ? JSON.parse(data.automations)
          : data.automations;
        if (parsedAutomations !== null && !Array.isArray(parsedAutomations)) {
          safeLog('error', 'supabase.config.load', 'error', {
            reason: 'invalid_automations_shape'
          });
          return false;
        }
        if (Array.isArray(parsedAutomations) && parsedAutomations.length > 0) {
          this.automations = parsedAutomations;
        } else {
          this.automations = DEFAULT_AUTOMATIONS.map(item => ({ ...item }));
        }
        this.automationConfigUpdatedAt = data.updated_at || null;
        
        // Remove old LocalStorage configs to fulfill migration cleanup requirement
        if (!isServer) {
          localStorage.removeItem(KEYS.CONFIG);
          localStorage.removeItem(KEYS.AUTOMATIONS);
        }
        return true;
      } else {
        if (error && (error.code === 'PGRST205' || error.message?.includes('does not exist') || error.code === '42P01')) {
          safeLog('warn', 'supabase.config.load', 'error', {
            reason: 'table_not_found'
          });
        } else {
          safeLog('warn', 'supabase.config.load', 'error', { error });
        }
      }
    } catch (err: any) {
      safeLog('error', 'supabase.config.load', 'error', { error: err });
    }
    return false;
  }

  async saveConfigToSupabase(supabaseClient?: any): Promise<boolean> {
    if (!this.config.useRealSupabase) return false;
    
    try {
      const supabase = supabaseClient || this.getSupabaseClient();
      safeLog('info', 'supabase.config.save', 'started');
      
      const { error } = await supabase.from('configuracoes_empresa').upsert({
        id: 'c0000000-0000-0000-0000-000000000000',
        company_name: this.config.companyName,
        phone: this.config.phone,
        email: this.config.email,
        cnpj: this.config.cnpj,
        address: this.config.address,
        hours_of_operation: this.config.hoursOfOperation,
        logo_url: this.config.logoUrl,
        primary_color: this.config.primaryColor,
        accent_color: this.config.accentColor,
        referral_active: this.config.referralActive ?? true,
        referral_discount_percent: this.config.referralDiscountPercent ?? 10,
        agenda: this.config.agenda ? JSON.stringify(this.config.agenda) : undefined
      });
      
      if (!error) {
        safeLog('info', 'supabase.config.save', 'success');
        return true;
      }
      safeLog('error', 'supabase.config.save', 'error', { error });
    } catch (err: any) {
      safeLog('error', 'supabase.config.save', 'error', { error: err });
    }
    return false;
  }

  // --- SUPABASE LIVE SYNC ENGINE ---
  async syncWithSupabase() {
    this.lastSupabaseSync = {
      configLoaded: false,
      customersLoaded: false,
      vehiclesLoaded: false,
      servicesLoaded: false,
      appointmentsLoaded: false
    };
    if (!this.config.useRealSupabase) {
      safeLog('info', 'supabase.sync', 'ignored', { reason: 'disabled' });
      return;
    }
    if (!this.config.supabaseUrl || !this.config.supabaseAnonKey) {
      safeLog('warn', 'supabase.sync', 'ignored', { reason: 'public_config_missing' });
      return;
    }
    
    safeLog('info', 'supabase.sync', 'started');
    
    try {
      const supabase = this.getSupabaseClient();

      // Load configurations from Supabase first
      this.lastSupabaseSync.configLoaded = await this.loadConfigFromSupabase(supabase);

      // 1. Fetch Clientes
      safeLog('info', 'supabase.sync.customers', 'started');
      const { data: dbClientes, error: errClientes } = await supabase.from('clientes').select('*');
      if (errClientes) {
        safeLog('error', 'supabase.sync.customers', 'error', { error: errClientes });
      } else if (dbClientes) {
        this.lastSupabaseSync.customersLoaded = true;
        safeLog('info', 'supabase.sync.customers', 'success', { count: dbClientes.length });
        // Filter out system configurations record
        this.customers = dbClientes.filter(row => row.id !== 'c0000000-0000-0000-0000-000000000000').map(mapDbCustomerToFrontend);
        
        // Log existing referral codes loaded from database
        this.customers.forEach(customer => {
          safeLog('info', 'referral.code.sync_load', 'success', {
            entityId: customer.id,
            reason: customer.referralCode ? 'code_present' : 'code_absent'
          });
        });
        
        // Auto-generate referral codes for legacy/existing customers who don't have one
        let updatedAny = false;
        for (const customer of this.customers) {
          if (!customer.referralCode) {
            safeLog('info', 'referral.code.backfill', 'started', {
              entityId: customer.id
            });
            const generatedCode = generateReferralCode(this.customers);
            customer.referralCode = generatedCode;
            customer.referralDiscountAvailable = customer.referralDiscountAvailable ?? false;
            customer.referralDiscountUsed = customer.referralDiscountUsed ?? false;
            customer.referralCreatedAt = customer.referralCreatedAt || new Date().toISOString().split('T')[0];
            
            safeLog('info', 'referral.code.backfill', 'started', {
              entityId: customer.id,
              operation: 'persist'
            });
            try {
              const mapped = mapFrontendCustomerToDb(customer);
              const { error: errUpdate } = await supabase.from('clientes').update(mapped).eq('id', customer.id);
              if (errUpdate) {
                safeLog('error', 'referral.code.backfill', 'error', {
                  entityId: customer.id,
                  error: errUpdate
                });
              } else {
                safeLog('info', 'referral.code.backfill', 'success', {
                  entityId: customer.id
                });
              }
            } catch (err) {
              safeLog('error', 'referral.code.backfill', 'error', {
                entityId: customer.id,
                error: err
              });
            }
            updatedAny = true;
          }
        }
        if (updatedAny) {
          this.save();
        }
      }

      // 2. Fetch Veículos
      safeLog('info', 'supabase.sync.vehicles', 'started');
      const { data: dbVeiculos, error: errVeiculos } = await supabase.from('veiculos').select('*');
      if (errVeiculos) {
        safeLog('error', 'supabase.sync.vehicles', 'error', { error: errVeiculos });
      } else if (dbVeiculos) {
        this.lastSupabaseSync.vehiclesLoaded = true;
        safeLog('info', 'supabase.sync.vehicles', 'success', { count: dbVeiculos.length });
        this.vehicles = dbVeiculos.map(mapDbVehicleToFrontend);
      }

      // 3. Fetch Serviços
      safeLog('info', 'supabase.sync.services', 'started');
      const { data: dbServicos, error: errServicos } = await supabase.from('servicos_disponiveis').select('*');
      if (errServicos) {
        safeLog('error', 'supabase.sync.services', 'error', { error: errServicos });
      } else if (dbServicos) {
        this.lastSupabaseSync.servicesLoaded = true;
        safeLog('info', 'supabase.sync.services', 'success', { count: dbServicos.length });
        this.services = dbServicos.map(mapDbServiceToFrontend);
      }

      // 4. Fetch Agendamentos
      safeLog('info', 'supabase.sync.appointments', 'started');
      const { data: dbAgendamentos, error: errAgendamentos } = await supabase.from('agendamentos').select('*');
      if (errAgendamentos) {
        safeLog('error', 'supabase.sync.appointments', 'error', { error: errAgendamentos });
      } else if (dbAgendamentos) {
        this.lastSupabaseSync.appointmentsLoaded = true;
        safeLog('info', 'supabase.sync.appointments', 'success', { count: dbAgendamentos.length });
        this.appointments = dbAgendamentos.map(mapDbAppointmentToFrontend);
      }

      // 4.6 Fetch Automation Executions
      try {
        safeLog('info', 'supabase.sync.automation_executions', 'started');
        const { data: dbExecucoes, error: errExecucoes } = await supabase.from('automacoes_execucoes').select('*');
        if (dbExecucoes && !errExecucoes) {
          safeLog('info', 'supabase.sync.automation_executions', 'success', {
            count: dbExecucoes.length
          });
          this.executions = dbExecucoes.map((row: any) => ({
            id: row.id,
            empresa_id: row.empresa_id || 'c0000000-0000-0000-0000-000000000000',
            automacao: row.automacao || '',
            appointment_id: row.appointment_id || undefined,
            customer_id: row.customer_id || '',
            telefone: row.telefone || '',
            mensagem: row.mensagem || '',
            status: row.status || 'pendente',
            tentativas: row.tentativas !== undefined ? row.tentativas : 1,
            resposta_api: row.resposta_api || undefined,
            deduplication_key: row.deduplication_key || undefined,
            data_execucao: row.data_execucao || new Date().toISOString(),
            data_proxima_tentativa: row.data_proxima_tentativa || undefined,
            created_at: row.created_at || new Date().toISOString(),
            updated_at: row.updated_at || new Date().toISOString()
          }));
        } else if (errExecucoes) {
          safeLog('warn', 'supabase.sync.automation_executions', 'error', {
            reason: 'using_local_cache',
            error: errExecucoes
          });
        }
      } catch (e: any) {
        safeLog('warn', 'supabase.sync.automation_executions', 'error', {
          reason: 'using_local_cache',
          error: e
        });
      }

      // 4.5 Fetch Modelos de Veículos (Reference Table)
      try {
        const { data: dbModelos, error: errModelos } = await supabase.from('vehicle_models').select('*');
        if (dbModelos && !errModelos) {
          this.vehicleModels = dbModelos.map(row => ({
            id: row.id,
            manufacturer: row.manufacturer || '',
            model: row.model || '',
            size_category: (row.size_category || 'M') as 'P' | 'M' | 'G',
            active: row.active !== undefined ? row.active : true,
            created_at: row.created_at,
            updated_at: row.updated_at
          }));
        } else if (errModelos) {
          safeLog('warn', 'supabase.sync.vehicle_models', 'error', {
            reason: 'using_local_cache',
            error: errModelos
          });
        }
      } catch (e: any) {
        safeLog('warn', 'supabase.sync.vehicle_models', 'error', {
          reason: 'using_local_cache',
          error: e
        });
      }

      // 4.7 Fetch Usuários
      try {
        safeLog('info', 'supabase.sync.users', 'started');
        const { data: dbUsuarios, error: errUsuarios } = await supabase.from('usuarios').select('*');
        if (dbUsuarios && !errUsuarios) {
          safeLog('info', 'supabase.sync.users', 'success', { count: dbUsuarios.length });
          this.users = dbUsuarios.map(mapDbUserToFrontend);
        } else if (errUsuarios) {
          safeLog('warn', 'supabase.sync.users', 'error', { error: errUsuarios });
        }
      } catch (e: any) {
        safeLog('warn', 'supabase.sync.users', 'error', { error: e });
      }

      // 5. Derive History dynamically from Completed/Delivered appointments
      this.history = this.appointments
        .filter(a => a.status === 'finalizado' || a.status === 'entregue')
        .map(appt => {
          const customer = this.customers.find(c => c.id === appt.customerId);
          const vehicle = this.vehicles.find(v => v.id === appt.vehicleId);
          const service = this.services.find(s => s.id === appt.serviceId);
          return {
            id: 'h_' + appt.id,
            appointmentId: appt.id,
            customerId: appt.customerId,
            customerName: customer ? customer.name : 'Cliente Estética',
            vehicleId: appt.vehicleId,
            vehicleDetails: vehicle ? `${vehicle.brand} ${vehicle.model} [${vehicle.plate}]` : 'Veículo Estética',
            serviceId: appt.serviceId,
            serviceName: service ? service.name : 'Serviço Estética',
            value: appt.value,
            date: appt.dateTime.split('T')[0],
            notes: appt.notes || 'Serviço finalizado com sucesso.',
            timeSpent: appt.durationTotal || 120,
            employeeResponsible: appt.employeeId || 'Gabriel'
          };
        });

      // 6. Derive Finances (Revenues) dynamically, keeping local Expenses
      const localExpenses = this.finances.filter(t => t.type === 'despesa');
      const derivedRevenues = this.appointments
        .filter(a => a.status === 'finalizado' || a.status === 'entregue')
        .map(appt => {
          const customer = this.customers.find(c => c.id === appt.customerId);
          const service = this.services.find(s => s.id === appt.serviceId);
          return {
            id: 't_rev_' + appt.id,
            type: 'receita' as const,
            category: 'Serviço',
            amount: appt.value,
            date: appt.dateTime.split('T')[0],
            description: `Serviço ${service?.name || 'Automotivo'} - ${customer?.name || 'Cliente'}`,
            status: 'pago' as const
          };
        });

      this.finances = [...derivedRevenues, ...localExpenses];

      // Update LocalStorage as an offline cache
      this.save();

      // Trigger UI callback to refresh React views
      if (this.onSyncCallback) {
        this.onSyncCallback();
      }
    } catch (e) {
      safeLog('error', 'supabase.sync', 'error', { error: e });
    }
  }

  // --- LOG TRIGGER / AUTOMATION ---
  private triggerAutomation(
    event: 'novo_cliente' | 'novo_agendamento' | 'servico_iniciado' | 'servico_finalizado' | 'cliente_inativo' | 'aniversario' | 'pagamento_recebido' | 'lembrete_agendamento',
    context: { customer: Customer; vehicle?: Vehicle; service?: Service; appointment?: Appointment }
  ) {
    const automation = this.automations.find(a => a.event === event);
    if (!automation || !automation.isActive) {
      safeLog('info', 'automation.trigger', 'ignored', {
        eventType: event,
        reason: 'missing_or_inactive'
      });
      return;
    }

    const isOperationalEvent = [
      'novo_agendamento',
      'novo_cliente',
      'servico_iniciado',
      'servico_finalizado',
      'pagamento_recebido'
    ].includes(event);

    if (isOperationalEvent) {
      try {
        this.addLog({
          id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          triggerEvent: automation.name,
          targetName: 'Cliente protegido',
          targetContact: maskPhone(context.customer.phone || context.customer.whatsapp),
          payload: 'Operação concluída. A notificação é gerenciada automaticamente pelo banco de dados.',
          status: 'sucesso',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        safeLog('error', 'automation.trigger.audit', 'error', {
          eventType: event,
          error
        });
      }
      return;
    }

    void this.queueAutomation(event, context)
      .then((execution) => {
        if (!execution) return;
        this.addLog({
          id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          triggerEvent: automation.name,
          targetName: 'Cliente protegido',
          targetContact: maskPhone(context.customer.phone || context.customer.whatsapp),
          payload: `Evento enfileirado com segurança. ID: ${execution.id}`,
          status: 'sucesso',
          timestamp: new Date().toISOString()
        });
      })
      .catch(() => {
        this.addLog({
          id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          triggerEvent: automation.name,
          targetName: 'Cliente protegido',
          targetContact: 'Contato protegido',
          payload: 'Falha ao enfileirar o evento para processamento seguro.',
          status: 'erro',
          timestamp: new Date().toISOString()
        });
      });
  }

  addLog(log: AutomationLog) {
    this.logs.unshift(log);
    if (this.logs.length > 100) this.logs.pop();
    this.save();
  }

  // --- CRUD CUSTOMERS ---
  validateReferralCode(code: string, currentCustomerId?: string, currentCustomerPhone?: string): { valid: boolean; error?: string; referrer?: Customer } {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      return { valid: false, error: 'Código de indicação em branco.' };
    }
    
    // Find the customer who owns this code
    const referrer = this.customers.find(c => c.referralCode?.toUpperCase() === cleanCode);
    
    safeLog('info', 'referral.code.validate', referrer ? 'success' : 'denied', {
      entityId: currentCustomerId,
      relatedEntityId: referrer?.id,
      phone: currentCustomerPhone,
      reason: referrer ? 'owner_found' : 'owner_not_found'
    });

    if (!referrer) {
      return { valid: false, error: 'código de indicação inválido.' };
    }
    
    // Se o cliente ainda estiver criando o primeiro cadastro, não executar a validação de "código próprio", pois ainda não há um ID do cliente para compará.
    // Se o cliente já existir no sistema, comparar somente o ID do cliente atual com o ID do proprietário do código, bloqueando apenas quando forem exatamente iguais.
    if (currentCustomerId && referrer.id === currentCustomerId) {
      return { valid: false, error: 'Você não pode utilizar seu próprio código de indicação.' };
    }
    
    return { valid: true, referrer };
  }

  async addCustomer(customer: Omit<Customer, 'id' | 'clientSince' | 'lastServiceDate'>): Promise<Customer> {
    const id = generateUUID();
    const clientSince = new Date().toISOString().split('T')[0];

    safeLog('info', 'customer.create', 'started', { entityId: id });

    // Create the customer object without referralCode first to match step 2 (saved first)
    const customerObjWithoutCode: Customer = {
      ...customer,
      id,
      clientSince,
      lastServiceDate: null,
      referralDiscountAvailable: customer.referralDiscountAvailable ?? false,
      referralDiscountUsed: customer.referralDiscountUsed ?? false,
      referralCreatedAt: customer.referralCreatedAt || clientSince
    };

    // 2. Cliente é salvo no Supabase (cliente salvo)
    if (this.config.useRealSupabase) {
      const supabase = this.getSupabaseClient();
      safeLog('info', 'customer.create.persist', 'started', { entityId: id });
      const { error } = await supabase.from('clientes').insert(mapFrontendCustomerToDb(customerObjWithoutCode));
      if (error) {
        safeLog('error', 'customer.create.persist', 'error', { entityId: id, error });
        throw error;
      }
      safeLog('info', 'customer.create.persist', 'success', { entityId: id });
    } else {
      safeLog('info', 'customer.create.persist', 'success', {
        entityId: id,
        operation: 'local'
      });
    }

    // 3. Verificar se já existe referralCode. Se não existir,
    safeLog('info', 'referral.code.ensure', 'started', { entityId: id });
    let referralCode = customer.referralCode || '';
    if (referralCode) {
      safeLog('info', 'referral.code.ensure', 'success', {
        entityId: id,
        reason: 'existing_code'
      });
    } else {
      safeLog('info', 'referral.code.ensure', 'started', {
        entityId: id,
        reason: 'code_absent'
      });
      
      // 4. Gerar um único código (código gerado)
      referralCode = generateReferralCode(this.customers);
      safeLog('info', 'referral.code.ensure', 'success', {
        entityId: id,
        reason: 'code_generated'
      });
    }

    const finalCustomer: Customer = {
      ...customerObjWithoutCode,
      referralCode
    };

    // 5. Salvar definitivamente no Supabase (código gravado com sucesso)
    if (this.config.useRealSupabase) {
      const supabase = this.getSupabaseClient();
      safeLog('info', 'referral.code.persist', 'started', { entityId: id });
      const { error } = await supabase.from('clientes').update(mapFrontendCustomerToDb(finalCustomer)).eq('id', id);
      if (error) {
        safeLog('error', 'referral.code.persist', 'error', { entityId: id, error });
        throw error;
      }
      safeLog('info', 'referral.code.persist', 'success', { entityId: id });
    } else {
      safeLog('info', 'referral.code.persist', 'success', {
        entityId: id,
        operation: 'local'
      });
    }

    // 6. Atualizar o estado local
    this.customers.push(finalCustomer);
    this.save();
    safeLog('info', 'customer.create', 'success', { entityId: id });

    this.triggerAutomation('novo_cliente', { customer: finalCustomer });
    return finalCustomer;
  }

  async updateCustomer(id: string, updated: Partial<Customer>): Promise<void> {
    const existing = this.customers.find(c => c.id === id);
    const fullCustomer = existing ? { ...existing, ...updated } : updated;

    safeLog('info', 'customer.update', 'started', { entityId: id });
    if (this.config.useRealSupabase) {
      const supabase = this.getSupabaseClient();
      const mapped = mapFrontendCustomerToDb(fullCustomer);
      const { error } = await supabase.from('clientes').update(mapped).eq('id', id);
      if (error) {
        safeLog('error', 'customer.update', 'error', { entityId: id, error });
        throw error;
      }
      safeLog('info', 'customer.update', 'success', { entityId: id });
    }

    this.customers = this.customers.map(c => c.id === id ? { ...c, ...updated } : c);
    this.save();
  }

  async deleteCustomer(id: string): Promise<void> {
    if (this.config.useRealSupabase) {
      const supabase = this.getSupabaseClient();
      // To satisfy potential foreign key constraints:
      await supabase.from('agendamentos').delete().eq('cliente_id', id);
      await supabase.from('veiculos').delete().eq('cliente_id', id);
      const { error } = await supabase.from('clientes').delete().eq('id', id);
      if (error) {
        safeLog('error', 'customer.delete', 'error', { entityId: id, error });
        throw error;
      }
    }

    this.customers = this.customers.filter(c => c.id !== id);
    this.vehicles = this.vehicles.filter(v => v.customerId !== id);
    this.appointments = this.appointments.filter(a => a.customerId !== id);
    this.save();
  }

  // --- CRUD VEHICLES ---
  async addVehicle(vehicle: Omit<Vehicle, 'id'>): Promise<Vehicle> {
    const id = generateUUID();
    const newVehicle: Vehicle = {
      ...vehicle,
      id
    };
    
    if (this.config.useRealSupabase) {
      const supabase = this.getSupabaseClient();
      const { error } = await supabase.from('veiculos').insert(mapFrontendVehicleToDb(newVehicle));
      if (error) {
        safeLog('error', 'vehicle.create', 'error', { entityId: id, error });
        throw error;
      }
    }
    
    this.vehicles.push(newVehicle);
    this.save();
    return newVehicle;
  }

  async updateVehicle(id: string, updated: Partial<Vehicle>): Promise<void> {
    if (this.config.useRealSupabase) {
      const supabase = this.getSupabaseClient();
      const { error } = await supabase.from('veiculos').update(mapFrontendVehicleToDb(updated)).eq('id', id);
      if (error) {
        safeLog('error', 'vehicle.update', 'error', { entityId: id, error });
        throw error;
      }
    }

    this.vehicles = this.vehicles.map(v => v.id === id ? { ...v, ...updated } : v);
    this.save();
  }

  async deleteVehicle(id: string): Promise<void> {
    if (this.config.useRealSupabase) {
      const supabase = this.getSupabaseClient();
      await supabase.from('agendamentos').delete().eq('veiculo_id', id);
      const { error } = await supabase.from('veiculos').delete().eq('id', id);
      if (error) {
        safeLog('error', 'vehicle.delete', 'error', { entityId: id, error });
        throw error;
      }
    }

    this.vehicles = this.vehicles.filter(v => v.id !== id);
    this.appointments = this.appointments.filter(a => a.vehicleId !== id);
    this.save();
  }

  // --- CRUD SERVICES ---
  async addService(service: Omit<Service, 'id'>): Promise<Service> {
    const id = generateUUID();
    const newService: Service = {
      ...service,
      id
    };
    
    if (this.config.useRealSupabase) {
      const supabase = this.getSupabaseClient();
      const { error } = await supabase.from('servicos_disponiveis').insert(mapFrontendServiceToDb(newService));
      if (error) {
        safeLog('error', 'service.create', 'error', { entityId: id, error });
        throw error;
      }
    }
    
    this.services.push(newService);
    this.save();
    return newService;
  }

  async updateService(id: string, updated: Partial<Service>): Promise<void> {
    if (this.config.useRealSupabase) {
      const supabase = this.getSupabaseClient();
      const { error } = await supabase.from('servicos_disponiveis').update(mapFrontendServiceToDb(updated)).eq('id', id);
      if (error) {
        safeLog('error', 'service.update', 'error', { entityId: id, error });
        throw error;
      }
    }

    this.services = this.services.map(s => s.id === id ? { ...s, ...updated } : s);
    this.save();
  }

  async deleteService(id: string): Promise<void> {
    if (this.config.useRealSupabase) {
      const supabase = this.getSupabaseClient();
      await supabase.from('agendamentos').delete().eq('servico_id', id);
      const { error } = await supabase.from('servicos_disponiveis').delete().eq('id', id);
      if (error) {
        safeLog('error', 'service.delete', 'error', { entityId: id, error });
        throw error;
      }
    }

    this.services = this.services.filter(s => s.id !== id);
    this.save();
  }

  // --- CRUD APPOINTMENTS ---
  async addAppointment(appointment: Omit<Appointment, 'id'>): Promise<Appointment> {
    const id = generateUUID();
    const newAppointment: Appointment = {
      ...appointment,
      id
    };
    
    if (this.config.useRealSupabase) {
      const supabase = this.getSupabaseClient();
      const { error } = await supabase.from('agendamentos').insert(mapFrontendAppointmentToDb(newAppointment));
      if (error) {
        safeLog('error', 'appointment.create', 'error', { entityId: id, error });
        throw error;
      }
    }
    
    this.appointments.push(newAppointment);
    this.save();

    // Trigger Automation
    const customer = this.customers.find(c => c.id === appointment.customerId);
    const vehicle = this.vehicles.find(v => v.id === appointment.vehicleId);
    const service = this.services.find(s => s.id === appointment.serviceId);
    
    if (customer) {
      this.triggerAutomation('novo_agendamento', { customer, vehicle, service, appointment: newAppointment });
    }

    return newAppointment;
  }

  async updateAppointmentStatus(id: string, status: AppointmentStatus, notes?: string): Promise<void> {
    const appointment = this.appointments.find(a => a.id === id);
    if (!appointment) return;

    const oldStatus = appointment.status;
    appointment.status = status;
    if (notes !== undefined) appointment.notes = notes;
    
    if (this.config.useRealSupabase) {
      const supabase = this.getSupabaseClient();
      const { error } = await supabase.from('agendamentos').update(mapFrontendAppointmentToDb(appointment)).eq('id', id);
      if (error) {
        safeLog('error', 'appointment.status.update', 'error', { entityId: id, error });
        throw error;
      }
    }

    this.save();

    // Trigger appointment confirmed automation
    if (status === 'confirmado' && oldStatus !== 'confirmado') {
      const customer = this.customers.find(c => c.id === appointment.customerId);
      const vehicle = this.vehicles.find(v => v.id === appointment.vehicleId);
      const service = this.services.find(s => s.id === appointment.serviceId);

      if (customer) {
        this.triggerAutomation('novo_agendamento', { customer, vehicle, service, appointment });
      }
      await this.syncWithSupabase();
    }

    // Trigger service started automation
    if (status === 'em_andamento' && oldStatus !== 'em_andamento') {
      const customer = this.customers.find(c => c.id === appointment.customerId);
      const vehicle = this.vehicles.find(v => v.id === appointment.vehicleId);
      const service = this.services.find(s => s.id === appointment.serviceId);

      if (customer) {
        this.triggerAutomation('servico_iniciado', { customer, vehicle, service, appointment });
      }
      await this.syncWithSupabase();
    }

    // Finalização é um fato distinto de entrega e pagamento.
    if ((status === 'finalizado' || status === 'entregue') && oldStatus !== 'finalizado' && oldStatus !== 'entregue') {
      const customer = this.customers.find(c => c.id === appointment.customerId);
      const vehicle = this.vehicles.find(v => v.id === appointment.vehicleId);
      const service = this.services.find(s => s.id === appointment.serviceId);

      if (customer && status === 'finalizado') {
        this.triggerAutomation('servico_finalizado', { customer, vehicle, service, appointment });
      }

      // Release referral credits
      await this.checkAndReleaseReferralCredits(appointment.customerId);

      // Refresh dynamic listings locally
      await this.syncWithSupabase();
    }
  }

  async updateAppointment(id: string, updated: Partial<Appointment>): Promise<void> {
    const appointment = this.appointments.find(a => a.id === id);
    if (!appointment) return;

    const oldStatus = appointment.status;
    Object.assign(appointment, updated);

    if (this.config.useRealSupabase) {
      const supabase = this.getSupabaseClient();
      const { error } = await supabase.from('agendamentos').update(mapFrontendAppointmentToDb(appointment)).eq('id', id);
      if (error) {
        safeLog('error', 'appointment.update', 'error', { entityId: id, error });
        throw error;
      }
    }

    this.save();

    if (appointment.status === 'confirmado' && oldStatus !== 'confirmado') {
      const customer = this.customers.find(c => c.id === appointment.customerId);
      const vehicle = this.vehicles.find(v => v.id === appointment.vehicleId);
      const service = this.services.find(s => s.id === appointment.serviceId);

      if (customer) {
        this.triggerAutomation('novo_agendamento', { customer, vehicle, service, appointment });
      }
      await this.syncWithSupabase();
    }

    if (appointment.status === 'em_andamento' && oldStatus !== 'em_andamento') {
      const customer = this.customers.find(c => c.id === appointment.customerId);
      const vehicle = this.vehicles.find(v => v.id === appointment.vehicleId);
      const service = this.services.find(s => s.id === appointment.serviceId);

      if (customer) {
        this.triggerAutomation('servico_iniciado', { customer, vehicle, service, appointment });
      }
      await this.syncWithSupabase();
    }

    if ((appointment.status === 'finalizado' || appointment.status === 'entregue') && oldStatus !== 'finalizado' && oldStatus !== 'entregue') {
      const customer = this.customers.find(c => c.id === appointment.customerId);
      const vehicle = this.vehicles.find(v => v.id === appointment.vehicleId);
      const service = this.services.find(s => s.id === appointment.serviceId);

      if (customer && appointment.status === 'finalizado') {
        this.triggerAutomation('servico_finalizado', { customer, vehicle, service, appointment });
      }

      await this.checkAndReleaseReferralCredits(appointment.customerId);
      await this.syncWithSupabase();
    }
  }

  async deleteAppointment(id: string): Promise<void> {
    if (this.config.useRealSupabase) {
      const supabase = this.getSupabaseClient();
      const { error } = await supabase.from('agendamentos').delete().eq('id', id);
      if (error) {
        safeLog('error', 'appointment.delete', 'error', { entityId: id, error });
        throw error;
      }
    }

    this.appointments = this.appointments.filter(a => a.id !== id);
    this.save();
  }

  async checkAndReleaseReferralCredits(customerId: string): Promise<void> {
    const customer = this.customers.find(c => c.id === customerId);
    if (!customer || !customer.referredBy) return;

    // Check if this is their first finished/concluded appointment
    const finishedAppts = this.appointments.filter(a => a.customerId === customerId && (a.status === 'finalizado' || a.status === 'entregue'));
    if (finishedAppts.length === 1) {
      // Yes, this is their first finished appointment!
      // Let's find the referrer
      const referrer = this.customers.find(c => c.id === customer.referredBy);
      
      const percent = this.config.referralDiscountPercent ?? 10;
      const serviceValue = finishedAppts[0].value;
      const bonusAmount = Number(((serviceValue * percent) / 100).toFixed(2));

      // Update recommended customer (the current customer) with calculations
      customer.referralDiscountAvailable = true;
      customer.referralServiceValue = serviceValue;
      customer.referralBonusPercentUsed = percent;
      customer.referralBonusAmount = bonusAmount;

      await this.updateCustomer(customer.id, {
        referralDiscountAvailable: true,
        referralServiceValue: serviceValue,
        referralBonusPercentUsed: percent,
        referralBonusAmount: bonusAmount
      });

      // Update referrer
      if (referrer) {
        referrer.referralDiscountAvailable = true;
        await this.updateCustomer(referrer.id, {
          referralDiscountAvailable: true
        });
      }

      // Trigger automation logs
      const logMsg = `Indicação Concluída! ${referrer ? referrer.name : 'Indicador'} e ${customer.name} ganharam desconto de indicação. Valor do serviço: R$ ${serviceValue.toFixed(2)}, Bônus Gerado (${percent}%): R$ ${bonusAmount.toFixed(2)}`;
      this.addLog({
        id: generateUUID(),
        triggerEvent: 'Indicação Concluída',
        targetName: referrer ? referrer.name : 'Indicador',
        targetContact: referrer ? referrer.phone : '',
        payload: logMsg,
        status: 'sucesso',
        timestamp: new Date().toISOString()
      });
    }
  }

  // --- CRUD FINANCES (EXPENSES RESTRICTED TO LOCAL STORAGE) ---
  addTransaction(transaction: Omit<CashTransaction, 'id'>): CashTransaction {
    const newTransaction: CashTransaction = {
      ...transaction,
      id: 't_' + Date.now()
    };
    this.finances.unshift(newTransaction);
    this.save();
    return newTransaction;
  }

  deleteTransaction(id: string) {
    this.finances = this.finances.filter(t => t.id !== id);
    this.save();
  }

  // --- CRUD VEHICLE MODELS ---
  async addVehicleModel(model: Omit<VehicleModel, 'id' | 'created_at' | 'updated_at'>): Promise<VehicleModel> {
    const id = generateUUID();
    const newModel: VehicleModel = {
      ...model,
      id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (this.config.useRealSupabase) {
      const supabase = this.getSupabaseClient();
      try {
        const { error } = await supabase.from('vehicle_models').insert({
          id,
          manufacturer: model.manufacturer,
          model: model.model,
          size_category: model.size_category,
          active: model.active
        });
        if (error) {
          safeLog('warn', 'vehicle_model.create', 'error', { entityId: id, error });
        }
      } catch (e: any) {
        safeLog('warn', 'vehicle_model.create', 'error', { entityId: id, error: e });
      }
    }

    this.vehicleModels.push(newModel);
    this.save();
    return newModel;
  }

  async updateVehicleModel(id: string, updated: Partial<VehicleModel>): Promise<void> {
    const updateData = {
      ...updated,
      updated_at: new Date().toISOString()
    };

    if (this.config.useRealSupabase) {
      const supabase = this.getSupabaseClient();
      try {
        const dbPayload: any = {};
        if (updated.manufacturer !== undefined) dbPayload.manufacturer = updated.manufacturer;
        if (updated.model !== undefined) dbPayload.model = updated.model;
        if (updated.size_category !== undefined) dbPayload.size_category = updated.size_category;
        if (updated.active !== undefined) dbPayload.active = updated.active;

        const { error } = await supabase.from('vehicle_models').update(dbPayload).eq('id', id);
        if (error) {
          safeLog('warn', 'vehicle_model.update', 'error', { entityId: id, error });
        }
      } catch (e: any) {
        safeLog('warn', 'vehicle_model.update', 'error', { entityId: id, error: e });
      }
    }

    this.vehicleModels = this.vehicleModels.map(m => m.id === id ? { ...m, ...updateData } : m);
    this.save();
  }

  async deleteVehicleModel(id: string): Promise<void> {
    if (this.config.useRealSupabase) {
      const supabase = this.getSupabaseClient();
      try {
        const { error } = await supabase.from('vehicle_models').delete().eq('id', id);
        if (error) {
          safeLog('warn', 'vehicle_model.delete', 'error', { entityId: id, error });
        }
      } catch (e: any) {
        safeLog('warn', 'vehicle_model.delete', 'error', { entityId: id, error: e });
      }
    }

    this.vehicleModels = this.vehicleModels.filter(m => m.id !== id);
    this.save();
  }

  // --- UPDATE CONFIG ---
  async updateConfig(updated: Partial<SystemConfig>) {
    this.config = { ...this.config, ...toPublicSystemConfig(updated) };
    this.save();
    
    // Save to Supabase immediately if active
    if (this.config.useRealSupabase) {
      await this.saveConfigToSupabase();
      this.syncWithSupabase();
    }
  }

  // --- MANAGE AUTOMATION TRIGGERS ---
  async updateAutomationTrigger(id: string, updated: Partial<AutomationTrigger>): Promise<AutomationTrigger[]> {
    const updatedItem = this.automations.find(a => a.id === id);
    if (!updatedItem) {
      throw new Error(`Automação com ID ${id} não encontrada.`);
    }

    if (!this.automationConfigUpdatedAt && this.config.useRealSupabase) {
      await this.syncWithSupabase();
    }
    if (!this.automationConfigUpdatedAt) {
      throw new Error('Versão da configuração indisponível; sincronize o painel antes de salvar.');
    }

    const supabase = this.getSupabaseClient();
    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      throw new Error('Sessão administrativa ausente ou expirada.');
    }

    const response = await fetch('/api/automations/templates', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        id,
        patch: updated,
        expectedUpdatedAt: this.automationConfigUpdatedAt
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      if (
        response.status === 409
        && errorData
        && Array.isArray(errorData.automations)
        && typeof errorData.updatedAt === 'string'
      ) {
        this.automations = errorData.automations;
        this.automationConfigUpdatedAt = errorData.updatedAt;
        if (this.onSyncCallback) this.onSyncCallback();
      }
      throw new Error(`Falha ao salvar templates: ${response.status} ${response.statusText}`);
    }

    const data = await response.json().catch(() => null);
    if (!data || !Array.isArray(data.automations)) {
      safeLog('error', 'automation.trigger.update.api', 'error', {
        entityId: id,
        reason: 'invalid_response'
      });
      throw new Error('Resposta do servidor inválida: campo automations ausente ou malformado.');
    }

    // Atualiza o estado da RAM do frontend SOMENTE a partir da resposta confirmada e validada do backend
    this.automations = data.automations;
    this.automationConfigUpdatedAt = typeof data.updatedAt === 'string'
      ? data.updatedAt
      : this.automationConfigUpdatedAt;
    if (this.onSyncCallback) {
      this.onSyncCallback();
    }
    return this.automations;
  }

  // --- MANUALLY SIMULATE AUTOMATION TRIGGER ---
  testTrigger(eventId: string) {
    const automation = this.automations.find(a => a.id === eventId);
    if (!automation) return;
    
    const sampleCustomer = this.customers[0] || DEFAULT_CUSTOMERS[0];
    const sampleVehicle = this.vehicles.find(v => v.customerId === sampleCustomer.id) || DEFAULT_VEHICLES[0];
    const sampleService = this.services[0] || DEFAULT_SERVICES[0];
    const sampleAppointment: Appointment = {
      id: 'sample_appt',
      customerId: sampleCustomer.id,
      vehicleId: sampleVehicle.id,
      serviceId: sampleService.id,
      dateTime: new Date().toISOString().slice(0, 16),
      status: 'confirmado',
      value: sampleService.basePrice,
      employeeId: 'Matheus',
      notes: 'Agendamento de teste simulador.'
    };

    this.triggerAutomation(automation.event, {
      customer: sampleCustomer,
      vehicle: sampleVehicle,
      service: sampleService,
      appointment: sampleAppointment
    });
  }

  // --- CHECK AND TRIGGER APPOINTMENT REMINDERS ---
  async checkAndTriggerReminders(): Promise<{ checked: number; sent: number; logs: string[] }> {
    const logs: string[] = [];
    let checked = 0;
    let sent = 0;

    const now = new Date();
    // 60 minutes ahead
    const limit = new Date(now.getTime() + 60 * 60 * 1000);

    // Active lembrete automation
    const automation = this.automations.find(a => a.event === 'lembrete_agendamento');
    const isAutomationActive = automation ? automation.isActive : false;

    logs.push(`[Reminder Engine] Iniciando verificação às ${now.toLocaleTimeString('pt-BR')}. Automação ativa: ${isAutomationActive ? 'Sim' : 'Não'}`);

    if (!isAutomationActive) {
      return { checked, sent, logs };
    }

    // Filter appointments
    const eligibleAppts = this.appointments.filter(appt => {
      if (appt.status === 'cancelado') return false;
      if (appt.reminderSent) return false;

      try {
        const apptDate = new Date(appt.dateTime);
        // Ensure it is a valid date
        if (isNaN(apptDate.getTime())) return false;

        // Check if between now and 60 minutes ahead
        return apptDate >= now && apptDate <= limit;
      } catch (e) {
        return false;
      }
    });

    checked = eligibleAppts.length;
    logs.push(`[Reminder Engine] Encontrados ${checked} agendamentos pendentes nas próximas 1 hora.`);

    for (const appt of eligibleAppts) {
      const customer = this.customers.find(c => c.id === appt.customerId);
      if (!customer) {
        logs.push(`[Reminder Engine] Cliente não encontrado para o agendamento ${appt.id}.`);
        continue;
      }

      const vehicle = this.vehicles.find(v => v.id === appt.vehicleId);
      const service = this.services.find(s => s.id === appt.serviceId);

      // Trigger the automation
      this.triggerAutomation('lembrete_agendamento', {
        customer,
        vehicle,
        service,
        appointment: appt
      });

      // Mark as sent
      appt.reminderSent = true;
      sent++;
      logs.push(`[Reminder Engine] Lembrete enfileirado. ClienteId=${customer.id}; AgendamentoId=${appt.id}.`);
    }

    if (sent > 0) {
      this.save();
      // If we are using Supabase, sync back
      if (this.config.useRealSupabase) {
        try {
          const supabase = this.getSupabaseClient();
          for (const appt of eligibleAppts) {
            await supabase.from('agendamentos').update(mapFrontendAppointmentToDb(appt)).eq('id', appt.id);
          }
          await this.syncWithSupabase();
        } catch (e: any) {
          safeLog('error', 'reminder.status.persist', 'error', { error: e });
          logs.push('[Reminder Engine] Falha interna ao sincronizar status. Consulte o correlation ID do log.');
        }
      }

      // Notify callback to sync views
      if (this.onSyncCallback) {
        this.onSyncCallback();
      }
    }

    return { checked, sent, logs };
  }

  // --- CLEAR ALL DATA FOR TESTING ---
  async resetToDefaults() {
    this.customers = DEFAULT_CUSTOMERS;
    this.vehicles = DEFAULT_VEHICLES;
    this.services = DEFAULT_SERVICES;
    this.appointments = DEFAULT_APPOINTMENTS;
    this.history = [];
    this.finances = [];
    this.config = DEFAULT_CONFIG;
    this.automations = DEFAULT_AUTOMATIONS;
    this.logs = [];
    this.save();
    
    if (this.config.useRealSupabase) {
      await this.saveConfigToSupabase();
      this.syncWithSupabase();
    }
  }

  // --- FORCE RESTORE DEFAULT AUTOMATIONS ---
  async restoreDefaultAutomations() {
    safeLog('info', 'automation.restore_defaults', 'started');
    if (this.config.useRealSupabase) {
      for (const defaultAutomation of DEFAULT_AUTOMATIONS) {
        await this.updateAutomationTrigger(defaultAutomation.id, {
          isActive: defaultAutomation.isActive,
          template: defaultAutomation.template,
          inactiveDays: defaultAutomation.inactiveDays,
          minServices: defaultAutomation.minServices
        });
      }
    } else {
      this.automations = JSON.parse(JSON.stringify(DEFAULT_AUTOMATIONS));
      this.save();
    }
    if (this.onSyncCallback) {
      this.onSyncCallback();
    }
  }

  // --- AUTOMATION QUEUING ENGINE (SaaS Core) ---
  async queueAutomation(
    event: string,
    context: {
      customer: Customer;
      vehicle?: Vehicle;
      service?: Service;
      appointment?: Appointment;
    }
  ): Promise<AutomationExecution | null> {
    const trigger = this.automations.find(a => a.event === event);
    if (!trigger || !trigger.isActive) {
      safeLog('info', 'automation.queue', 'ignored', {
        eventType: event,
        reason: 'missing_or_inactive'
      });
      return null;
    }

    // [AUTOMATION TRACE 1] Template carregado
    safeLog('info', 'automation.trace.1.template', 'success', {
      eventType: event,
      operation: 'template_loaded'
    });

    // Render message using the unified rendering engine
    const normalized = renderAndNormalizeMessage(trigger.template, context);
    const phone = context.customer.phone || context.customer.whatsapp || '';
    if (phone.replace(/\D/g, '').length < 8 || !normalized.trim()) {
      safeLog('info', 'automation.queue', 'ignored', {
        eventType: event,
        reason: !normalized.trim() ? 'empty_message' : 'invalid_phone'
      });
      return null;
    }

    // Build the execution record
    const id = generateUUID();
    const nowStr = new Date().toISOString();
    
    // Check if outside operational window
    let targetTime = nowStr;
    const startHour = this.config.automationStartHour || '08:00';
    const endHour = this.config.automationEndHour || '20:00';
    
    if (!isWithinOperationalWindow(startHour, endHour)) {
      targetTime = getNextStartTime(startHour, endHour);
      safeLog('info', 'automation.queue', 'ignored', {
        eventType: event,
        reason: 'outside_operational_window'
      });
    }

    const dedupKeyMap: Record<string, string | undefined> = {
      novo_cliente: context.customer?.id ? `novo_cliente:${context.customer.id}` : undefined,
      novo_agendamento: context.appointment?.id ? `novo_agendamento:${context.appointment.id}` : undefined,
      servico_iniciado: context.appointment?.id ? `servico_iniciado:${context.appointment.id}` : undefined,
      servico_finalizado: context.appointment?.id ? `servico_finalizado:${context.appointment.id}` : undefined,
      pagamento_recebido: context.appointment?.id ? `pagamento_recebido:${context.appointment.id}` : undefined,
      lembrete_agendamento: context.appointment?.id ? `lembrete_agendamento:${context.appointment.id}` : undefined,
      aniversario: context.customer?.id ? `aniversario:${context.customer.id}:${new Date().getFullYear()}` : undefined,
    };
    const deduplicationKey = dedupKeyMap[event];

    if (
      deduplicationKey &&
      this.executions.some(execution => execution.deduplication_key === deduplicationKey)
    ) {
      safeLog('info', 'automation.queue', 'ignored', {
        eventType: event,
        reason: 'duplicate'
      });
      return null;
    }

    const execution: AutomationExecution = {
      id,
      empresa_id: 'c0000000-0000-0000-0000-000000000000',
      automacao: event,
      appointment_id: context.appointment?.id,
      customer_id: context.customer.id,
      telefone: phone,
      mensagem: normalized,
      status: 'pendente',
      tentativas: 0,
      resposta_api: '',
      deduplication_key: deduplicationKey,
      data_execucao: targetTime,
      created_at: nowStr,
      updated_at: nowStr
    };

    // [AUTOMATION TRACE 2] Mensagem renderizada
    safeLog('info', 'automation.trace.2.rendered', 'success', {
      entityId: execution.id,
      eventType: event,
      operation: 'message_rendered'
    });

    if (this.config.useRealSupabase) {
      try {
        const supabase = this.getSupabaseClient();
        const { error } = await supabase.from('automacoes_execucoes').insert({
          id: execution.id,
          empresa_id: execution.empresa_id,
          automacao: execution.automacao,
          appointment_id: execution.appointment_id || null,
          customer_id: execution.customer_id,
          telefone: execution.telefone,
          mensagem: execution.mensagem,
          status: execution.status,
          tentativas: execution.tentativas,
          resposta_api: execution.resposta_api,
          deduplication_key: execution.deduplication_key || null,
          data_execucao: execution.data_execucao,
          created_at: execution.created_at,
          updated_at: execution.updated_at
        });
        if (error) {
          safeLog(
            error.code === '23505' ? 'info' : 'error',
            'automation.queue.persist',
            error.code === '23505' ? 'ignored' : 'error',
            {
            entityId: execution.id,
            error
            }
          );
          return null;
        } else {
          safeLog('info', 'automation.queue.persist', 'success', {
            entityId: execution.id,
            eventType: execution.automacao
          });
        }
      } catch (err: any) {
        safeLog('error', 'automation.queue.persist', 'error', {
          entityId: execution.id,
          error: err
        });
        return null;
      }
    }

    this.executions.push(execution);
    this.save();

    return execution;
  }

  // --- SQL SCHEMA GENERATION ---
  getPostgresSchemaSql(): string {
    return `-- =========================================================================
-- SCRIPT DE CRIAÇÃO DO BANCO DE DADOS POSTGRESQL (SUPABASE / CLOUD SQL)
-- Empresa: Senhora Limpeza Estética Automotiva
-- =========================================================================

-- 1. Tabela de Clientes
CREATE TABLE IF NOT EXISTS public.clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    whatsapp VARCHAR(50),
    email VARCHAR(255),
    birth_date DATE,
    address TEXT,
    neighborhood VARCHAR(255),
    city VARCHAR(255),
    state VARCHAR(50),
    cpf VARCHAR(20),
    referral_code VARCHAR(50) UNIQUE,
    referred_by VARCHAR(50),
    credits_balance DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabela de Veículos
CREATE TABLE IF NOT EXISTS public.veiculos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
    brand VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    plate VARCHAR(20) UNIQUE NOT NULL,
    color VARCHAR(50),
    year VARCHAR(10),
    mileage VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabela de Serviços Disponíveis
CREATE TABLE IF NOT EXISTS public.servicos_disponiveis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    base_price DECIMAL(10,2) NOT NULL,
    estimated_time INTEGER NOT NULL, -- em minutos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Tabela de Agendamentos
CREATE TABLE IF NOT EXISTS public.agendamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES public.veiculos(id) ON DELETE SET NULL,
    service_id UUID REFERENCES public.servicos_disponiveis(id) ON DELETE SET NULL,
    date_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'pendente'::character varying NOT NULL,
    value DECIMAL(10,2) NOT NULL,
    employee_id VARCHAR(100),
    notes TEXT,
    reminder_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Tabela Exclusiva para Execuções das Automações (SaaS Core)
CREATE TABLE IF NOT EXISTS public.automacoes_execucoes (
    id VARCHAR(100) PRIMARY KEY,
    empresa_id UUID DEFAULT 'c0000000-0000-0000-0000-000000000000'::uuid NOT NULL,
    automacao VARCHAR(100) NOT NULL,
    appointment_id UUID REFERENCES public.agendamentos(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
    telefone VARCHAR(50) NOT NULL,
    mensagem TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pendente'::character varying NOT NULL,
    tentativas INTEGER DEFAULT 0 NOT NULL,
    resposta_api TEXT,
    data_execucao TIMESTAMP WITH TIME ZONE NOT NULL,
    data_proxima_tentativa TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Tabela de Usuários (Vinculada ao Supabase Auth)
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    telefone VARCHAR(50),
    status VARCHAR(50) DEFAULT 'ativo' NOT NULL,
    perfil VARCHAR(50) DEFAULT 'tecnico' NOT NULL,
    foto_url TEXT,
    permissions JSONB DEFAULT '{}'::jsonb NOT NULL,
    commissions JSONB DEFAULT '[]'::jsonb NOT NULL,
    default_commission_percent DECIMAL(5,2) DEFAULT 10.00 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices de Performance recomendados para SaaS
CREATE INDEX IF NOT EXISTS idx_execucoes_status ON public.automacoes_execucoes(status);
CREATE INDEX IF NOT EXISTS idx_execucoes_data_execucao ON public.automacoes_execucoes(data_execucao);
CREATE INDEX IF NOT EXISTS idx_execucoes_customer ON public.automacoes_execucoes(customer_id);
CREATE INDEX IF NOT EXISTS idx_execucoes_appointment ON public.automacoes_execucoes(appointment_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_date_time ON public.agendamentos(date_time);
CREATE INDEX IF NOT EXISTS idx_usuarios_auth_user_id ON public.usuarios(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON public.usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_status ON public.usuarios(status);

-- POLÍTICAS DE SEGURANÇA (RLS) PARA A TABELA USUÁRIOS
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios NO FORCE ROW LEVEL SECURITY;

-- Remove políticas anteriores, inclusive as que consultavam public.usuarios
-- diretamente e causavam recursão infinita no RLS.
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'usuarios'
    LOOP
        EXECUTE format(
            'DROP POLICY IF EXISTS %I ON public.usuarios',
            policy_record.policyname
        );
    END LOOP;
END $$;

-- A função é executada pelo proprietário e não reaplica o RLS da tabela.
-- Ela não recebe IDs externos: sempre avalia exclusivamente auth.uid().
CREATE OR REPLACE FUNCTION public.is_active_usuario_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.usuarios AS u
        WHERE u.auth_user_id = (SELECT auth.uid())
          AND u.perfil = 'admin'
          AND u.status = 'ativo'
    );
$$;

REVOKE ALL ON FUNCTION public.is_active_usuario_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_usuario_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_active_usuario_admin() TO authenticated;

CREATE POLICY "usuarios_select_own_or_admin"
ON public.usuarios
FOR SELECT
TO authenticated
USING (
    auth_user_id = (SELECT auth.uid())
    OR (SELECT public.is_active_usuario_admin())
);

CREATE POLICY "usuarios_insert_admin"
ON public.usuarios
FOR INSERT
TO authenticated
WITH CHECK ((SELECT public.is_active_usuario_admin()));

CREATE POLICY "usuarios_update_admin"
ON public.usuarios
FOR UPDATE
TO authenticated
USING ((SELECT public.is_active_usuario_admin()))
WITH CHECK ((SELECT public.is_active_usuario_admin()));

CREATE POLICY "usuarios_delete_admin"
ON public.usuarios
FOR DELETE
TO authenticated
USING ((SELECT public.is_active_usuario_admin()));
`;
  }

  // --- USER MANAGEMENT CRUD ---
  getUsers(): User[] {
    return this.users;
  }

  async refreshUsersFromSupabase(): Promise<User[]> {
    if (!this.config.useRealSupabase) {
      throw new Error('O cadastro de usuários exige uma conexão ativa com o Supabase.');
    }

    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase
      .from('usuarios')
      .select(`
        id,
        auth_user_id,
        nome,
        email,
        telefone,
        status,
        perfil,
        foto_url,
        permissions,
        commissions,
        default_commission_percent,
        created_at,
        updated_at
      `)
      .order('nome', { ascending: true });

    if (error) {
      throw new Error(`Não foi possível atualizar a lista real de usuários: ${error.message}`);
    }

    this.users = (data || []).map(mapDbUserToFrontend);
    this.save();
    this.onSyncCallback?.();
    return this.users;
  }

  async addUser(userData: CreateUserInput): Promise<User> {
    if (!this.config.useRealSupabase) {
      throw new Error('O cadastro de usuários exige uma conexão ativa com o Supabase.');
    }

    if (!userData.password || userData.password.length < 6) {
      throw new Error('A senha deve conter no mínimo 6 caracteres.');
    }

    const supabase = this.getSupabaseClient();
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const session = sessionData.session;

    if (sessionError || !session?.access_token) {
      throw new Error('Sua sessão administrativa expirou. Entre novamente antes de cadastrar o usuário.');
    }

    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: {
        nome: userData.name.trim(),
        email: userData.email.trim().toLowerCase(),
        password: userData.password,
        telefone: userData.phone || '',
        foto_url: userData.photoUrl || '',
        perfil: userData.role,
        status: userData.status,
        permissions: userData.permissions,
        commissions: userData.commissions,
        default_commission_percent: userData.defaultCommissionPercent,
      },
    });

    if (error) {
      let backendMessage = data?.error || error.message || 'Falha ao criar o usuário.';
      const response = (error as any).context;

      if (response && typeof response.clone === 'function') {
        try {
          const payload = await response.clone().json();
          backendMessage = payload?.error || backendMessage;
        } catch {
          // Mantém a mensagem original quando a resposta não contém JSON.
        }
      }

      throw new Error(backendMessage);
    }

    const createdAuthUserId = data?.user?.auth_user_id;
    if (!createdAuthUserId) {
      throw new Error('A função concluiu sem retornar o vínculo auth_user_id criado.');
    }

    await this.refreshUsersFromSupabase();

    const createdUser = this.users.find(user => user.authUserId === createdAuthUserId);
    if (!createdUser) {
      throw new Error(
        'O usuário foi criado, mas seu perfil não apareceu na leitura de public.usuarios. Não repita o cadastro; atualize a tela e verifique as políticas RLS.'
      );
    }

    return createdUser;
  }

  async updateUser(id: string, updated: Partial<User>): Promise<void> {
    const user = this.users.find(u => u.id === id);
    if (!user) return;

    const { password: _discardedPassword, ...safeUpdated } = updated as Partial<User> & { password?: string };
    Object.assign(user, safeUpdated, { updatedAt: new Date().toISOString() });
    delete (user as User & { password?: string }).password;

    if (this.config.useRealSupabase) {
      try {
        const supabase = this.getSupabaseClient();
        const payload: any = {
          nome: user.name,
          email: user.email,
          telefone: user.phone || '',
          status: user.status || 'ativo',
          perfil: user.role || 'tecnico',
          foto_url: user.photoUrl || '',
          permissions: user.permissions,
          commissions: user.commissions,
          default_commission_percent: user.defaultCommissionPercent ?? 10,
          updated_at: user.updatedAt
        };
        if (user.authUserId) {
          payload.auth_user_id = user.authUserId;
        }

        const { error } = await supabase.from('usuarios').update(payload).eq('id', id);

        if (error) {
          safeLog('error', 'user.update', 'error', { entityId: id, error });
        } else {
          safeLog('info', 'user.update', 'success', { entityId: id });
        }
      } catch (err: any) {
        safeLog('warn', 'user.update', 'error', { entityId: id, error: err });
      }
    }

    this.save();
    this.recalculateCommissions();
  }

  async deleteUser(id: string): Promise<void> {
    if (this.config.useRealSupabase) {
      try {
        const supabase = this.getSupabaseClient();
        await supabase.from('usuarios').delete().eq('id', id);
      } catch (err: any) {
        safeLog('warn', 'user.delete', 'error', { entityId: id, error: err });
      }
    }

    this.users = this.users.filter(u => u.id !== id);
    this.save();
  }

  // --- COMMISSION MANAGEMENT ---
  calculateCommissionForAppointment(appointment: Appointment): CommissionRecord[] {
    const records: CommissionRecord[] = [];

    // Rule: Commission only generated if appointment status is completed/delivered
    if (appointment.status !== 'finalizado' && appointment.status !== 'entregue') {
      return records;
    }

    // Rule: Commission ONLY if there is a responsible assigned user
    const empId = (appointment.employeeId || '').trim();
    if (!empId) {
      return records;
    }

    const assignedUser = this.users.find(u => 
      (u.id === empId || u.name.toLowerCase() === empId.toLowerCase()) && u.status === 'ativo'
    );

    if (!assignedUser) {
      return records; // No active assigned user found -> Commission = 0
    }

    const targetServiceIds = (appointment.serviceIds && appointment.serviceIds.length > 0)
      ? appointment.serviceIds
      : [appointment.serviceId];

    const customer = this.customers.find(c => c.id === appointment.customerId);
    const customerName = customer ? customer.name : 'Cliente Estética';
    const apptDate = appointment.dateTime ? appointment.dateTime.split('T')[0] : getCurrentDateStr();

    for (const sId of targetServiceIds) {
      const serviceObj = this.services.find(s => s.id === sId);
      if (!serviceObj) continue;

      const serviceValue = serviceObj.basePrice || (appointment.value / (targetServiceIds.length || 1));

      // Check if user has explicit service commission percentage rule
      const customRule = assignedUser.commissions?.find(c => c.serviceId === sId);
      const commissionPercent = customRule !== undefined ? customRule.percentage : (assignedUser.defaultCommissionPercent ?? 0);

      const commissionValue = Number(((serviceValue * commissionPercent) / 100).toFixed(2));

      records.push({
        id: `comm_${appointment.id}_${sId}`,
        userId: assignedUser.id,
        userName: assignedUser.name,
        appointmentId: appointment.id,
        customerName: customerName,
        serviceName: serviceObj.name,
        serviceValue: Number(serviceValue.toFixed(2)),
        commissionPercent,
        commissionValue,
        date: apptDate,
        status: 'pendente',
        createdAt: new Date().toISOString()
      });
    }

    return records;
  }

  recalculateCommissions() {
    const completedAppts = this.appointments.filter(a => a.status === 'finalizado' || a.status === 'entregue');
    const paidCommissions = this.commissions.filter(c => c.status === 'paga');
    const updatedList: CommissionRecord[] = [...paidCommissions];

    for (const appt of completedAppts) {
      const generated = this.calculateCommissionForAppointment(appt);
      for (const rec of generated) {
        const isPaid = paidCommissions.some(p => p.id === rec.id || (p.appointmentId === rec.appointmentId && p.serviceName === rec.serviceName));
        if (!isPaid) {
          const idx = updatedList.findIndex(n => n.id === rec.id || (n.appointmentId === rec.appointmentId && n.serviceName === rec.serviceName));
          if (idx >= 0) {
            updatedList[idx] = { ...rec, status: updatedList[idx].status, paidAt: updatedList[idx].paidAt, notes: updatedList[idx].notes };
          } else {
            updatedList.push(rec);
          }
        }
      }
    }

    this.commissions = updatedList;
    this.save();
  }

  markCommissionAsPaid(commissionId: string, notes?: string): void {
    const comm = this.commissions.find(c => c.id === commissionId);
    if (comm) {
      comm.status = 'paga';
      comm.paidAt = getCurrentDateStr();
      if (notes) comm.notes = notes;
      this.save();
    }
  }

  markBulkCommissionsAsPaid(commissionIds: string[], notes?: string): void {
    const today = getCurrentDateStr();
    for (const id of commissionIds) {
      const comm = this.commissions.find(c => c.id === id);
      if (comm) {
        comm.status = 'paga';
        comm.paidAt = today;
        if (notes) comm.notes = notes;
      }
    }
    this.save();
  }
}

export const dbInstance = new LocalDatabase();

export function cleanAndNormalizeMessageString(msg: string): string {
  if (!msg) return "";

  // 1. Convert carriage return + line feed and independent carriage returns to clean line feeds
  let normalized = msg.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // 2. Crucial: Replace literal '\n', '\\n', and '/n' or '//n' text patterns with actual newlines!
  normalized = normalized.replace(/\\+n/gi, "\n");
  normalized = normalized.replace(/\/+n/gi, "\n");

  // 3. Remove control / invisible / non-printable characters, except standard whitespace (\n, \r, \t)
  // ASCII range 0-31 control characters (excluding tab \x09, LF \x0a, CR \x0d) and 127-159 (DEL and C1 controls)
  normalized = normalized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "");

  // 4. Remove invisible unicode characters
  normalized = normalized.replace(/[\u200B-\u200D\u200E\u200F\uFEFF]/g, "");

  return normalized;
}

export function renderAndNormalizeMessage(
  template: string,
  context: { customer: Customer; vehicle?: Vehicle; service?: Service; appointment?: Appointment }
): string {
  let text = template || '';
  
  if (context.customer) {
    text = text.replace(/{nome}/g, context.customer.name || '');
    text = text.replace(/{whatsapp}/g, context.customer.phone || context.customer.whatsapp || '');
  } else {
    text = text.replace(/{nome}/g, '').replace(/{whatsapp}/g, '');
  }

  if (context.vehicle) {
    text = text.replace(/{veiculo}/g, `${context.vehicle.brand} ${context.vehicle.model} (${context.vehicle.plate})`);
  } else {
    text = text.replace(/{veiculo}/g, '');
  }

  let resolvedServiceName = '';
  if (context.appointment && context.appointment.serviceIds && context.appointment.serviceIds.length > 0) {
    const list = context.appointment.serviceIds
      .map(id => dbInstance.services.find(s => s.id === id)?.name)
      .filter(Boolean);
    if (list.length > 0) {
      resolvedServiceName = list.join(', ');
    } else if (context.service) {
      resolvedServiceName = context.service.name || '';
    }
  } else if (context.service) {
    resolvedServiceName = context.service.name || '';
  }

  text = text.replace(/{servico}/g, resolvedServiceName);

  if (context.appointment) {
    const formattedDate = new Date(context.appointment.dateTime).toLocaleString('pt-BR');
    text = text.replace(/{data_hora}/g, formattedDate);
    text = text.replace(/{valor}/g, typeof context.appointment.value === 'number' ? context.appointment.value.toFixed(2) : String(context.appointment.value));
  } else {
    text = text.replace(/{data_hora}/g, '').replace(/{valor}/g, '');
  }

  // Now, normalize using the unified string cleanup function
  const finalMessage = cleanAndNormalizeMessageString(text);

  return finalMessage;
}

export function renderTemplateText(
  template: string,
  context: { customer: Customer; vehicle?: Vehicle; service?: Service; appointment?: Appointment }
): string {
  return renderAndNormalizeMessage(template, context);
}

export function normalizeFormattedMessage(msg: string): string {
  return cleanAndNormalizeMessageString(msg);
}

export function validatePayload(payload: any): { valid: boolean; error?: string } {
  try {
    const jsonStr = JSON.stringify(payload);
    
    // Check for raw, unescaped control characters in JSON string (ASCII 0 to 31)
    const controlCharRegex = /[\x00-\x1F]/;
    const match = jsonStr.match(controlCharRegex);
    if (match) {
      const charCode = match[0].charCodeAt(0);
      return {
        valid: false,
        error: `O JSON serializado possui caracteres de controle não escapados na faixa ASCII 0-31 (código: ${charCode})`
      };
    }
    
    // Verify that parsing the string is successful
    JSON.parse(jsonStr);
    return { valid: true };
  } catch (err: any) {
    return {
      valid: false,
      error: err.message || 'Erro de análise estrutural do JSON'
    };
  }
}
