import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildReminderDeduplicationKey,
  classifyReminderDelivery
} from '../src/db/reminderDeliveryPolicy';

const appointmentId = '30000000-0000-0000-0000-000000000001';
const scheduledFor = '2026-07-31T10:00';
const deduplicationKey = buildReminderDeduplicationKey(
  appointmentId,
  scheduledFor
);
const now = new Date('2026-07-31T12:30:00.000Z'); // 09:30 no Rio/São Paulo

const classify = (
  overrides: Partial<Parameters<typeof classifyReminderDelivery>[0]> = {}
) =>
  classifyReminderDelivery({
    appointmentId,
    deduplicationKey,
    appointmentFound: true,
    appointmentStatus: 'agendado',
    appointmentDateTime: scheduledFor,
    now,
    advanceHours: 1,
    ...overrides
  });

test('envia somente quando o agendamento atual continua ativo, no mesmo horário e na janela', () => {
  assert.deepEqual(classify(), { action: 'send' });
  assert.deepEqual(classify({ appointmentStatus: 'confirmado' }), {
    action: 'send'
  });
});

test('cancela lembrete de agendamento cancelado, iniciado, finalizado ou entregue', () => {
  for (const appointmentStatus of [
    'cancelado',
    'em_andamento',
    'finalizado',
    'entregue'
  ] as const) {
    assert.deepEqual(classify({ appointmentStatus }), {
      action: 'cancel',
      reason: 'appointment_not_active'
    });
  }
});

test('reagendamento invalida a execução antiga e gera chave diferente para o novo horário', () => {
  assert.deepEqual(
    classify({ appointmentDateTime: '2026-07-31T11:00' }),
    { action: 'cancel', reason: 'appointment_rescheduled' }
  );
  assert.notEqual(
    deduplicationKey,
    buildReminderDeduplicationKey(appointmentId, '2026-07-31T11:00')
  );
});

test('bloqueia execução antiga, agendamento ausente e lembrete fora da janela', () => {
  assert.deepEqual(classify({ deduplicationKey: `lembrete_agendamento:${appointmentId}` }), {
    action: 'cancel',
    reason: 'legacy_deduplication_key'
  });
  assert.deepEqual(classify({ appointmentFound: false }), {
    action: 'cancel',
    reason: 'appointment_not_found'
  });
  assert.deepEqual(classify({ now: new Date('2026-07-31T13:01:00.000Z') }), {
    action: 'cancel',
    reason: 'outside_reminder_window'
  });
});

test('falha temporária de leitura adia a execução em vez de enviar sem contexto', () => {
  assert.deepEqual(classify({ appointmentLoadFailed: true }), {
    action: 'retry',
    reason: 'appointment_load_failed'
  });
});

test('worker revalida no Supabase depois do claim e antes do transporte', () => {
  const engine = fs.readFileSync(
    path.join(process.cwd(), 'src', 'db', 'automationEngine.ts'),
    'utf8'
  );
  const revalidationPosition = engine.indexOf(
    'await this.revalidateReminderExecution(exec)'
  );
  const transportPosition = engine.indexOf('await sendAutomationPayload(payloadBody');

  assert.ok(revalidationPosition > 0);
  assert.ok(transportPosition > revalidationPosition);
  assert.match(engine, /\.from\('agendamentos'\)/);
  assert.match(engine, /\.maybeSingle\(\)/);
});
