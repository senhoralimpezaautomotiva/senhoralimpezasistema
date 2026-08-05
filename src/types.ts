/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Customer {
  id: string;
  name: string;
  phone: string;
  whatsapp: string;
  email: string;
  cpf?: string;
  birthDate: string;
  address: string;
  neighborhood: string;
  city: string;
  notes: string;
  clientSince: string;
  lastServiceDate: string | null;
  status: 'ativo' | 'inativo';
  origin: string; // 'Instagram', 'Indicação', 'Google', 'WhatsApp', 'Outros'
  
  // Referral Program Fields
  referralCode?: string;
  referredBy?: string; // id or referral code of the person who referred
  referralDiscountAvailable?: boolean; // Has a discount from referring someone who did a service
  referralDiscountUsed?: boolean;
  referralCreatedAt?: string;
  referralServiceValue?: number;
  referralBonusPercentUsed?: number;
  referralBonusAmount?: number;
}

export interface Vehicle {
  id: string;
  customerId: string;
  brand: string;
  model: string;
  version: string;
  year: string;
  plate: string;
  color: string;
  mileage: string;
  porte?: 'Pequeno' | 'Médio' | 'Grande';
  isPrincipal?: boolean;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  estimatedTime: number; // in minutes
  pricingType?: 'unico' | 'porte';
  priceP?: number;
  priceM?: number;
  priceG?: number;
  isFeatured?: boolean;
  offerText?: string;
  displayOrder?: number;
  portalVisibility?: 'lista' | 'sugestao' | 'oculto';
}

export type AppointmentStatus = 'agendado' | 'confirmado' | 'cliente_chegou' | 'em_andamento' | 'aguardando_aprovacao' | 'aguardando_peca' | 'finalizado' | 'entregue' | 'cancelado';

export interface Appointment {
  id: string;
  customerId: string;
  vehicleId: string;
  serviceId: string; // Main service
  serviceIds?: string[]; // Multiple services list
  dateTime: string; // YYYY-MM-DDTHH:MM
  status: AppointmentStatus;
  value: number; // Final price
  discount?: number;
  addition?: number;
  durationTotal?: number; // Estimated minutes
  employeeId: string;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
  startedAt?: string;
  concludedAt?: string;
  reminderSent?: boolean;
  changelog?: Array<{
    date: string;
    user: string;
    action: string;
  }>;
}

export interface HistoryRecord {
  id: string;
  appointmentId: string | null;
  customerId: string;
  customerName: string;
  vehicleId: string;
  vehicleDetails: string; // "Marca Modelo [Placa]"
  serviceId: string;
  serviceName: string;
  value: number;
  date: string; // YYYY-MM-DD
  notes: string;
  timeSpent: number; // minutes
  employeeResponsible: string;
}

export type TransactionType = 'receita' | 'despesa';

export interface CashTransaction {
  id: string;
  type: TransactionType;
  category: string; // 'Serviço', 'Produtos', 'Aluguel', 'Salário', 'Água/Luz', 'Marketing', 'Outros'
  amount: number;
  date: string; // YYYY-MM-DD
  description: string;
  status: 'pago' | 'pendente';
}

export interface AutomationTrigger {
  id: string;
  name: string;
  description: string;
  event: 'novo_cliente' | 'novo_agendamento' | 'servico_iniciado' | 'servico_finalizado' | 'cliente_inativo' | 'aniversario' | 'pagamento_recebido' | 'lembrete_agendamento' | 'orcamento_enviado' | 'orcamento_followup_7d' | 'orcamento_followup_14d';
  isActive: boolean;
  template: string;
  inactiveDays?: number;
  minServices?: number;
}

export type BudgetStatus = 'rascunho' | 'enviado' | 'aceito' | 'recusado' | 'cancelado' | 'vencido' | 'convertido';

export interface BudgetItem {
  id: string;
  budgetId: string;
  serviceId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Budget {
  id: string;
  number?: number;
  customerId: string;
  vehicleId?: string;
  status: BudgetStatus;
  subtotal: number;
  discount: number;
  total: number;
  validUntil: string;
  notes: string;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
  items: BudgetItem[];
}

export type BudgetDraft = Omit<Budget, 'id' | 'number' | 'status' | 'sentAt' | 'createdAt' | 'updatedAt'> & {
  id?: string;
};

export interface PublicSystemConfig {
  companyName: string;
  phone: string;
  email: string;
  cnpj: string;
  address: string;
  hoursOfOperation: string;
  logoUrl: string;
  primaryColor: string; // hex
  accentColor: string; // hex
  supabaseUrl: string;
  supabaseAnonKey: string;
  useRealSupabase: boolean;
  
