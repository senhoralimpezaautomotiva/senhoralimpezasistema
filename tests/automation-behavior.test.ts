import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sendAutomationPayload, AutomationTransportPayload } from '../src/server/automationTransport';
import {
  mapDbAppointmentToFrontend,
  mapFrontendAppointmentToDb,
  renderAndNormalizeMessage,
  dbInstance
} from '../src/db/localDb';
import { classifyAutomationEvent } from '../src/db/automationEventPolicy';
import { classifyQueuedAutomation } from '../src/db/automationExecutionPolicy';
import {
  buildReminderDeduplicationKey,
  buildReminderScheduleFromDatabase,
  evaluateReminderExecution,
  isReminderAppointmentEligible
} from '../src/db/reminderPolicy';
import {
  buildInactiveCustomerCycleKey,
  buildInactiveCustomerDeduplicationKey,
  evaluateInactiveCustomerCadence,
  evaluateInactiveCustomer,
  evaluateInactiveCustomerExecution,
  parseInactiveCustomerDateTime
} from '../src/db/inactiveCustomerPolicy';
import {
  buildBirthdayDeduplicationKey,
  evaluateBirthday,
  evaluateBirthdayExecution,
  parseBirthdayDate
} from '../src/db/birthdayPolicy';
import { getPartsInTimezone } from '../src/utils/operationalWindow';
import {
  applyAutomationConfigPatch,
  sanitizeAutomationConfigPatch
} from '../src/server/automationConfigPatch';
import { AutomationExecution, AutomationTrigger } from '../src/types';
import { buildBudgetDeduplicationKey, evaluateBudgetAutomation } from '../src/db/budgetPolicy';
import { AutomationEngine } from '../src/db/automationEngine';
import {
  classifyProviderHttpResponse,
  decideProviderExecution,
  parseRetryAfterSeconds
} from '../src/db/automationProviderPolicy';
import {
  classifyAutomationExecutionOperationalState,
  summarizeAutomationOperations
} from '../src/db/automationMonitoring';

const payload: AutomationTransportPayload = {
  executionId: 'exec-1',
  event: 'novo_agendamento',
  appointmentId: 'appt-1',
  companyId: 'company-1',
  phone: '5511999998888',
  message: 'Mensagem renderizada',
  customer: {
    id: 'customer-1',
    name: 'Cliente Teste',
    phone: '5511999998888'
  }
};

const secrets = {
  makeWebhookUrl: 'https://make.example.test/hook',
  zapiInstanceId: 'instance',
  zapiToken: 'token',
  zapiClientToken: 'client-token'
};

test('Make aceito é a única rota e recebe o contrato completo', async () => {
  const calls: Array<{ url: string; body: unknown }> = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(input),
      body: JSON.parse(String(init?.body || '{}'))
    });
    return new Response(null, { status: 202 });
  }) as typeof fetch;

  const result = await sendAutomationPayload(payload, { secrets, fetchImpl });

  assert.equal(result.success, true);
  assert.equal(result.provider, 'make');
  assert.equal(result.outcome, 'accepted');
  assert.equal(result.confirmation, 'make_queued');
  assert.match(result.apiResponse, /entrega ainda não confirmada/);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].body, {
    ...payload,
    telefone: payload.phone,
    formattedMessage: payload.message
  });
  assert.deepEqual(Object.keys(calls[0].body as object).sort(), [
    'appointmentId',
    'companyId',
    'customer',
    'event',
    'executionId',
    'formattedMessage',
    'message',
    'phone',
    'telefone'
  ]);
});

test('blueprint versionado usa o mesmo contrato do backend', () => {
  const blueprint = JSON.parse(readFileSync(
    join(process.cwd(), 'make-blueprints', 'Integration Webhooks.blueprint.json'),
    'utf8'
  ));
  const webhook = blueprint.flow.find((module: any) => module.id === 2);
  const sender = blueprint.flow.find((module: any) => module.id === 4);
  const interfaceNames = new Set(
    webhook.metadata.interface.map((field: any) => field.name)
  );

  for (const field of [
    'executionId',
    'event',
    'appointmentId',
    'companyId',
    'phone',
    'message',
    'customer'
  ]) {
    assert.equal(interfaceNames.has(field), true);
  }
  assert.equal(blueprint.metadata.version, 2);
  assert.deepEqual(sender.mapper.dataStructureBodyContent, {
    phone: '{{2.phone}}',
    message: '{{2.message}}'
  });
});

test('Z-API só é fallback quando o endpoint Make está comprovadamente ausente', async () => {
  const calls: string[] = [];
  const fetchImpl = (async (input: string | URL | Request) => {
    calls.push(String(input));
    return calls.length === 1
      ? new Response(null, { status: 410 })
      : Response.json({ messageId: 'provider-message-id' }, { status: 200 });
  }) as typeof fetch;

  const result = await sendAutomationPayload(payload, { secrets, fetchImpl });

  assert.equal(result.success, true);
  assert.equal(result.provider, 'zapi');
  assert.equal(result.outcome, 'accepted');
  assert.equal(result.confirmation, 'zapi_queued');
  assert.equal(calls.length, 2);
  assert.equal(calls[0], secrets.makeWebhookUrl);
  assert.match(calls[1], /api\.z-api\.io/);
});

test('falha ambígua de comunicação com Make não dispara Z-API', async () => {
  let calls = 0;
  const fetchImpl = (async () => {
    calls += 1;
    throw new Error('connection reset');
  }) as typeof fetch;

  const result = await sendAutomationPayload(payload, { secrets, fetchImpl });

  assert.equal(result.success, false);
  assert.equal(result.provider, 'make');
  assert.equal(result.outcome, 'ambiguous_failure');
  assert.equal(calls, 1);
});

test('erro 5xx ambíguo do Make não dispara Z-API', async () => {
  let calls = 0;
  const fetchImpl = (async () => {
    calls += 1;
    return new Response(null, { status: 503 });
  }) as typeof fetch;

  const result = await sendAutomationPayload(payload, { secrets, fetchImpl });

  assert.equal(result.success, false);
  assert.equal(result.provider, 'make');
  assert.equal(result.outcome, 'ambiguous_failure');
  assert.equal(calls, 1);
});

