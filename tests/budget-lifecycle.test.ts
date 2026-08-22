import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateBudgetAutomation, buildBudgetDeduplicationKey } from '../src/db/budgetPolicy';
import { getBudgetProgress, getPendingBudgetItems } from '../src/utils/budgetLifecycle';
import { dbInstance } from '../src/db/localDb';
import { Appointment, AutomationExecution, Budget } from '../src/types';
import { readFileSync } from 'node:fs';

const baseBudget = (items: Budget['items']): Budget => ({
  id: 'budget-live-1',
  number: 154,
  customerId: 'customer-1',
  status: 'enviado',
  subtotal: 300,
  discount: 0,
  total: 300,
  validUntil: '2026-12-31',
  notes: '',
  sentAt: '2026-08-01T12:00:00.000Z',
  createdAt: '2026-08-01T12:00:00.000Z',
  updatedAt: '2026-08-01T12:00:00.000Z',
  items
});

test('orcamento vivo calcula conversao e conclusao parcial por item', () => {
  const budget = baseBudget([
    { id: 'item-farol', budgetId: 'budget-live-1', serviceId: 'svc-farol', description: 'Farol', quantity: 1, unitPrice: 100, total: 100, status: 'agendado', appointmentId: 'appt-1' },
    { id: 'item-polimento', budgetId: 'budget-live-1', serviceId: 'svc-polimento', description: 'Polimento', quantity: 1, unitPrice: 200, total: 200 }
  ]);
  const scheduled = getBudgetProgress(budget, [{ id: 'appt-1', status: 'agendado' } as Appointment]);
  assert.equal(scheduled.label, 'Parcialmente agendado');
  assert.deepEqual(getPendingBudgetItems(budget).map(item => item.id), ['item-polimento']);

  const completed = getBudgetProgress(budget, [{ id: 'appt-1', status: 'finalizado' } as Appointment]);
  assert.equal(completed.label, 'Parcialmente realizado');
  assert.equal(completed.completedItems, 1);
  assert.equal(completed.pendingItems, 1);
});

test('orcamento vivo conclui somente quando todos os itens forem resolvidos', () => {
  const budget = baseBudget([
    { id: 'item-farol', budgetId: 'budget-live-1', description: 'Farol', quantity: 1, unitPrice: 100, total: 100, status: 'concluido', appointmentId: 'appt-1' },
    { id: 'item-polimento', budgetId: 'budget-live-1', description: 'Polimento', quantity: 1, unitPrice: 200, total: 200, status: 'concluido', appointmentId: 'appt-2' }
  ]);
  const progress = getBudgetProgress(budget);
  assert.equal(progress.label, 'Concluido');
  assert.equal(progress.pendingItems, 0);
  assert.equal(progress.status, 'convertido');
});

test('follow-up de orcamento continua quando ainda existe item pendente', () => {
  const budget = baseBudget([
    { id: 'item-farol', budgetId: 'budget-live-1', description: 'Farol', quantity: 1, unitPrice: 100, total: 100, status: 'concluido', appointmentId: 'appt-1' },
    { id: 'item-polimento', budgetId: 'budget-live-1', description: 'Polimento', quantity: 1, unitPrice: 200, total: 200 }
  ]);
  const initial = {
    id: 'initial',
    automacao: 'orcamento_enviado',
    customer_id: 'customer-1',
    status: 'sucesso',
    deduplication_key: buildBudgetDeduplicationKey('orcamento_enviado', budget.id),
    updated_at: '2026-08-01T12:00:00.000Z'
  } as AutomationExecution;
  const appointment = {
    id: 'appt-1',
    customerId: 'customer-1',
    createdAt: '2026-08-02T12:00:00.000Z',
    status: 'finalizado'
  } as Appointment;

  assert.equal(evaluateBudgetAutomation({
    event: 'orcamento_followup_7d',
    budget,
    appointments: [appointment],
    executions: [initial],
    now: new Date('2026-08-08T12:00:00.000Z')
  }).action, 'queue');
});

test('orcamento antigo sem status por item permanece compativel', () => {
  const budget = baseBudget([
    { id: 'legacy-item', budgetId: 'budget-live-1', description: 'Servico antigo', quantity: 1, unitPrice: 100, total: 100 }
  ]);
  const progress = getBudgetProgress(budget);
  assert.equal(progress.label, 'Pendente');
  assert.equal(progress.pendingItems, 1);
});