  // Referral Program Config
  referralActive?: boolean;
  referralDiscountPercent?: number; // e.g. 10 for 10%
  loyaltyReferralTarget?: number;
  portalCatalogSource?: 'system' | 'whatsapp';
  whatsappCatalogUrl?: string;

  // Automation Operational Window
  automationStartHour?: string; // e.g., "08:00"
  automationEndHour?: string;   // e.g., "20:00"
  automation24Hours?: boolean;

  // Agenda settings
  agenda?: AgendaConfig;
  theme?: 'light' | 'dark';
}

// Compatibility alias while the application migrates to the explicit public name.
// This type must never receive backend-only integration credentials.
export type SystemConfig = PublicSystemConfig;

export interface AgendaDayConfig {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  dayName: string; // "Domingo", "Segunda-feira", etc.
  isActive: boolean;
  openTime: string; // "08:00"
  closeTime: string; // "18:00"
  hasLunchBreak: boolean;
  lunchStart: string; // "12:00"
  lunchEnd: string; // "13:00"
}

export interface AgendaTimeSlot {
  id: string;
  time: string; // "08:00"
  maxCapacity: number; // capacity per slot
}

export interface AgendaConfig {
  days: AgendaDayConfig[];
  timeSlots: AgendaTimeSlot[];
  minAdvanceHours: number; // minimum advance hours required to book (e.g., 2)
  maxAdvanceDays: number; // maximum advance days allowed to book (e.g., 30)
  autoBlockDuration: boolean; // whether to block the estimated duration of services
}

export interface AutomationExecution {
  id: string;
  empresa_id: string;
  automacao: string;
  appointment_id?: string;
  budget_id?: string;
  customer_id: string;
  telefone: string;
  mensagem: string;
  status: 'pendente' | 'processando' | 'sucesso' | 'erro_definitivo' | 'cancelada';
  tentativas: number;
  resposta_api?: string;
  deduplication_key?: string;
  data_execucao: string; // ISO format
  data_proxima_tentativa?: string; // ISO format
  claimed_at?: string; // ISO format; token do claim nunca é exposto ao painel
  claim_expires_at?: string; // ISO format
  created_at: string;
  updated_at: string;
}

export interface AutomationLog {
  id: string;
  triggerEvent: string;
  targetName: string;
  targetContact: string;
  payload: string;
  status: 'sucesso' | 'erro' | 'simulado';
  timestamp: string;
}

export interface VehicleModel {
  id: string;
  manufacturer: string;
  model: string;
  size_category: 'P' | 'M' | 'G';
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

// --- MULTI-USER & PERMISSIONS TYPES ---
export type SystemModuleId = 
  | 'dashboard'
  | 'clientes'
  | 'servicos'
  | 'orcamentos'
  | 'agenda'
  | 'historico'
  | 'financeiro'
  | 'relatorios'
  | 'mensagens'
  | 'automacoes'
  | 'indicacoes'
  | 'configuracoes'
  | 'usuarios';

export interface ModulePermission {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

export type UserRole = 'admin' | 'gerente' | 'atendente' | 'tecnico' | 'personalizado';

export interface ServiceCommissionRule {
  serviceId: string;
  percentage: number;
}

export interface User {
  id: string;
  authUserId?: string;
  name: string;
  phone: string;
  email: string;
  photoUrl?: string;
  status: 'ativo' | 'inativo';
  role: UserRole; // Modelo interno; corresponde à coluna public.usuarios.perfil.
  permissions: Record<SystemModuleId, ModulePermission>;
  commissions: ServiceCommissionRule[];
  defaultCommissionPercent: number;
  createdAt?: string;
  updatedAt?: string;
}

export type CreateUserInput = Omit<User, 'id' | 'authUserId' | 'createdAt' | 'updatedAt'> & {
  password: string;
};

export type CommissionStatus = 'pendente' | 'paga';

export interface CommissionRecord {
  id: string;
  userId: string;
  userName: string;
  appointmentId: string;
  customerName: string;
  serviceName: string;
  serviceValue: number;
  commissionPercent: number;
  commissionValue: number;
  date: string; // YYYY-MM-DD
  status: CommissionStatus;
  paidAt?: string;
  notes?: string;
  createdAt?: string;
}