test('ausência de provedor é falha definitiva e nunca sucesso simulado', async () => {
  const result = await sendAutomationPayload(payload, {
    secrets: {
      makeWebhookUrl: '',
      zapiInstanceId: '',
      zapiToken: '',
      zapiClientToken: ''
    }
  });

  assert.equal(result.success, false);
  assert.equal(result.provider, 'unconfigured');
  assert.equal(result.outcome, 'permanent_failure');
  assert.doesNotMatch(result.apiResponse, /simulad/i);
});

test('Make só repete rejeição comprovada e respeita Retry-After limitado', async () => {
  const fetchImpl = (async () => new Response('Too many requests', {
    status: 429,
    headers: { 'Retry-After': '120' }
  })) as typeof fetch;

  const result = await sendAutomationPayload(payload, { secrets, fetchImpl });

  assert.equal(result.outcome, 'retryable_failure');
  assert.equal(result.retryAfterSeconds, 120);
  assert.deepEqual(decideProviderExecution({
    outcome: result.outcome,
    attempts: 1,
    retryAfterSeconds: result.retryAfterSeconds
  }), { action: 'retry', reason: 'retryable_failure', delaySeconds: 120 });
  assert.deepEqual(decideProviderExecution({
    outcome: result.outcome,
    attempts: 3
  }), { action: 'stop', reason: 'retry_exhausted' });

  const queueFull = await sendAutomationPayload(payload, {
    secrets,
    fetchImpl: (async () => new Response('Queue is full', { status: 400 })) as typeof fetch
  });
  const invalidRequest = await sendAutomationPayload(payload, {
    secrets,
    fetchImpl: (async () => new Response('Invalid payload', { status: 400 })) as typeof fetch
  });
  assert.equal(queueFull.outcome, 'retryable_failure');
  assert.equal(invalidRequest.outcome, 'permanent_failure');
});

test('Z-API 2xx sem identificador não comprova entrada na fila e não é repetido', async () => {
  const fetchImpl = (async () => Response.json({}, { status: 200 })) as typeof fetch;
  const result = await sendAutomationPayload(payload, {
    secrets: { ...secrets, makeWebhookUrl: '' },
    fetchImpl
  });

  assert.equal(result.success, false);
  assert.equal(result.provider, 'zapi');
  assert.equal(result.outcome, 'ambiguous_failure');
  assert.deepEqual(decideProviderExecution({
    outcome: result.outcome,
    attempts: 1
  }), { action: 'stop', reason: 'ambiguous_failure' });
});

test('política separa aceitação, rejeição recuperável, falha e ambiguidade', () => {
  assert.equal(classifyProviderHttpResponse('make', 202), 'accepted');
  assert.equal(classifyProviderHttpResponse('make', 400), 'permanent_failure');
  assert.equal(classifyProviderHttpResponse('make', 429), 'retryable_failure');
  assert.equal(classifyProviderHttpResponse('zapi', 429), 'retryable_failure');
  assert.equal(classifyProviderHttpResponse('zapi', 401), 'permanent_failure');
  assert.equal(classifyProviderHttpResponse('make', 503), 'ambiguous_failure');
  assert.equal(parseRetryAfterSeconds('7200'), 3600);
});

test('monitor operacional separa fila atrasada, retry e claim abandonado', () => {
  const now = new Date('2026-08-05T12:00:00.000Z');
  const execution = (
    id: string,
    overrides: Partial<AutomationExecution>
  ): AutomationExecution => ({
    id,
    empresa_id: 'company-1',
    automacao: 'novo_agendamento',
    customer_id: 'customer-1',
    telefone: '5511999998888',
    mensagem: 'Mensagem',
    status: 'pendente',
    tentativas: 0,
    data_execucao: '2026-08-05T12:10:00.000Z',
    created_at: '2026-08-05T11:00:00.000Z',
    updated_at: '2026-08-05T11:59:00.000Z',
    ...overrides
  });
  const executions = [
    execution('stalled', { data_execucao: '2026-08-05T11:50:00.000Z' }),
    execution('retry', {
      data_execucao: '2026-08-05T12:05:00.000Z',
      data_proxima_tentativa: '2026-08-05T12:05:00.000Z'
    }),
    execution('active', {
      status: 'processando',
      claim_expires_at: '2026-08-05T12:02:00.000Z'
    }),
    execution('abandoned', {
      status: 'processando',
      claim_expires_at: '2026-08-05T11:59:00.000Z'
    }),
    execution('ambiguous', {
      status: 'erro_definitivo',
      resposta_api: '[RESULTADO AMBÍGUO] Reenvio bloqueado.'
    }),
    execution('permanent', { status: 'erro_definitivo' })
  ];

  const summary = summarizeAutomationOperations(executions, now);
  assert.equal(summary.operationalStatus, 'critical');
  assert.equal(summary.stalledPendingCount, 1);
  assert.equal(summary.retryScheduledCount, 1);
  assert.equal(summary.activeClaimCount, 1);
  assert.equal(summary.abandonedClaimCount, 1);
  assert.equal(summary.ambiguousCount, 1);
  assert.equal(summary.reconciliationRequiredCount, 2);
  assert.equal(
    classifyAutomationExecutionOperationalState(executions[3], now),
    'abandoned_claim'
  );
});

test('estados operacionais permanecem distintos na persistência e leitura', () => {
  const expected = new Map([
    ['cliente_chegou', 'Cliente chegou'],
    ['em_andamento', 'Em andamento'],
    ['aguardando_aprovacao', 'Aguardando aprovação'],
    ['aguardando_peca', 'Aguardando peça'],
    ['finalizado', 'Concluído'],
    ['entregue', 'Entregue']
  ] as const);

  for (const [frontend, database] of expected) {
    const row = mapFrontendAppointmentToDb({ status: frontend });
    assert.equal(row.status, database);
    assert.equal(mapDbAppointmentToFrontend({
      id: 'a',
      status: database,
      data_agendamento: '2026-07-29',
      hora_agendamento: '10:00:00'
    }).status, frontend);
  }

  assert.equal(mapDbAppointmentToFrontend({
    id: 'legacy',
    status: 'Concluído',
    data_agendamento: '2026-07-29',
    hora_agendamento: '10:00:00'
  }).status, 'finalizado');
});

