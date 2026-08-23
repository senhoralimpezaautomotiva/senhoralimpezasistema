import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildRecurringAppointments, validateRecurringAppointments } from '../src/utils/appointmentRecurrence';
import { dbInstance, mapDbAppointmentToFrontend, mapFrontendAppointmentToDb } from '../src/db/localDb';
import type { AgendaConfig, Appointment, Service } from '../src/types';

const recurringMigration = readFileSync('supabase/migrations/20260823150000_agenda_recurring_appointments.sql', 'utf8');
const recurringAgendaJsonStringFix = readFileSync('supabase/migrations/20260823170000_fix_recurring_rpc_agenda_json_string.sql', 'utf8');

const agenda: AgendaConfig = {
  days: [
    { dayOfWeek: 1, dayName: 'Segunda-feira', isActive: true, openTime: '08:00', closeTime: '18:00', hasLunchBreak: false, lunchStart: '12:00', lunchEnd: '13:00' },
    { dayOfWeek: 5, dayName: 'Sexta-feira', isActive: true, openTime: '08:00', closeTime: '18:00', hasLunchBreak: false, lunchStart: '12:00', lunchEnd: '13:00' }
  ],
  timeSlots: [
    { id: 'ts_1', time: '08:00', maxCapacity: 1 },
    { id: 'ts_2', time: '09:00', maxCapacity: 1 },
    { id: 'ts_3', time: '10:00', maxCapacity: 1 },
    { id: 'ts_4', time: '11:00', maxCapacity: 1 },
    { id: 'ts_5', time: '12:00', maxCapacity: 1 },
    { id: 'ts_6', time: '13:00', maxCapacity: 1 },
    { id: 'ts_7', time: '14:00', maxCapacity: 1 },
    { id: 'ts_8', time: '15:00', maxCapacity: 1 },
    { id: 'ts_9', time: '16:00', maxCapacity: 1 },
    { id: 'ts_10', time: '17:00', maxCapacity: 1 }
  ],
  minAdvanceHours: 0,
  maxAdvanceDays: 365,
  autoBlockDuration: true
};

const services = [
  { id: 'svc-60', name: 'Servico 60 min', estimatedTime: 60, basePrice: 100 }
] as Service[];

const baseAppointment: Omit<Appointment, 'id'> = {
  customerId: 'customer-1',
  vehicleId: 'vehicle-1',
  serviceId: 'svc-60',
  serviceIds: ['svc-60'],
  dateTime: '2026-09-04T08:00',
  status: 'agendado',
  value: 100,
  durationTotal: 60,
  employeeId: 'Gabriel',
  notes: ''
};

test('recorrencia semanal por quantidade inclui primeira ocorrencia e preserva serie', () => {
  const occurrences = buildRecurringAppointments(baseAppointment, {
    enabled: true,
    frequency: 'weekly',
    endMode: 'count',
    count: 4,
    endDate: ''
  }, '11111111-1111-4111-8111-111111111111');

  assert.deepEqual(occurrences.map(item => item.dateTime), [
    '2026-09-04T08:00',
    '2026-09-11T08:00',
    '2026-09-18T08:00',
    '2026-09-25T08:00'
  ]);
  assert.equal(occurrences.every(item => item.recurrenceId === '11111111-1111-4111-8111-111111111111'), true);
  assert.deepEqual(occurrences.map(item => item.recurrenceSequence), [1, 2, 3, 4]);
  assert.equal(occurrences.every(item => item.recurrenceTotal === 4), true);
});

test('recorrencia por data final limita a ultima ocorrencia dentro do periodo', () => {
  const occurrences = buildRecurringAppointments(baseAppointment, {
    enabled: true,
    frequency: 'biweekly',
    endMode: 'date',
    count: 99,
    endDate: '2026-10-05'
  }, '22222222-2222-4222-8222-222222222222');

  assert.deepEqual(occurrences.map(item => item.dateTime), [
    '2026-09-04T08:00',
    '2026-09-18T08:00',
    '2026-10-02T08:00'
  ]);
});

test('recorrencia mensal por quantidade ancora no dia original e limita meses curtos', () => {
  const occurrences = buildRecurringAppointments({
    ...baseAppointment,
    dateTime: '2026-01-31T08:00'
  }, {
    enabled: true,
    frequency: 'monthly',
    endMode: 'count',
    count: 4,
    endDate: ''
  }, '66666666-6666-4666-8666-666666666666');

  assert.deepEqual(occurrences.map(item => item.dateTime), [
    '2026-01-31T08:00',
    '2026-02-28T08:00',
    '2026-03-31T08:00',
    '2026-04-30T08:00'
  ]);
});