test('cancelamento de agendamento vinculado devolve item para pendente e permite reagendamento', async () => {
  const originalBudgets = dbInstance.budgets;
  const originalAppointments = dbInstance.appointments;
  const originalConfig = dbInstance.config;
  try {
    dbInstance.config = { ...dbInstance.config, useRealSupabase: false };
    dbInstance.appointments = [];
    dbInstance.budgets = [baseBudget([
      { id: 'item-farol', budgetId: 'budget-live-1', serviceId: 'svc-farol', description: 'Farol', quantity: 1, unitPrice: 100, total: 100 },
      { id: 'item-polimento', budgetId: 'budget-live-1', serviceId: 'svc-polimento', description: 'Polimento', quantity: 1, unitPrice: 200, total: 200 }
    ])];

    const firstAppointment = await dbInstance.convertBudgetItemsToAppointment('budget-live-1', ['item-farol'], {
      customerId: 'customer-1',
      vehicleId: 'vehicle-1',
      serviceId: 'svc-farol',
      serviceIds: ['svc-farol'],
      dateTime: '2026-08-23T09:00',
      status: 'agendado',
      value: 100,
      durationTotal: 60,
      employeeId: 'Gabriel',
      notes: ''
    });
    assert.equal(dbInstance.budgets[0].items[0].status, 'agendado');

    await dbInstance.updateAppointmentStatus(firstAppointment.id, 'cancelado');
    assert.equal(dbInstance.budgets[0].items[0].status, 'pendente');
    assert.equal(dbInstance.budgets[0].items[0].appointmentId, undefined);
    assert.equal(dbInstance.appointments[0].budgetId, 'budget-live-1');
    assert.deepEqual(dbInstance.appointments[0].budgetItemIds, ['item-farol']);

    await dbInstance.convertBudgetItemsToAppointment('budget-live-1', ['item-farol'], {
      customerId: 'customer-1',
      vehicleId: 'vehicle-1',
      serviceId: 'svc-farol',
      serviceIds: ['svc-farol'],
      dateTime: '2026-08-24T09:00',
      status: 'agendado',
      value: 100,
      durationTotal: 60,
      employeeId: 'Gabriel',
      notes: ''
    });
    assert.equal(dbInstance.appointments.length, 2);
    assert.equal(dbInstance.budgets[0].items[0].status, 'agendado');
  } finally {
    dbInstance.budgets = originalBudgets;
    dbInstance.appointments = originalAppointments;
    dbInstance.config = originalConfig;
  }
});

test('segunda conversao usa o mesmo orcamento original sem duplicar itens', async () => {
  const originalBudgets = dbInstance.budgets;
  const originalAppointments = dbInstance.appointments;
  const originalConfig = dbInstance.config;
  try {
    dbInstance.config = { ...dbInstance.config, useRealSupabase: false };
    dbInstance.appointments = [];
    dbInstance.budgets = [baseBudget([
      { id: 'item-farol', budgetId: 'budget-live-1', serviceId: 'svc-farol', description: 'Farol', quantity: 1, unitPrice: 100, total: 100, status: 'concluido', appointmentId: 'appt-farol' },
      { id: 'item-polimento', budgetId: 'budget-live-1', serviceId: 'svc-polimento', description: 'Polimento', quantity: 1, unitPrice: 200, total: 200 }
    ])];

    await dbInstance.convertBudgetItemsToAppointment('budget-live-1', ['item-polimento'], {
      customerId: 'customer-1',
      vehicleId: 'vehicle-1',
      serviceId: 'svc-polimento',
      serviceIds: ['svc-polimento'],
      dateTime: '2026-08-25T10:00',
      status: 'agendado',
      value: 200,
      durationTotal: 60,
      employeeId: 'Gabriel',
      notes: ''
    });

    assert.equal(dbInstance.budgets.length, 1);
    assert.equal(dbInstance.budgets[0].items.length, 2);
    assert.equal(dbInstance.budgets[0].items[0].status, 'concluido');
    assert.equal(dbInstance.budgets[0].items[1].status, 'agendado');
    assert.equal(dbInstance.appointments[0].budgetId, 'budget-live-1');
  } finally {
    dbInstance.budgets = originalBudgets;
    dbInstance.appointments = originalAppointments;
    dbInstance.config = originalConfig;
  }
});

test('segunda tentativa de converter o mesmo item falha sem criar agendamento duplicado', async () => {
  const originalBudgets = dbInstance.budgets;
  const originalAppointments = dbInstance.appointments;
  const originalConfig = dbInstance.config;
  try {
    dbInstance.config = { ...dbInstance.config, useRealSupabase: false };
    dbInstance.appointments = [];
    dbInstance.budgets = [baseBudget([
      { id: 'item-farol', budgetId: 'budget-live-1', serviceId: 'svc-farol', description: 'Farol', quantity: 1, unitPrice: 100, total: 100 }
    ])];
    const appointment = {
      customerId: 'customer-1',
      vehicleId: 'vehicle-1',
      serviceId: 'svc-farol',
      serviceIds: ['svc-farol'],
      dateTime: '2026-08-25T10:00',
      status: 'agendado' as const,
      value: 100,
      durationTotal: 60,
      employeeId: 'Gabriel',
      notes: ''
    };

    await dbInstance.convertBudgetItemsToAppointment('budget-live-1', ['item-farol'], appointment);
    await assert.rejects(
      dbInstance.convertBudgetItemsToAppointment('budget-live-1', ['item-farol'], appointment),
      /já foram convertidos|ja foram convertidos/
    );

    assert.equal(dbInstance.appointments.length, 1);
    assert.equal(dbInstance.budgets[0].items[0].status, 'agendado');
  } finally {
    dbInstance.budgets = originalBudgets;
    dbInstance.appointments = originalAppointments;
    dbInstance.config = originalConfig;
  }
});