test('sincronização parcial mantém evento pendente para retry', () => {
  const decision = classifyAutomationEvent({
    event: 'novo_agendamento',
    appointmentId: 'appt-1',
    configurationLoaded: true,
    customersLoaded: false,
    appointmentsLoaded: true,
    vehiclesLoaded: true,
    servicesLoaded: true,
    customerFound: false,
    appointmentFound: true,
    appointmentStatus: 'agendado',
    vehicleFound: true,
    serviceFound: true,
    duplicateExecution: false,
    trigger: dbInstance.automations.find(item => item.event === 'novo_agendamento'),
    phone: ''
  });

  assert.equal(decision.action, 'pendente_retry');
  assert.equal(decision.reason, 'customer_sync_incomplete');
});

test('automação inativa não cria nova execução', async () => {
  const originalAutomations = dbInstance.automations;
  const originalExecutions = dbInstance.executions;
  const originalUseRealSupabase = dbInstance.config.useRealSupabase;
  try {
    dbInstance.config.useRealSupabase = false;
    dbInstance.executions = [];
    dbInstance.automations = originalAutomations.map(item =>
      item.event === 'novo_agendamento' ? { ...item, isActive: false } : { ...item }
    );
    const result = await dbInstance.queueAutomation('novo_agendamento', {
      customer: {
        id: 'customer-inactive',
        name: 'Cliente',
        phone: '5511999998888'
      } as any,
      appointment: {
        id: 'appointment-inactive',
        customerId: 'customer-inactive',
        vehicleId: 'vehicle',
        serviceId: 'service',
        dateTime: '2026-07-29T10:00',
        status: 'agendado',
        value: 100,
        employeeId: 'user',
        notes: ''
      }
    });
    assert.equal(result, null);
    assert.equal(dbInstance.executions.length, 0);
  } finally {
    dbInstance.automations = originalAutomations;
    dbInstance.executions = originalExecutions;
    dbInstance.config.useRealSupabase = originalUseRealSupabase;
  }
});

test('aniversario usa o dia e o ano de America/Sao_Paulo na virada UTC', () => {
  const beforeMidnightInSaoPaulo = new Date('2026-01-01T02:30:00.000Z');
  const afterMidnightInSaoPaulo = new Date('2026-01-01T03:30:00.000Z');

  assert.deepEqual(evaluateBirthday({
    customerId: 'customer-1',
    birthDate: '1990-12-31',
    now: beforeMidnightInSaoPaulo
  }), {
    eligible: true,
    reason: 'eligible',
    deduplicationKey: 'aniversario:customer-1:2025',
    referenceYear: '2025'
  });
  assert.equal(evaluateBirthday({
    customerId: 'customer-1',
    birthDate: '1990-12-31',
    now: afterMidnightInSaoPaulo
  }).eligible, false);
  assert.equal(
    buildBirthdayDeduplicationKey('customer-1', beforeMidnightInSaoPaulo),
    'aniversario:customer-1:2025'
  );
  assert.equal(
    buildBirthdayDeduplicationKey('customer-1', afterMidnightInSaoPaulo),
    'aniversario:customer-1:2026'
  );
});

test('data de aniversario ausente, malformada ou impossivel nao e elegivel', () => {
  assert.equal(parseBirthdayDate(), null);
  assert.equal(parseBirthdayDate('1990-2-03'), null);
  assert.equal(parseBirthdayDate('1990-02-30'), null);
  assert.equal(parseBirthdayDate('1900-02-29'), null);
  assert.deepEqual(parseBirthdayDate('2000-02-29'), { year: 2000, month: 2, day: 29 });

  assert.deepEqual(evaluateBirthday({
    customerId: 'customer-1',
    birthDate: '',
    now: new Date('2028-02-29T15:00:00.000Z')
  }), { eligible: false, reason: 'missing_birth_date' });
  assert.deepEqual(evaluateBirthday({
    customerId: 'customer-1',
    birthDate: '1990-02-30',
    now: new Date('2028-02-29T15:00:00.000Z')
  }), { eligible: false, reason: 'invalid_birth_date' });
  assert.deepEqual(evaluateBirthday({
    customerId: 'customer-1',
    birthDate: '2090-02-28',
    now: new Date('2028-02-28T15:00:00.000Z')
  }), { eligible: false, reason: 'invalid_birth_date' });
});

test('29 de fevereiro dispara somente no dia exato de ano bissexto', () => {
  assert.equal(evaluateBirthday({
    customerId: 'customer-1',
    birthDate: '2000-02-29',
    now: new Date('2028-02-29T15:00:00.000Z')
  }).eligible, true);
  assert.deepEqual(evaluateBirthday({
    customerId: 'customer-1',
    birthDate: '2000-02-29',
    now: new Date('2027-02-28T15:00:00.000Z')
  }), { eligible: false, reason: 'not_birthday_today' });
});

test('guarda de aniversario adia falha e cancela data ou ano divergentes', () => {
  const now = new Date('2026-08-05T15:00:00.000Z');

  assert.deepEqual(evaluateBirthdayExecution({
    customerLoadFailed: true,
    customerId: 'customer-1'
  }), { action: 'retry', reason: 'customer_load_failed' });
  assert.deepEqual(evaluateBirthdayExecution({
    customerFound: false,
    customerId: 'customer-1'
  }), { action: 'cancel', reason: 'customer_missing' });
  assert.deepEqual(evaluateBirthdayExecution({
    customerFound: true,
    customerId: 'customer-1',
    birthDate: '1990-08-04',
    executionDeduplicationKey: 'aniversario:customer-1:2026',
    now
  }), { action: 'cancel', reason: 'not_birthday_today' });
  assert.deepEqual(evaluateBirthdayExecution({
    customerFound: true,
    customerId: 'customer-1',
    birthDate: '1990-08-05',
    executionDeduplicationKey: 'aniversario:customer-1:2025',
    now
  }), { action: 'cancel', reason: 'deduplication_key_mismatch' });
  assert.deepEqual(evaluateBirthdayExecution({
    customerFound: true,
    customerId: 'customer-1',
    birthDate: '1990-08-05',
    executionDeduplicationKey: 'aniversario:customer-1:2026',
    now
  }), { action: 'send', reason: 'eligible' });
});