test('recorrencias por quantidade cobrem semanal, quinzenal e mensal', () => {
  const weekly = buildRecurringAppointments(baseAppointment, { enabled: true, frequency: 'weekly', endMode: 'count', count: 3, endDate: '' }, 'rec-weekly');
  const biweekly = buildRecurringAppointments(baseAppointment, { enabled: true, frequency: 'biweekly', endMode: 'count', count: 3, endDate: '' }, 'rec-biweekly');
  const monthly = buildRecurringAppointments(baseAppointment, { enabled: true, frequency: 'monthly', endMode: 'count', count: 3, endDate: '' }, 'rec-monthly');

  assert.deepEqual(weekly.map(item => item.dateTime), ['2026-09-04T08:00', '2026-09-11T08:00', '2026-09-18T08:00']);
  assert.deepEqual(biweekly.map(item => item.dateTime), ['2026-09-04T08:00', '2026-09-18T08:00', '2026-10-02T08:00']);
  assert.deepEqual(monthly.map(item => item.dateTime), ['2026-09-04T08:00', '2026-10-04T08:00', '2026-11-04T08:00']);
});

test('recorrencias por data final cobrem semanal, quinzenal e mensal', () => {
  const weekly = buildRecurringAppointments(baseAppointment, { enabled: true, frequency: 'weekly', endMode: 'date', count: 99, endDate: '2026-09-19' }, 'date-weekly');
  const biweekly = buildRecurringAppointments(baseAppointment, { enabled: true, frequency: 'biweekly', endMode: 'date', count: 99, endDate: '2026-10-05' }, 'date-biweekly');
  const monthly = buildRecurringAppointments(baseAppointment, { enabled: true, frequency: 'monthly', endMode: 'date', count: 99, endDate: '2026-11-15' }, 'date-monthly');

  assert.deepEqual(weekly.map(item => item.dateTime), ['2026-09-04T08:00', '2026-09-11T08:00', '2026-09-18T08:00']);
  assert.deepEqual(biweekly.map(item => item.dateTime), ['2026-09-04T08:00', '2026-09-18T08:00', '2026-10-02T08:00']);
  assert.deepEqual(monthly.map(item => item.dateTime), ['2026-09-04T08:00', '2026-10-04T08:00', '2026-11-04T08:00']);
});

test('validacao de recorrencia bloqueia toda a serie quando uma ocorrencia conflita', () => {
  const occurrences = buildRecurringAppointments(baseAppointment, {
    enabled: true,
    frequency: 'weekly',
    endMode: 'count',
    count: 3,
    endDate: ''
  }, '33333333-3333-4333-8333-333333333333');

  const conflicts = validateRecurringAppointments({
    agenda,
    existingAppointments: [{
      ...baseAppointment,
      id: 'busy',
      dateTime: '2026-09-11T08:00'
    }],
    occurrences,
    services,
    serviceDuration: 60,
    now: new Date('2026-09-01T08:00:00')
  });

  assert.deepEqual(conflicts.map(conflict => `${conflict.date}T${conflict.time}`), ['2026-09-11T08:00']);
});

test('validacao de recorrencia respeita antecedencia maxima em cada ocorrencia', () => {
  const occurrences = buildRecurringAppointments(baseAppointment, {
    enabled: true,
    frequency: 'weekly',
    endMode: 'count',
    count: 3,
    endDate: ''
  }, '55555555-5555-4555-8555-555555555555');

  const conflicts = validateRecurringAppointments({
    agenda: {
      ...agenda,
      maxAdvanceDays: 10
    },
    existingAppointments: [],
    occurrences,
    services,
    serviceDuration: 60,
    now: new Date('2026-09-01T08:00:00')
  });

  assert.deepEqual(conflicts.map(conflict => `${conflict.date}T${conflict.time}`), [
    '2026-09-18T08:00'
  ]);
});

test('mapeamento supabase preserva metadados estruturados de recorrencia', () => {
  const row = mapFrontendAppointmentToDb({
    ...baseAppointment,
    id: 'appointment-1',
    recurrenceId: '44444444-4444-4444-8444-444444444444',
    recurrenceSequence: 2,
    recurrenceFrequency: 'monthly',
    recurrenceTotal: 5
  });

  assert.equal(row.recurrence_id, '44444444-4444-4444-8444-444444444444');
  assert.equal(row.recurrence_sequence, 2);
  assert.equal(row.recurrence_frequency, 'monthly');
  assert.equal(row.recurrence_total, 5);

  const appointment = mapDbAppointmentToFrontend({
    id: 'appointment-1',
    cliente_id: 'customer-1',
    veiculo_id: 'vehicle-1',
    servico_id: 'svc-60',
    data_agendamento: '2026-09-04',
    hora_agendamento: '08:00:00',
    status: 'Agendado',
    valor_servico: 100,
    tempo_real: 60,
    observacoes: '',
    recurrence_id: '44444444-4444-4444-8444-444444444444',
    recurrence_sequence: 2,
    recurrence_frequency: 'monthly',
    recurrence_total: 5
  });

  assert.equal(appointment.recurrenceId, '44444444-4444-4444-8444-444444444444');
  assert.equal(appointment.recurrenceSequence, 2);
  assert.equal(appointment.recurrenceFrequency, 'monthly');
  assert.equal(appointment.recurrenceTotal, 5);
});

