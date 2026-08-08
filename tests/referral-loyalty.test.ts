import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const read = (...parts: string[]) => readFileSync(path.resolve(...parts), 'utf8');
const migration = read('supabase', 'migrations', '20260806150000_referral_loyalty_ledger.sql');
const runtime = read('src', 'db', 'localDb.ts');
const portal = read('src', 'components', 'ClientPortal.tsx');
const settings = read('src', 'components', 'ConfiguracoesModule.tsx');

test('ledger garante uma única marcação automática por indicado', () => {
  assert.match(migration, /unique index[\s\S]*referred_customer_id[\s\S]*where source = 'referral'/i);
  assert.match(migration, /on conflict \(referred_customer_id\) where source = 'referral' do nothing/i);
  assert.match(migration, /previous\.cliente_id = new\.cliente_id/);
});

test('primeira finalização gera marca para o indicador e não para o indicado', () => {
  assert.match(migration, /referrer_id, 1, 'referral', new\.cliente_id/);
  assert.match(migration, /lower\(coalesce\(new\.status/);
  assert.match(runtime, /awardReferralLoyaltyMark/);
});

test('ajustes manuais são históricos e não permitem saldo negativo', () => {
  assert.match(migration, /admin_adjust_loyalty_mark/);
  assert.match(migration, /p_delta = -1 and current_balance = 0/);
  assert.match(runtime, /source: delta === 1 \? 'manual_add' : 'manual_remove'/);
  assert.match(migration, /if not public\.portal_is_active_staff\(\)/);
  assert.doesNotMatch(migration, /grant execute on function public\.admin_adjust_loyalty_mark[^;]+to anon/);
});

test('runtime atual não oferece nem calcula desconto de indicação', () => {
  const currentRuntime = [runtime, portal, settings].join('\n');
  assert.doesNotMatch(currentRuntime, /referralDiscount|referralBonus|referral_discount_percent/);
  assert.doesNotMatch(portal, /Desconto de Indicação|desconto especial de indicação/i);
});

test('nova migração de validação do código de indicação normaliza maiúsculas, minúsculas e espaços', () => {
  const fixMigration = read('supabase', 'migrations', '20260807213000_fix_referral_code_validation.sql');
  assert.ok(fixMigration.includes('public.portal_validate_referral_code'));
  assert.ok(fixMigration.includes('public.portal_create_cliente'));
  assert.ok(fixMigration.includes('[^a-zA-Z0-9-]'));
  assert.ok(fixMigration.includes("upper(public.portal_customer_metadata(nome)->>'referralCode')"));
  assert.ok(fixMigration.includes('id is distinct from public.portal_current_cliente_id()'));
});