test('ciclos repetidos criam uma unica execucao anual de aniversario', async () => {
  const originalCustomers = dbInstance.customers;
  const originalAutomations = dbInstance.automations;
  const originalExecutions = dbInstance.executions;
  const originalUseRealSupabase = dbInstance.config.useRealSupabase;

  try {
    const current = getPartsInTimezone(new Date(), 'America/Sao_Paulo');
    dbInstance.config.useRealSupabase = false;
    dbInstance.customers = [{
      id: 'birthday-customer',
      name: 'Cliente',
      phone: '5511999998888',
      whatsapp: '5511999998888',
      birthDate: `1990-${current.month}-${current.day}`
    } as any];
    dbInstance.executions = [];
    dbInstance.automations = originalAutomations.map(trigger =>
      trigger.event === 'aniversario'
        ? { ...trigger, isActive: true }
        : { ...trigger, isActive: false }
    );

    const engine = new AutomationEngine();
    const firstCount = await (engine as any).scanAndGenerateExecutions([]);
    const secondCount = await (engine as any).scanAndGenerateExecutions([]);

    assert.equal(firstCount, 1);
    assert.equal(secondCount, 0);
    assert.equal(dbInstance.executions.length, 1);
    assert.equal(
      dbInstance.executions[0].deduplication_key,
      `aniversario:birthday-customer:${current.year}`
    );
  } finally {
    dbInstance.customers = originalCustomers;
    dbInstance.automations = originalAutomations;
    dbInstance.executions = originalExecutions;
    dbInstance.config.useRealSupabase = originalUseRealSupabase;
  }
});

test('automação desativada depois da fila é cancelada antes do envio', () => {
  const queuedTrigger = dbInstance.automations.find(
    item => item.event === 'novo_agendamento'
  );
  assert.ok(queuedTrigger);
  const decision = classifyQueuedAutomation(
    { ...queuedTrigger, isActive: false },
    'Mensagem já renderizada na fila'
  );
  assert.deepEqual(decision, {
    action: 'cancel',
    reason: 'missing_or_inactive'
  });
});

test('patch por automação preserva edições concorrentes em itens diferentes', () => {
  const base: AutomationTrigger[] = [
    {
      id: 'a',
      name: 'A',
      description: '',
      event: 'novo_cliente',
      isActive: true,
      template: 'A'
    },
    {
      id: 'b',
      name: 'B',
      description: '',
      event: 'novo_agendamento',
      isActive: true,
      template: 'B'
    }
  ];
  const patchA = sanitizeAutomationConfigPatch({ isActive: false });
  const patchB = sanitizeAutomationConfigPatch({ template: 'B customizado' });
  assert.ok(patchA);
  assert.ok(patchB);

  const afterA = applyAutomationConfigPatch(base, 'a', patchA);
  assert.ok(afterA);
  const afterB = applyAutomationConfigPatch(afterA, 'b', patchB);
  assert.ok(afterB);
  assert.equal(afterB[0].isActive, false);
  assert.equal(afterB[1].template, 'B customizado');
});

test('lembrete usa uma chave estável para o mesmo horário e outra após reagendamento', () => {
  const first = buildReminderDeduplicationKey('appointment-1', '2026-08-06T09:30:00');
  const same = buildReminderDeduplicationKey('appointment-1', '2026-08-06T09:30');
  const rescheduled = buildReminderDeduplicationKey('appointment-1', '2026-08-06T11:00');

  assert.equal(first, 'lembrete_agendamento:appointment-1:2026-08-06T09:30');
  assert.equal(same, first);
  assert.notEqual(rescheduled, first);
  assert.equal(
    buildReminderScheduleFromDatabase('2026-08-06', '09:30:00'),
    '2026-08-06T09:30'
  );
});

test('somente agendamento ou confirmação podem receber lembrete', () => {
  assert.equal(isReminderAppointmentEligible('Agendado'), true);
  assert.equal(isReminderAppointmentEligible('Confirmado'), true);
  for (const status of [
    'Cliente chegou',
    'Em andamento',
    'Finalizado',
    'Entregue',
    'Cancelado'
  ]) {
    assert.equal(isReminderAppointmentEligible(status), false);
  }
});

test('guarda pré-envio cancela horário antigo e aceita somente a chave atual', () => {
  const currentKey = buildReminderDeduplicationKey(
    'appointment-1',
    '2026-08-06T11:00'
  );
  const oldKey = buildReminderDeduplicationKey(
    'appointment-1',
    '2026-08-06T09:30'
  );

  assert.deepEqual(evaluateReminderExecution({
    appointmentId: 'appointment-1',
    executionDeduplicationKey: oldKey,
    appointmentFound: true,
    appointmentStatus: 'confirmado',
    currentSchedule: '2026-08-06T11:00'
  }), { action: 'cancel', reason: 'schedule_changed' });

  assert.deepEqual(evaluateReminderExecution({
    appointmentId: 'appointment-1',
    executionDeduplicationKey: currentKey,
    appointmentFound: true,
    appointmentStatus: 'confirmado',
    currentSchedule: '2026-08-06T11:00:00'
  }), { action: 'send', reason: 'eligible' });
});

test('guarda pré-envio cancela estados encerrados e adia falha de leitura', () => {
  const key = buildReminderDeduplicationKey('appointment-1', '2026-08-06T09:30');
  for (const status of ['cancelado', 'finalizado', 'entregue']) {
    assert.deepEqual(evaluateReminderExecution({
      appointmentId: 'appointment-1',
      executionDeduplicationKey: key,
      appointmentFound: true,
      appointmentStatus: status,
      currentSchedule: '2026-08-06T09:30'
    }), { action: 'cancel', reason: 'appointment_not_eligible' });
  }

  assert.deepEqual(evaluateReminderExecution({
    appointmentId: 'appointment-1',
    executionDeduplicationKey: key,
    appointmentFound: false,
    appointmentLoadFailed: true
  }), { action: 'retry', reason: 'appointment_load_failed' });
});

test('cliente inativo considera somente serviços finalizados ou entregues', () => {
  const decision = evaluateInactiveCustomer({
    customerId: 'customer-1',
    appointments: [
      { id: 'cancelled', status: 'cancelado', dateTime: '2026-06-01T10:00' },
      { id: 'scheduled', status: 'agendado', dateTime: '2026-06-02T10:00' }
    ],
    inactiveDays: 30,
    minServices: 0,
    now: new Date('2026-08-05T12:00:00.000Z')
  });

  assert.deepEqual(decision, {
    eligible: false,
    reason: 'no_completed_service',
    completedCount: 0
  });
});