test('criacao local de serie faz rollback se uma ocorrencia falhar no meio', async () => {
  const originalAppointments = dbInstance.appointments;
  const originalConfig = dbInstance.config;
  const originalAddAppointment = dbInstance.addAppointment.bind(dbInstance);
  let calls = 0;
  try {
    dbInstance.config = { ...dbInstance.config, useRealSupabase: false };
    dbInstance.appointments = [];
    dbInstance.addAppointment = async (appointment: Omit<Appointment, 'id'>) => {
      calls += 1;
      if (calls === 3) throw new Error('falha simulada');
      return originalAddAppointment(appointment);
    };

    const occurrences = buildRecurringAppointments(baseAppointment, {
      enabled: true,
      frequency: 'weekly',
      endMode: 'count',
      count: 5,
      endDate: ''
    }, '77777777-7777-4777-8777-777777777777');

    await assert.rejects(dbInstance.addRecurringAppointments(occurrences), /falha simulada/);
    assert.equal(dbInstance.appointments.length, 0);
  } finally {
    dbInstance.addAppointment = originalAddAppointment;
    dbInstance.appointments = originalAppointments;
    dbInstance.config = originalConfig;
  }
});

test('criacao local de serie valida sucesso completo com sequencia e total', async () => {
  const originalAppointments = dbInstance.appointments;
  const originalConfig = dbInstance.config;
  try {
    dbInstance.config = { ...dbInstance.config, useRealSupabase: false };
    dbInstance.appointments = [];
    const occurrences = buildRecurringAppointments(baseAppointment, {
      enabled: true,
      frequency: 'weekly',
      endMode: 'count',
      count: 4,
      endDate: ''
    }, '88888888-8888-4888-8888-888888888888');

    const created = await dbInstance.addRecurringAppointments(occurrences);

    assert.equal(created.length, 4);
    assert.equal(dbInstance.appointments.length, 4);
    assert.equal(created.every(item => item.recurrenceId === '88888888-8888-4888-8888-888888888888'), true);
    assert.deepEqual(created.map(item => item.recurrenceSequence), [1, 2, 3, 4]);
    assert.equal(created.every(item => item.recurrenceTotal === 4), true);
  } finally {
    dbInstance.appointments = originalAppointments;
    dbInstance.config = originalConfig;
  }
});

test('edicao e cancelamento de ocorrencia preservam as demais da serie', async () => {
  const originalAppointments = dbInstance.appointments;
  const originalConfig = dbInstance.config;
  try {
    dbInstance.config = { ...dbInstance.config, useRealSupabase: false };
    dbInstance.appointments = [];
    const occurrences = buildRecurringAppointments(baseAppointment, {
      enabled: true,
      frequency: 'weekly',
      endMode: 'count',
      count: 4,
      endDate: ''
    }, '99999999-9999-4999-8999-999999999999');
    const created = await dbInstance.addRecurringAppointments(occurrences);

    await dbInstance.updateAppointment(created[1].id, { dateTime: '2026-09-11T10:00' });
    await dbInstance.updateAppointmentStatus(created[2].id, 'cancelado');

    assert.equal(dbInstance.appointments[0].dateTime, '2026-09-04T08:00');
    assert.equal(dbInstance.appointments[1].dateTime, '2026-09-11T10:00');
    assert.equal(dbInstance.appointments[2].status, 'cancelado');
    assert.equal(dbInstance.appointments[3].dateTime, '2026-09-25T08:00');
    assert.equal(dbInstance.appointments.every(item => item.recurrenceId === '99999999-9999-4999-8999-999999999999'), true);
  } finally {
    dbInstance.appointments = originalAppointments;
    dbInstance.config = originalConfig;
  }
});

