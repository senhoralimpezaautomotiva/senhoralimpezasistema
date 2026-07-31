import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {
  isWithinReminderWindow,
  parseAppointmentDateTime
} from '../src/utils/operationalWindow';
import { toPublicSystemConfig } from '../src/security/publicConfig';

const projectFile = (...segments: string[]) =>
  fs.readFileSync(path.join(process.cwd(), ...segments), 'utf8');

test('interpreta datetime-local explicitamente em America/Sao_Paulo', () => {
  assert.equal(
    parseAppointmentDateTime('2026-07-31T10:00').toISOString(),
    '2026-07-31T13:00:00.000Z'
  );
  assert.equal(
    parseAppointmentDateTime('2026-07-31T13:00:00.000Z').toISOString(),
    '2026-07-31T13:00:00.000Z'
  );
});

test('aceita janelas configuráveis de 1, 2 e 10 horas sem incluir o passado', () => {
  const now = new Date('2026-07-31T12:00:00.000Z'); // 09:00 em São Paulo

  assert.equal(isWithinReminderWindow('2026-07-31T10:00', now, 1), true);
  assert.equal(isWithinReminderWindow('2026-07-31T10:01', now, 1), false);
  assert.equal(isWithinReminderWindow('2026-07-31T11:00', now, 2), true);
  assert.equal(isWithinReminderWindow('2026-07-31T11:01', now, 2), false);
  assert.equal(isWithinReminderWindow('2026-07-31T19:00', now, 10), true);
  assert.equal(isWithinReminderWindow('2026-07-31T19:01', now, 10), false);
  assert.equal(isWithinReminderWindow('2026-07-31T08:59', now, 10), false);
});

test('valida a antecedência antes de colocá-la no cache público', () => {
  assert.deepEqual(toPublicSystemConfig({ reminderAdvanceHours: 10 }), {
    reminderAdvanceHours: 10
  });
  assert.deepEqual(toPublicSystemConfig({ reminderAdvanceHours: 0 }), {});
  assert.deepEqual(toPublicSystemConfig({ reminderAdvanceHours: 1.5 }), {});
  assert.deepEqual(toPublicSystemConfig({ reminderAdvanceHours: 169 }), {});
});

test('configuração é carregada e salva no Supabase e consumida pelo worker', () => {
  const localDb = projectFile('src', 'db', 'localDb.ts');
  const engine = projectFile('src', 'db', 'automationEngine.ts');
  const migration = projectFile(
    'supabase',
    'migrations',
    '20260731010000_automacoes_lembrete_configuravel.sql'
  );

  assert.match(localDb, /reminder_advance_hours/);
  assert.match(localDb, /reminderAdvanceHours/);
  assert.doesNotMatch(localDb, /60 minutes ahead/);
  assert.match(localDb, /timeZone: AUTOMATION_TIME_ZONE/);
  assert.match(engine, /config\.reminderAdvanceHours/);
  assert.match(engine, /isWithinReminderWindow/);
  assert.match(migration, /reminder_advance_hours INTEGER NOT NULL DEFAULT 1/);
  assert.match(migration, /BETWEEN 1 AND 168/);
});