test('data local do cliente inativo é interpretada no fuso de São Paulo', () => {
  assert.equal(
    new Date(parseInactiveCustomerDateTime('2026-08-05T10:00')).toISOString(),
    '2026-08-05T13:00:00.000Z'
  );
  assert.equal(
    new Date(parseInactiveCustomerDateTime('2026-08-05T10:00:00.000Z')).toISOString(),
    '2026-08-05T10:00:00.000Z'
  );
});

test('cliente inativo respeita mínimo de atendimentos concluídos', () => {
  const decision = evaluateInactiveCustomer({
    customerId: 'customer-1',
    appointments: [
      { id: 'completed-1', status: 'finalizado', dateTime: '2026-06-01T10:00:00.000Z' }
    ],
    inactiveDays: 30,
    minServices: 2,
    now: new Date('2026-08-05T12:00:00.000Z')
  });

  assert.equal(decision.eligible, false);
  assert.equal(decision.reason, 'minimum_services_not_reached');
  assert.equal(decision.completedCount, 1);
});

test('cliente inativo não entra na fila antes dos dias configurados', () => {
  const decision = evaluateInactiveCustomer({
    customerId: 'customer-1',
    appointments: [
      { id: 'completed-1', status: 'finalizado', dateTime: '2026-07-20T10:00:00.000Z' }
    ],
    inactiveDays: 30,
    minServices: 1,
    now: new Date('2026-08-05T12:00:00.000Z')
  });

  assert.equal(decision.eligible, false);
  assert.equal(decision.reason, 'inactivity_period_not_reached');
});

test('cliente inativo usa o último serviço concluído e uma chave por ciclo', () => {
  const decision = evaluateInactiveCustomer({
    customerId: 'customer-1',
    appointments: [
      { id: 'completed-1', status: 'finalizado', dateTime: '2026-05-01T10:00:00.000Z' },
      { id: 'completed-2', status: 'entregue', dateTime: '2026-06-01T10:00:00.000Z' },
      { id: 'cancelled-future', status: 'cancelado', dateTime: '2026-08-06T10:00:00.000Z' }
    ],
    inactiveDays: 30,
    minServices: 2,
    now: new Date('2026-08-05T12:00:00.000Z')
  });

  assert.equal(decision.eligible, true);
  if (!decision.eligible) return;
  assert.equal(decision.completedCount, 2);
  assert.equal(decision.lastCompletedAppointment.id, 'completed-2');
  assert.equal(
    decision.deduplicationKey,
    'cliente_inativo:customer-1:completed-2:etapa:1'
  );
  assert.equal(
    decision.cycleKey,
    'cliente_inativo:customer-1:completed-2'
  );
  assert.equal(
    buildInactiveCustomerDeduplicationKey('customer-1', 'completed-2'),
    decision.deduplicationKey
  );
  assert.equal(
    buildInactiveCustomerCycleKey('customer-1', 'completed-2'),
    decision.cycleKey
  );
});

test('retorno futuro ou atendimento ativo bloqueiam cliente inativo', () => {
  const baseAppointment = {
    id: 'completed-1',
    status: 'finalizado' as const,
    dateTime: '2026-06-01T10:00:00.000Z'
  };
  const futureDecision = evaluateInactiveCustomer({
    customerId: 'customer-1',
    appointments: [
      baseAppointment,
      { id: 'future', status: 'confirmado', dateTime: '2026-08-06T10:00:00.000Z' }
    ],
    inactiveDays: 30,
    minServices: 1,
    now: new Date('2026-08-05T12:00:00.000Z')
  });
  const activeDecision = evaluateInactiveCustomer({
    customerId: 'customer-1',
    appointments: [
      baseAppointment,
      { id: 'active', status: 'em_andamento', dateTime: '2026-08-05T09:00:00.000Z' }
    ],
    inactiveDays: 30,
    minServices: 1,
    now: new Date('2026-08-05T12:00:00.000Z')
  });

  assert.equal(futureDecision.reason, 'future_appointment');
  assert.equal(activeDecision.reason, 'active_service');
});

test('guarda de cliente inativo adia falha e cancela mudança de ciclo', () => {
  const eligibleDecision = evaluateInactiveCustomer({
    customerId: 'customer-1',
    appointments: [
      { id: 'completed-2', status: 'entregue', dateTime: '2026-06-01T10:00:00.000Z' }
    ],
    inactiveDays: 30,
    minServices: 1,
    now: new Date('2026-08-05T12:00:00.000Z')
  });

  assert.deepEqual(evaluateInactiveCustomerExecution({
    appointmentLoadFailed: true
  }), { action: 'retry', reason: 'appointments_load_failed' });
  assert.deepEqual(evaluateInactiveCustomerExecution({
    executionDeduplicationKey: 'cliente_inativo:customer-1:completed-1',
    customerDecision: eligibleDecision
  }), { action: 'cancel', reason: 'inactivity_episode_changed' });

  assert.equal(eligibleDecision.eligible, true);
  if (!eligibleDecision.eligible) return;
  assert.deepEqual(evaluateInactiveCustomerExecution({
    executionDeduplicationKey: eligibleDecision.deduplicationKey,
    customerDecision: eligibleDecision
  }), { action: 'send', reason: 'eligible' });
});