test('migration da recorrencia define RPC transacional, locks e idempotencia', () => {
  assert.match(recurringMigration, /CREATE OR REPLACE FUNCTION public\.fn_criar_agendamentos_recorrentes/);
  assert.match(recurringMigration, /SECURITY DEFINER/);
  assert.match(recurringMigration, /SET search_path = ''/);
  assert.match(recurringMigration, /auth\.uid\(\) IS NULL/);
  assert.match(recurringMigration, /v_user_permissions->'agenda'->>'create'/);
  assert.match(recurringMigration, /pg_advisory_xact_lock\(hashtext\('agenda:' \|\| v_date::text\)\)/);
  assert.match(recurringMigration, /ORDER BY 1/);
  assert.match(recurringMigration, /CREATE UNIQUE INDEX IF NOT EXISTS idx_agendamentos_recurrence_sequence/);
  assert.match(recurringMigration, /RAISE EXCEPTION 'Capacidade esgotada em % %'/);
  assert.match(recurringMigration, /INSERT INTO public\.agendamentos/);
  assert.match(recurringMigration, /REVOKE ALL ON FUNCTION public\.fn_criar_agendamentos_recorrentes/);
  assert.match(recurringMigration, /GRANT EXECUTE ON FUNCTION public\.fn_criar_agendamentos_recorrentes/);
});

test('trigger suprime confirmacao imediata de ocorrencias recorrentes posteriores', () => {
  assert.match(recurringMigration, /NEW\.recurrence_id IS NULL/);
  assert.match(recurringMigration, /coalesce\(NEW\.recurrence_sequence, 1\) = 1/);
  assert.match(recurringMigration, /'novo_agendamento:' \|\| NEW\.id/);
});

test('lembretes futuros nao sao suprimidos pela migration de recorrencia', () => {
  assert.doesNotMatch(recurringMigration, /lembrete_agendamento[\s\S]*recurrence_sequence/);
  assert.doesNotMatch(recurringMigration, /reminder_sent[\s\S]*recurrence_sequence/);
});

test('migration corretiva normaliza agenda JSONB objeto ou string JSON parseavel', () => {
  assert.match(recurringAgendaJsonStringFix, /CREATE OR REPLACE FUNCTION public\.fn_criar_agendamentos_recorrentes/);
  assert.match(recurringAgendaJsonStringFix, /p_cliente_id UUID,\s*p_veiculo_id UUID,\s*p_servico_id UUID,\s*p_recurrence_id UUID,\s*p_recurrence_frequency TEXT,\s*p_recurrence_total INTEGER,\s*p_occurrences JSONB,\s*p_valor_servico NUMERIC,\s*p_tempo_real INTEGER,\s*p_observacoes TEXT DEFAULT ''/);
  assert.match(recurringAgendaJsonStringFix, /v_agenda_raw JSONB/);
  assert.match(recurringAgendaJsonStringFix, /jsonb_typeof\(v_agenda_raw\) = 'object'[\s\S]*v_agenda := v_agenda_raw/);
  assert.match(recurringAgendaJsonStringFix, /jsonb_typeof\(v_agenda_raw\) = 'string'[\s\S]*v_agenda := \(v_agenda_raw #>> '\{\}'\)::jsonb/);
  assert.match(recurringAgendaJsonStringFix, /EXCEPTION WHEN OTHERS THEN\s+RAISE EXCEPTION 'Configuracao de agenda invalida'/);
  assert.match(recurringAgendaJsonStringFix, /v_agenda IS NULL OR jsonb_typeof\(v_agenda\) <> 'object'[\s\S]*RAISE EXCEPTION 'Configuracao de agenda invalida'/);
});

test('migration corretiva preserva seguranca, locks, grants e automacoes', () => {
  assert.match(recurringAgendaJsonStringFix, /SECURITY DEFINER/);
  assert.match(recurringAgendaJsonStringFix, /SET search_path = ''/);
  assert.match(recurringAgendaJsonStringFix, /auth\.uid\(\) IS NULL/);
  assert.match(recurringAgendaJsonStringFix, /usuario\.status = 'ativo'/);
  assert.match(recurringAgendaJsonStringFix, /v_user_permissions->'agenda'->>'create'/);
  assert.match(recurringAgendaJsonStringFix, /pg_advisory_xact_lock\(hashtext\('agenda:' \|\| v_date::text\)\)/);
  assert.match(recurringAgendaJsonStringFix, /ORDER BY 1/);
  assert.match(recurringAgendaJsonStringFix, /REVOKE ALL ON FUNCTION public\.fn_criar_agendamentos_recorrentes/);
  assert.match(recurringAgendaJsonStringFix, /FROM PUBLIC, anon/);
  assert.match(recurringAgendaJsonStringFix, /GRANT EXECUTE ON FUNCTION public\.fn_criar_agendamentos_recorrentes/);
  assert.doesNotMatch(recurringAgendaJsonStringFix, /fn_trigger_enfileirar_agendamento/);
});
