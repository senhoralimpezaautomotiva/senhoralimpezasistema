import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const read = (...parts: string[]) => readFileSync(path.resolve(...parts), 'utf8');
const migration = read('supabase', 'migrations', '20260806150000_referral_loyalty_ledger.sql');
const rewardsMigration = read('supabase', 'migrations', '20260817173000_loyalty_service_rewards.sql');
const runtime = read('src', 'db', 'localDb.ts');
const portal = read('src', 'components', 'ClientPortal.tsx');
const portalSupabase = read('src', 'portal', 'portalSupabase.ts');
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

test('cartao fidelidade soma servico proprio elegivel sem alterar regra de indicacao', () => {
  assert.match(rewardsMigration, /source in \('referral', 'own_service', 'reward_redeem', 'manual_add', 'manual_remove'\)/);
  assert.match(rewardsMigration, /create or replace function public\.award_own_service_loyalty_mark\(\)/);
  assert.match(rewardsMigration, /loyalty_is_eligible_own_service\(service_id\)/);
  assert.match(rewardsMigration, /on conflict \(appointment_id\) where source = 'own_service'/);
  assert.match(migration, /on conflict \(referred_customer_id\) where source = 'referral' do nothing/i);
  assert.match(runtime, /awardReferralLoyaltyMark/);
  assert.match(runtime, /awardOwnServiceLoyaltyMark/);
});

test('servicos excluidos nao geram marcacao propria de fidelidade', () => {
  assert.match(rewardsMigration, /polimento\|higienizacao\|motor\|cristalizacao\|vidro\|plastic\|farol\|vitrificacao/);
  assert.match(rewardsMigration, /manutencao e protecao/);
  assert.match(rewardsMigration, /limpeza tecnica/);
  assert.match(runtime, /'polimento'[\s\S]*'higienizacao'[\s\S]*'motor'[\s\S]*'cristalizacao'[\s\S]*'vidro'[\s\S]*'plastic'[\s\S]*'farol'[\s\S]*'vitrificacao'/);
});

test('dez marcacoes geram credito apenas para limpeza de manutencao e protecao e reiniciam ciclo', () => {
  assert.match(rewardsMigration, /create table if not exists public\.loyalty_reward_credits/);
  assert.match(rewardsMigration, /create or replace function public\.issue_loyalty_reward_if_complete\(\)/);
  assert.match(rewardsMigration, /current_balance < 10/);
  assert.match(rewardsMigration, /new\.customer_id,\s*-10,\s*'reward_redeem'/);
  assert.match(rewardsMigration, /loyalty_reward_service_id\(\)/);
  assert.match(rewardsMigration, /limpeza de manutencao e protecao/);
  assert.doesNotMatch(rewardsMigration, /loyalty_reward_service_id\(\)[\s\S]*cristalizacao/i);
});

test('portal carrega e consome credito de fidelidade com servico permitido zerado', () => {
  assert.match(portalSupabase, /client\.rpc\('portal_available_loyalty_credits'\)/);
  assert.match(portal, /loyaltyRewardCredits/);
  assert.match(portal, /availableCreditServiceIds\.has\(s\.id\) \? 0/);
  assert.match(rewardsMigration, /credit\.service_id = any\(p_service_ids\)/);
  assert.match(rewardsMigration, /credit_discount_value := price_row\.preco/);
  assert.match(rewardsMigration, /set status = 'redeemed'/);
  assert.match(rewardsMigration, /INVALID_LOYALTY_CREDIT_SERVICE/);
});