test('cadência de cliente inativo cria etapas nos dias 0, 7 e 21', () => {
  const appointments = [{
    id: 'completed-1',
    status: 'finalizado' as const,
    dateTime: '2026-01-01T10:00:00.000Z',
    createdAt: '2026-01-01T09:00:00.000Z'
  }];
  const customerDecision = evaluateInactiveCustomer({
    customerId: 'customer-1',
    appointments,
    inactiveDays: 30,
    minServices: 1,
    now: new Date('2026-08-01T12:00:00.000Z')
  });
  assert.equal(customerDecision.eligible, true);
  if (!customerDecision.eligible) return;

  assert.deepEqual(evaluateInactiveCustomerCadence({
    customerDecision,
    appointments,
    executions: [],
    now: new Date('2026-08-01T12:00:00.000Z')
  }), {
    action: 'queue',
    reason: 'stage_due',
    stage: 1,
    deduplicationKey: 'cliente_inativo:customer-1:completed-1:etapa:1'
  });

  const first = {
    deduplication_key: 'cliente_inativo:customer-1:completed-1:etapa:1',
    status: 'sucesso' as const,
    created_at: '2026-07-30T12:00:00.000Z',
    updated_at: '2026-08-01T12:00:00.000Z'
  };
  assert.deepEqual(evaluateInactiveCustomerCadence({
    customerDecision,
    appointments,
    executions: [first],
    now: new Date('2026-08-08T11:59:59.999Z')
  }), { action: 'wait', reason: 'follow_up_not_due' });
  assert.deepEqual(evaluateInactiveCustomerCadence({
    customerDecision,
    appointments,
    executions: [first],
    now: new Date('2026-08-08T12:00:00.000Z')
  }), {
    action: 'queue',
    reason: 'stage_due',
    stage: 2,
    deduplicationKey: 'cliente_inativo:customer-1:completed-1:etapa:2'
  });

  const second = {
    deduplication_key: 'cliente_inativo:customer-1:completed-1:etapa:2',
    status: 'sucesso' as const,
    created_at: '2026-08-08T12:00:00.000Z',
    updated_at: '2026-08-08T12:00:00.000Z'
  };
  assert.deepEqual(evaluateInactiveCustomerCadence({
    customerDecision,
    appointments,
    executions: [first, second],
    now: new Date('2026-08-22T11:59:59.999Z')
  }), { action: 'wait', reason: 'follow_up_not_due' });
  assert.deepEqual(evaluateInactiveCustomerCadence({
    customerDecision,
    appointments,
    executions: [first, second],
    now: new Date('2026-08-22T12:00:00.000Z')
  }), {
    action: 'queue',
    reason: 'stage_due',
    stage: 3,
    deduplicationKey: 'cliente_inativo:customer-1:completed-1:etapa:3'
  });
});

test('cadência exige aceitação da etapa anterior e encerra depois da terceira', () => {
  const appointments = [{
    id: 'completed-1',
    status: 'entregue' as const,
    dateTime: '2026-01-01T10:00:00.000Z',
    createdAt: '2026-01-01T09:00:00.000Z'
  }];
  const customerDecision = evaluateInactiveCustomer({
    customerId: 'customer-1',
    appointments,
    inactiveDays: 30,
    minServices: 1,
    now: new Date('2026-08-22T12:00:00.000Z')
  });
  assert.equal(customerDecision.eligible, true);
  if (!customerDecision.eligible) return;

  const first = {
    deduplication_key: `${customerDecision.cycleKey}:etapa:1`,
    status: 'sucesso' as const,
    created_at: '2026-08-01T12:00:00.000Z',
    updated_at: '2026-08-01T12:00:00.000Z'
  };
  const pendingSecond = {
    deduplication_key: `${customerDecision.cycleKey}:etapa:2`,
    status: 'pendente' as const,
    created_at: '2026-08-08T12:00:00.000Z',
    updated_at: '2026-08-08T12:00:00.000Z'
  };
  assert.deepEqual(evaluateInactiveCustomerCadence({
    customerDecision,
    appointments,
    executions: [first, pendingSecond],
    now: new Date('2026-08-22T12:00:00.000Z')
  }), { action: 'wait', reason: 'previous_stage_not_accepted' });

  const acceptedSecond = { ...pendingSecond, status: 'sucesso' as const };
  const third = {
    deduplication_key: `${customerDecision.cycleKey}:etapa:3`,
    status: 'sucesso' as const,
    created_at: '2026-08-22T12:00:00.000Z',
    updated_at: '2026-08-22T12:00:00.000Z'
  };
  assert.deepEqual(evaluateInactiveCustomerCadence({
    customerDecision,
    appointments,
    executions: [first, acceptedSecond, third],
    now: new Date('2026-09-30T12:00:00.000Z')
  }), { action: 'wait', reason: 'sequence_complete' });
});

test('terceira etapa mantém sete dias de intervalo quando a segunda atrasa', () => {
  const appointments = [{
    id: 'completed-1',
    status: 'finalizado' as const,
    dateTime: '2026-01-01T10:00:00.000Z',
    createdAt: '2026-01-01T09:00:00.000Z'
  }];
  const customerDecision = evaluateInactiveCustomer({
    customerId: 'customer-1',
    appointments,
    inactiveDays: 30,
    minServices: 1,
    now: new Date('2026-08-29T12:00:00.000Z')
  });
  assert.equal(customerDecision.eligible, true);
  if (!customerDecision.eligible) return;

  const first = {
    deduplication_key: `${customerDecision.cycleKey}:etapa:1`,
    status: 'sucesso' as const,
    created_at: '2026-08-01T12:00:00.000Z',
    updated_at: '2026-08-01T12:00:00.000Z'
  };
  const delayedSecond = {
    deduplication_key: `${customerDecision.cycleKey}:etapa:2`,
    status: 'sucesso' as const,
    created_at: '2026-08-22T12:00:00.000Z',
    updated_at: '2026-08-22T12:00:00.000Z'
  };

  assert.deepEqual(evaluateInactiveCustomerCadence({
    customerDecision,
    appointments,
    executions: [first, delayedSecond],
    now: new Date('2026-08-29T11:59:59.999Z')
  }), { action: 'wait', reason: 'follow_up_not_due' });
  assert.deepEqual(evaluateInactiveCustomerCadence({
    customerDecision,
    appointments,
    executions: [first, delayedSecond],
    now: new Date('2026-08-29T12:00:00.000Z')
  }), {
    action: 'queue',
    reason: 'stage_due',
    stage: 3,
    deduplicationKey: `${customerDecision.cycleKey}:etapa:3`
  });
  assert.deepEqual(evaluateInactiveCustomerExecution({
    executionDeduplicationKey: `${customerDecision.cycleKey}:etapa:3`,
    customerDecision,
    appointments,
    executions: [first, delayedSecond],
    now: new Date('2026-08-29T11:59:59.999Z')
  }), { action: 'cancel', reason: 'follow_up_not_due' });
});

