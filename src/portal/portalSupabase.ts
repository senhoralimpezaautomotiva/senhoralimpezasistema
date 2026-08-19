import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getPublicSupabaseEnvironment } from '../config/publicEnvironment';
import {
  mapDbAppointmentToFrontend,
  mapDbCustomerToFrontend,
  mapDbServiceToFrontend,
  mapDbVehicleToFrontend,
  mapFrontendVehicleToDb
} from '../db/localDb';
import type { AgendaConfig, Appointment, Customer, LoyaltyRewardCredit, Service, Vehicle } from '../types';

const PORTAL_AUTH_STORAGE_KEY = 'sl_portal_auth_session';

let portalClient: SupabaseClient | null = null;

export interface PortalData {
  customer: Customer | null;
  vehicles: Vehicle[];
  services: Service[];
  appointments: Appointment[];
  servicePrices: Array<{
    servico_id: string;
    porte: string;
    preco: number;
    tempo_estimado_minutos: number;
  }>;
  busyAppointments: Appointment[];
  referralProgress: number;
  loyaltyRewardCredits: LoyaltyRewardCredit[];
  portalSettings: {
    catalogSource: 'system' | 'whatsapp';
    whatsappCatalogUrl: string;
    instagramUrl: string;
    address: string;
    googleMapsUrl: string;
    loyaltyTarget: number;
    agenda?: AgendaConfig;
  };
}

const assertNoError = (error: { message?: string } | null, fallback: string): void => {
  if (error) throw new Error(error.message || fallback);
};

export function getPortalSupabaseClient(): SupabaseClient {
  if (portalClient) return portalClient;

  const environment = getPublicSupabaseEnvironment();
  if (!environment.isConfigured) {
    throw new Error('O Portal do Cliente não está configurado para este ambiente.');
  }

  portalClient = createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
    auth: {
      storageKey: PORTAL_AUTH_STORAGE_KEY,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  return portalClient;
}

export function normalizeBrazilianPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  if (digits.length === 12 || digits.length === 13) return `+${digits}`;
  return '';
}

export async function claimExistingPortalCustomer(): Promise<string | null> {
  const { data, error } = await getPortalSupabaseClient().rpc('portal_claim_existing_cliente');
  assertNoError(error, 'Não foi possível vincular o cadastro.');
  return typeof data === 'string' ? data : null;
}

export async function createPortalCustomer(input: {
  name: string;
  birthDate: string;
  origin: string;
  email?: string;
  phone: string;
  referralCode?: string;
}): Promise<string> {
  const { data, error } = await getPortalSupabaseClient().rpc('portal_create_cliente', {
    p_nome: input.name,
    p_data_aniversario: input.birthDate,
    p_origem: input.origin,
    p_email: input.email || null,
    p_referral_code: input.referralCode || null,
    p_phone: input.phone
  });
  assertNoError(error, 'Não foi possível criar o cadastro.');
  if (typeof data !== 'string') throw new Error('Cadastro não retornado.');
  return data;
}

export async function validatePortalReferralCode(code: string): Promise<boolean> {
  const { data, error } = await getPortalSupabaseClient().rpc(
    'portal_validate_referral_code',
    { p_code: code }
  );
  assertNoError(error, 'Não foi possível validar o código de indicação.');
  return data === true;
}