test('item manual isolado ou misturado nao pode ser convertido automaticamente', async () => {
  const originalBudgets = dbInstance.budgets;
  const originalAppointments = dbInstance.appointments;
  const originalConfig = dbInstance.config;
  try {
    dbInstance.config = { ...dbInstance.config, useRealSupabase: false };
    dbInstance.appointments = [];
    dbInstance.budgets = [baseBudget([
      { id: 'item-farol', budgetId: 'budget-live-1', serviceId: 'svc-farol', description: 'Farol', quantity: 1, unitPrice: 100, total: 100 },
      { id: 'item-manual', budgetId: 'budget-live-1', description: 'Item manual', quantity: 1, unitPrice: 50, total: 50 }
    ])];
    const appointment = {
      customerId: 'customer-1',
      vehicleId: 'vehicle-1',
      serviceId: 'svc-farol',
      serviceIds: ['svc-farol'],
      dateTime: '2026-08-26T10:00',
      status: 'agendado' as const,
      value: 100,
      durationTotal: 60,
      employeeId: 'Gabriel',
      notes: ''
    };

    await assert.rejects(
      dbInstance.convertBudgetItemsToAppointment('budget-live-1', ['item-manual'], appointment),
      /Itens manuais/
    );
    await assert.rejects(
      dbInstance.convertBudgetItemsToAppointment('budget-live-1', ['item-farol', 'item-manual'], appointment),
      /Itens manuais/
    );
    await dbInstance.convertBudgetItemsToAppointment('budget-live-1', ['item-farol'], appointment);
    assert.equal(dbInstance.appointments.length, 1);
    assert.equal(dbInstance.budgets[0].items[1].status, undefined);
  } finally {
    dbInstance.budgets = originalBudgets;
    dbInstance.appointments = originalAppointments;
    dbInstance.config = originalConfig;
  }
});

test('migration de conversao usa RPC transacional com lock e rollback implicito', () => {
  const migration = readFileSync('supabase/migrations/20260822203000_orcamento_vivo_itens_agendamentos.sql', 'utf8');
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.fn_converter_itens_orcamento_em_agendamento/);
  assert.match(migration, /BEGIN;/);
  assert.match(migration, /COMMIT;/);
  assert.match(migration, /FOR UPDATE/);
  assert.match(migration, /item\.status <> 'pendente'/);
  assert.match(migration, /item\.servico_id IS NULL/);
  assert.match(migration, /INSERT INTO public\.agendamentos/);
  assert.match(migration, /UPDATE public\.orcamento_itens/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.fn_converter_itens_orcamento_em_agendamento/);
});

test('RPC de conversao exige usuario ativo com permissoes de orcamento e agenda', () => {
  const migration = readFileSync('supabase/migrations/20260822203000_orcamento_vivo_itens_agendamentos.sql', 'utf8');
  assert.match(migration, /SECURITY DEFINER/);
  assert.match(migration, /SET search_path = ''/);
  assert.match(migration, /auth\.uid\(\) IS NULL/);
  assert.match(migration, /FROM public\.usuarios AS usuario/);
  assert.match(migration, /usuario\.auth_user_id = auth\.uid\(\)/);
  assert.match(migration, /usuario\.status = 'ativo'/);
  assert.match(migration, /v_user_permissions->'orcamentos'->>'create'/);
  assert.match(migration, /v_user_permissions->'orcamentos'->>'edit'/);
  assert.match(migration, /v_user_permissions->'agenda'->>'create'/);
  assert.match(migration, /IF NOT \(v_can_convert_budget AND v_can_create_appointment\)/);
});

test('RPC de conversao nao aceita status arbitrario do cliente', () => {
  const migration = readFileSync('supabase/migrations/20260822203000_orcamento_vivo_itens_agendamentos.sql', 'utf8');
  const functionSignature = migration.slice(
    migration.indexOf('CREATE OR REPLACE FUNCTION public.fn_converter_itens_orcamento_em_agendamento'),
    migration.indexOf('RETURNS UUID')
  );
  assert.doesNotMatch(functionSignature, /p_status/i);
  assert.match(migration, /p_valor_servico NUMERIC/);
  assert.match(migration, /'Agendado', coalesce\(p_observacoes, ''\)/);
  assert.doesNotMatch(migration, /coalesce\(nullif\(p_status/);
});

test('RPC de conversao preserva menor privilegio no execute', () => {
  const migration = readFileSync('supabase/migrations/20260822203000_orcamento_vivo_itens_agendamentos.sql', 'utf8');
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.fn_converter_itens_orcamento_em_agendamento\(\s*UUID, UUID\[\], UUID, UUID, DATE, TIME, NUMERIC, INTEGER, TEXT\s*\) FROM PUBLIC, anon;/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.fn_converter_itens_orcamento_em_agendamento\(\s*UUID, UUID\[\], UUID, UUID, DATE, TIME, NUMERIC, INTEGER, TEXT\s*\) TO authenticated, service_role;/);
});