test('histórico legado não recebe acompanhamento retroativo', () => {
  const appointments = [{
    id: 'completed-1',
    status: 'finalizado' as const,
    dateTime: '2025-01-01T10:00:00.000Z'
  }];
  const customerDecision = evaluateInactiveCustomer({
    customerId: 'customer-1',
    appointments,
    inactiveDays: 30,
    minServices: 1,
    now: new Date('2026-08-22T12:00:00.000Z')
  });
  assert.equal(customerDecision.eligible, true);
  if (!customerDecision.eligible) return;

  assert.deepEqual(evaluateInactiveCustomerCadence({
    customerDecision,
    appointments,
    executions: [{
      deduplication_key: customerDecision.cycleKey,
      status: 'sucesso',
      created_at: '2025-02-01T12:00:00.000Z',
      updated_at: '2025-02-01T12:00:00.000Z'
    }],
    now: new Date('2026-08-22T12:00:00.000Z')
  }), { action: 'wait', reason: 'legacy_cycle' });
});

test('agendamento posterior interrompe a sequência de cliente inativo', () => {
  const completed = {
    id: 'completed-1',
    status: 'finalizado' as const,
    dateTime: '2026-01-01T10:00:00.000Z',
    createdAt: '2026-01-01T09:00:00.000Z'
  };
  const customerDecision = evaluateInactiveCustomer({
    customerId: 'customer-1',
    appointments: [completed],
    inactiveDays: 30,
    minServices: 1,
    now: new Date('2026-08-22T12:00:00.000Z')
  });
  assert.equal(customerDecision.eligible, true);
  if (!customerDecision.eligible) return;

  const first = {
    deduplication_key: `${customerDecision.cycleKey}:etapa:1`,
    status: 'sucesso' as const,
    created_at: '2026-08-01T12:00:00.000Z',
    updated_at: '2026-08-01T12:00:00.000Z'
  };
  const appointmentAfterFirst = {
    id: 'scheduled-after-first',
    status: 'cancelado' as const,
    dateTime: '2026-08-10T10:00:00.000Z',
    createdAt: '2026-08-02T12:00:00.000Z'
  };

  assert.deepEqual(evaluateInactiveCustomerCadence({
    customerDecision,
    appointments: [completed, appointmentAfterFirst],
    executions: [first],
    now: new Date('2026-08-22T12:00:00.000Z')
  }), { action: 'wait', reason: 'appointment_after_first_message' });
  assert.deepEqual(evaluateInactiveCustomerExecution({
    executionDeduplicationKey: `${customerDecision.cycleKey}:etapa:2`,
    customerDecision,
    appointments: [completed, appointmentAfterFirst],
    executions: [first],
    now: new Date('2026-08-22T12:00:00.000Z')
  }), { action: 'cancel', reason: 'appointment_after_first_message' });
});

test('ciclos repetidos criam uma única execução por etapa de inatividade', async () => {
  const originalCustomers = dbInstance.customers;
  const originalAppointments = dbInstance.appointments;
  const originalVehicles = dbInstance.vehicles;
  const originalServices = dbInstance.services;
  const originalAutomations = dbInstance.automations;
  const originalExecutions = dbInstance.executions;
  const originalUseRealSupabase = dbInstance.config.useRealSupabase;

  try {
    dbInstance.config.useRealSupabase = false;
    dbInstance.customers = [{
      id: 'inactive-customer',
      name: 'Cliente',
      phone: '5511999998888',
      whatsapp: '5511999998888'
    } as any];
    dbInstance.vehicles = [{
      id: 'vehicle-1',
      customerId: 'inactive-customer',
      brand: 'Marca',
      model: 'Modelo'
    } as any];
    dbInstance.services = [{ id: 'service-1', name: 'Serviço' } as any];
    dbInstance.appointments = [{
      id: 'completed-1',
      customerId: 'inactive-customer',
      vehicleId: 'vehicle-1',
      serviceId: 'service-1',
      dateTime: '2020-01-01T10:00',
      status: 'finalizado',
      value: 100,
      employeeId: 'user',
      notes: ''
    }];
    dbInstance.executions = [];
    dbInstance.automations = originalAutomations.map(trigger =>
      trigger.event === 'cliente_inativo'
        ? { ...trigger, isActive: true, inactiveDays: 30, minServices: 1 }
        : { ...trigger, isActive: false }
    );

    const engine = new AutomationEngine();
    const firstCount = await (engine as any).scanAndGenerateExecutions([]);
    const secondCount = await (engine as any).scanAndGenerateExecutions([]);

    assert.equal(firstCount, 1);
    assert.equal(secondCount, 0);
    assert.equal(dbInstance.executions.length, 1);
    assert.equal(
      dbInstance.executions[0].deduplication_key,
      'cliente_inativo:inactive-customer:completed-1:etapa:1'
    );
  } finally {
    dbInstance.customers = originalCustomers;
    dbInstance.appointments = originalAppointments;
    dbInstance.vehicles = originalVehicles;
    dbInstance.services = originalServices;
    dbInstance.automations = originalAutomations;
    dbInstance.executions = originalExecutions;
    dbInstance.config.useRealSupabase = originalUseRealSupabase;
  }
});