export async function loadPortalData(date?: string): Promise<PortalData> {
  const client = getPortalSupabaseClient();
  const [
    customerResult,
    vehicleResult,
    serviceResult,
    appointmentResult,
    priceResult,
    busyResult,
    settingsResult,
    referralProgressResult,
    loyaltyCreditsResult
  ] = await Promise.all([
    client.from('clientes').select('id,created_at,nome,telefone,data_aniversario').maybeSingle(),
    client.from('veiculos').select('id,cliente_id,placa,modelo,cor,marca,porte').order('placa'),
    client.from('servicos_disponiveis').select('id,nome_servico,observacao,categoria,ativo').eq('ativo', true),
    client
      .from('agendamentos')
      .select('id,cliente_id,veiculo_id,servico_id,data_agendamento,hora_agendamento,tempo_real,valor_servico,status,observacoes,created_at,updated_at')
      .order('data_agendamento', { ascending: false }),
    client.from('servicos_precos').select('servico_id,porte,preco,tempo_estimado_minutos'),
    date
      ? client.rpc('portal_busy_intervals', { p_date: date })
      : Promise.resolve({ data: [], error: null }),
    client
      .from('configuracoes_empresa')
      .select('portal_catalog_source,whatsapp_catalog_url,instagram_url,address,google_maps_url,loyalty_referral_target,agenda')
      .eq('id', 'c0000000-0000-0000-0000-000000000000')
      .maybeSingle(),
    client.rpc('portal_referral_progress'),
    client.rpc('portal_available_loyalty_credits')
  ]);

  assertNoError(customerResult.error, 'Não foi possível carregar o cliente.');
  assertNoError(vehicleResult.error, 'Não foi possível carregar os veículos.');
  assertNoError(serviceResult.error, 'Não foi possível carregar os serviços.');
  assertNoError(appointmentResult.error, 'Não foi possível carregar os agendamentos.');
  assertNoError(priceResult.error, 'Não foi possível carregar os preços.');
  assertNoError(busyResult.error, 'Não foi possível consultar a disponibilidade.');

  assertNoError(settingsResult.error, 'Nao foi possivel carregar as configuracoes do portal.');
  assertNoError(referralProgressResult.error, 'Nao foi possivel carregar o cartao fidelidade.');
  assertNoError(loyaltyCreditsResult.error, 'Nao foi possivel carregar os creditos de fidelidade.');

  const busyAppointments = (busyResult.data || []).map((row: any, index: number) =>
    ({
      id: `busy-${date}-${index}`,
      customerId: '__busy__',
      vehicleId: '__busy__',
      serviceId: '__busy__',
      serviceIds: [],
      dateTime: `${date}T${String(row.hora_agendamento).slice(0, 5)}`,
      status: 'agendado',
      value: 0,
      durationTotal: Number(row.tempo_estimado_minutos) || 60,
      employeeId: '',
      notes: ''
    }) satisfies Appointment
  );

  return {
    customer: customerResult.data
      ? mapDbCustomerToFrontend(customerResult.data)
      : null,
    vehicles: (vehicleResult.data || []).map(mapDbVehicleToFrontend),
    services: (serviceResult.data || []).map(mapDbServiceToFrontend),
    appointments: (appointmentResult.data || []).map(mapDbAppointmentToFrontend),
    servicePrices: (priceResult.data || []).map((row: any) => ({
      servico_id: String(row.servico_id),
      porte: String(row.porte),
      preco: Number(row.preco),
      tempo_estimado_minutos: Number(row.tempo_estimado_minutos)
    })),
    busyAppointments,
    referralProgress: Math.max(0, Number(referralProgressResult.data) || 0),
    loyaltyRewardCredits: (loyaltyCreditsResult.data || []).map((row: any) => ({
      id: String(row.id),
      customerId: String(row.customer_id),
      serviceId: String(row.service_id),
      status: 'available',
      earnedFromEntryId: row.earned_from_entry_id ? String(row.earned_from_entry_id) : null,
      redeemedAppointmentId: null,
      createdAt: String(row.created_at),
      redeemedAt: null
    })),
    portalSettings: {
      catalogSource: settingsResult.data?.portal_catalog_source === 'whatsapp' ? 'whatsapp' : 'system',
      whatsappCatalogUrl: String(settingsResult.data?.whatsapp_catalog_url || ''),
      instagramUrl: String(settingsResult.data?.instagram_url || ''),
      address: String(settingsResult.data?.address || ''),
      googleMapsUrl: String(settingsResult.data?.google_maps_url || ''),
      loyaltyTarget: Math.max(1, Number(settingsResult.data?.loyalty_referral_target) || 10),
      agenda: settingsResult.data?.agenda
        ? (typeof settingsResult.data.agenda === 'string' ? JSON.parse(settingsResult.data.agenda) : settingsResult.data.agenda)
        : undefined
    }
  };
}

export async function addPortalVehicle(
  customerId: string,
  vehicle: Omit<Vehicle, 'id' | 'customerId'>
): Promise<Vehicle> {
  const payload = mapFrontendVehicleToDb({ ...vehicle, customerId });
  const { data, error } = await getPortalSupabaseClient()
    .from('veiculos')
    .insert(payload)
    .select('id,cliente_id,placa,modelo,cor,marca,porte')
    .single();
  assertNoError(error, 'Não foi possível cadastrar o veículo.');
  return mapDbVehicleToFrontend(data);
}

export async function createPortalAppointment(input: {
  vehicleId: string;
  serviceIds: string[];
  date: string;
  time: string;
  notes?: string;
}): Promise<Appointment> {
  const { data, error } = await getPortalSupabaseClient().rpc(
    'portal_create_agendamento',
    {
      p_veiculo_id: input.vehicleId,
      p_service_ids: input.serviceIds,
      p_data: input.date,
      p_hora: input.time,
      p_observacoes: input.notes || null
    }
  );
  assertNoError(error, 'Não foi possível criar o agendamento.');
  return mapDbAppointmentToFrontend(data);
}

export async function cancelPortalAppointment(id: string): Promise<Appointment> {
  const { data, error } = await getPortalSupabaseClient().rpc(
    'portal_cancel_agendamento',
    { p_agendamento_id: id }
  );
  assertNoError(error, 'Não foi possível cancelar o agendamento.');
  return mapDbAppointmentToFrontend(data);
}