test('scanner agenda a segunda etapa uma vez após sete dias da primeira aceita', async () => {
  const originalCustomers = dbInstance.customers;
  const originalAppointments = dbInstance.appointments;
  const originalVehicles = dbInstance.vehicles;
  const originalServices = dbInstance.services;
  const originalAutomations = dbInstance.automations;
  const originalExecutions = dbInstance.executions;
  const originalUseRealSupabase = dbInstance.config.useRealSupabase;

  try {
    const firstAcceptedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    dbInstance.config.useRealSupabase = false;
    dbInstance.customers = [{
      id: 'inactive-follow-up',
      name: 'Cliente',
      phone: '5511999997777',
      whatsapp: '5511999997777'
    } as any];
    dbInstance.vehicles = [{
      id: 'vehicle-1',
      customerId: 'inactive-follow-up',
      brand: 'Marca',
      model: 'Modelo'
    } as any];
    dbInstance.services = [{ id: 'service-1', name: 'Serviço' } as any];
    dbInstance.appointments = [{
      id: 'completed-1',
      customerId: 'inactive-follow-up',
      vehicleId: 'vehicle-1',
      serviceId: 'service-1',
      dateTime: '2020-01-01T10:00',
      status: 'finalizado',
      value: 100,
      employeeId: 'user',
      notes: '',
      createdAt: '2020-01-01T09:00:00.000Z'
    }];
    dbInstance.executions = [{
      id: 'inactive-stage-1',
      empresa_id: 'c0000000-0000-0000-0000-000000000000',
      automacao: 'cliente_inativo',
      appointment_id: 'completed-1',
      customer_id: 'inactive-follow-up',
      telefone: '5511999997777',
      mensagem: 'Mensagem',
      status: 'sucesso',
      tentativas: 1,
      deduplication_key: 'cliente_inativo:inactive-follow-up:completed-1:etapa:1',
      data_execucao: firstAcceptedAt,
      created_at: firstAcceptedAt,
      updated_at: firstAcceptedAt
    }];
    dbInstance.automations = originalAutomations.map(trigger =>
      trigger.event === 'cliente_inativo'
        ? { ...trigger, isActive: true, inactiveDays: 30, minServices: 1 }
        : { ...trigger, isActive: false }
    );

    const engine = new AutomationEngine();
    const firstCount = await (engine as any).scanAndGenerateExecutions([]);
    const secondCount = await (engine as any).scanAndGenerateExecutions([]);

    assert.equal(firstCount, 1);
    assert.equal(secondCount, 0);
    assert.equal(dbInstance.executions.length, 2);
    assert.equal(
      dbInstance.executions[1].deduplication_key,
      'cliente_inativo:inactive-follow-up:completed-1:etapa:2'
    );
  } finally {
    dbInstance.customers = originalCustomers;
    dbInstance.appointments = originalAppointments;
    dbInstance.vehicles = originalVehicles;
    dbInstance.services = originalServices;
    dbInstance.automations = originalAutomations;
    dbInstance.executions = originalExecutions;
    dbInstance.config.useRealSupabase = originalUseRealSupabase;
  }
});

test('orçamento renderiza itens, total, validade e número sem mensagem vazia', () => {
  const message = renderAndNormalizeMessage(
    'Orçamento #{orcamento_numero}\n{orcamento_itens}\nR$ {orcamento_total}\n{orcamento_validade}',
    {
      customer: { id: 'c1', name: 'Carlos', phone: '5511999999999' } as any,
      budget: {
        id: 'b1',
        number: 42,
        customerId: 'c1',
        status: 'enviado',
        subtotal: 200,
        discount: 20,
        total: 180,
        validUntil: '2026-09-30',
        notes: '',
        sentAt: '2026-08-01T12:00:00.000Z',
        createdAt: '2026-08-01T12:00:00.000Z',
        updatedAt: '2026-08-01T12:00:00.000Z',
        items: [{ id: 'i1', budgetId: 'b1', description: 'Polimento', quantity: 2, unitPrice: 100, total: 200 }]
      }
    }
  );
  assert.match(message, /Orçamento #42/);
  assert.match(message, /2x Polimento/);
  assert.match(message, /R\$ 180\.00/);
  assert.match(message, /30\/09\/2026/);
});

test('orçamento agenda acompanhamentos nos dias 7 e 14 e deduplica cada etapa', () => {
  const budget = {
    id: 'budget-1',
    customerId: 'customer-1',
    status: 'enviado' as const,
    subtotal: 100,
    discount: 0,
    total: 100,
    validUntil: '2026-12-31',
    notes: '',
    sentAt: '2026-08-01T12:00:00.000Z',
    createdAt: '2026-08-01T12:00:00.000Z',
    updatedAt: '2026-08-01T12:00:00.000Z',
    items: []
  };
  const initial = {
    id: 'initial',
    automacao: 'orcamento_enviado',
    customer_id: 'customer-1',
    status: 'sucesso' as const,
    deduplication_key: buildBudgetDeduplicationKey('orcamento_enviado', budget.id),
    updated_at: '2026-08-01T12:00:00.000Z'
  } as AutomationExecution;

  assert.equal(evaluateBudgetAutomation({
    event: 'orcamento_followup_7d', budget, appointments: [], executions: [initial],
    now: new Date('2026-08-08T12:00:00.000Z')
  }).action, 'queue');
  assert.equal(evaluateBudgetAutomation({
    event: 'orcamento_followup_14d', budget, appointments: [], executions: [initial],
    now: new Date('2026-08-08T12:00:00.000Z')
  }).action, 'wait');

  const stage7 = {
    ...initial,
    id: 'stage7',
    automacao: 'orcamento_followup_7d',
    deduplication_key: buildBudgetDeduplicationKey('orcamento_followup_7d', budget.id),
    updated_at: '2026-08-08T12:00:00.000Z'
  };
  assert.equal(evaluateBudgetAutomation({
    event: 'orcamento_followup_14d', budget, appointments: [], executions: [initial, stage7],
    now: new Date('2026-08-15T12:00:00.000Z')
  }).action, 'queue');
  assert.equal(evaluateBudgetAutomation({
    event: 'orcamento_followup_7d', budget, appointments: [], executions: [initial, stage7],
    now: new Date('2026-08-09T12:00:00.000Z')
  }).action, 'cancel');
});

test('orçamento interrompe acompanhamentos por status ou agendamento posterior', () => {
  const budget = {
    id: 'budget-2', customerId: 'customer-2', status: 'enviado' as const,
    subtotal: 100, discount: 0, total: 100, validUntil: '2026-12-31', notes: '',
    sentAt: '2026-08-01T12:00:00.000Z', createdAt: '2026-08-01T12:00:00.000Z',
    updatedAt: '2026-08-01T12:00:00.000Z', items: []
  };
  const initial = {
    id: 'initial-2', status: 'sucesso' as const,
    deduplication_key: buildBudgetDeduplicationKey('orcamento_enviado', budget.id),
    updated_at: '2026-08-01T12:00:00.000Z'
  } as AutomationExecution;
  const appointment = {
    id: 'appointment-after', customerId: 'customer-2', createdAt: '2026-08-02T12:00:00.000Z'
  } as any;
  assert.deepEqual(evaluateBudgetAutomation({
    event: 'orcamento_followup_7d', budget, appointments: [appointment], executions: [initial],
    now: new Date('2026-08-08T12:00:00.000Z')
  }), { action: 'cancel', reason: 'appointment_after_budget_send' });
  assert.equal(evaluateBudgetAutomation({
    event: 'orcamento_followup_7d', budget: { ...budget, status: 'aceito' }, appointments: [], executions: [initial],
    now: new Date('2026-08-08T12:00:00.000Z')
  }).action, 'cancel');
});
