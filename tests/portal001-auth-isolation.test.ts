import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { normalizeBrazilianPhone } from '../src/portal/portalSupabase';
import { validatePortalPassword } from '../src/portal/auth/portalAuthProvider';

const readPortalFile = (...segments: string[]): string =>
  readFileSync(path.resolve(...segments), 'utf8');

test('normalização de celular usa E.164 brasileiro sem aceitar telefone incompleto', () => {
  assert.equal(normalizeBrazilianPhone('(11) 99999-8888'), '+5511999998888');
  assert.equal(normalizeBrazilianPhone('55 11 99999-8888'), '+5511999998888');
  assert.equal(normalizeBrazilianPhone('9999-8888'), '');
});

test('senha do portal exige comprimento e composição mínimos', () => {
  assert.match(validatePortalPassword('curta1A') || '', /8 caracteres/);
  assert.match(validatePortalPassword('senhasemnumero') || '', /maiúsculas/);
  assert.equal(validatePortalPassword('SenhaForte1'), null);
});

test('cadastro, login, confirmação e recuperação usam e-mail do Supabase Auth', () => {
  const source = readPortalFile('src', 'portal', 'auth', 'emailPasswordAuthProvider.ts');
  assert.match(source, /\.auth\.signUp\(\{\s*email,\s*password/s);
  assert.match(source, /emailRedirectTo:\s*portalRedirectUrl\(false\)/);
  assert.match(source, /\.auth\.signInWithPassword\(\{/);
  assert.match(source, /\.auth\.resetPasswordForEmail\(/);
  assert.match(source, /redirectTo:\s*portalRedirectUrl\(true\)/);
  assert.match(source, /\.auth\.updateUser\(\{\s*password\s*\}\)/);
  assert.doesNotMatch(source, /signInWithOtp|verifyOtp/);
});

test('provedor de autenticação é substituível sem alterar o portal', () => {
  const contract = readPortalFile('src', 'portal', 'auth', 'portalAuthProvider.ts');
  const provider = readPortalFile('src', 'portal', 'auth', 'emailPasswordAuthProvider.ts');
  const gate = readPortalFile('src', 'portal', 'PortalAuthGate.tsx');
  assert.match(contract, /interface PortalAuthProvider/);
  assert.match(contract, /'email_password' \| 'phone_otp'/);
  assert.match(provider, /activePortalAuthProvider/);
  assert.match(gate, /activePortalAuthProvider/);
  assert.doesNotMatch(gate, /\.auth\.signUp|\.auth\.signInWithPassword/);
});

test('sessão do portal é persistente e separada da sessão administrativa', () => {
  const portalClient = readPortalFile('src', 'portal', 'portalSupabase.ts');
  const adminClient = readPortalFile('src', 'db', 'supabaseClient.ts');
  assert.match(portalClient, /storageKey:\s*PORTAL_AUTH_STORAGE_KEY/);
  assert.match(portalClient, /persistSession:\s*true/);
  assert.match(portalClient, /autoRefreshToken:\s*true/);
  assert.match(portalClient, /detectSessionInUrl:\s*true/);
  assert.match(adminClient, /persistSession:\s*isBrowser/);
  assert.doesNotMatch(adminClient, /sl_portal_auth_session/);
});

test('portal não usa identificação por telefone nem sincronização ampla', () => {
  const portal = readPortalFile('src', 'components', 'ClientPortal.tsx');
  assert.doesNotMatch(portal, /handleIdentify/);
  assert.doesNotMatch(portal, /syncWithSupabase/);
  assert.doesNotMatch(portal, /dbInstance\.customers/);
  assert.doesNotMatch(portal, /dbInstance\.vehicles/);
  assert.doesNotMatch(portal, /\.from\(['"]clientes['"]\)\.select\(['"]\*['"]\)/);
  assert.match(portal, /PortalAuthGate/);
});

test('portal pré-seleciona automaticamente o primeiro veículo quando disponível', () => {
  const portal = readPortalFile('src', 'components', 'ClientPortal.tsx');
  assert.match(portal, /setSelectedVehicleId\(vehicles\[0\]\.id\)/);
  assert.match(portal, /vehicles\.some\(v => v\.id === selectedVehicleId\)/);
});

test('RLS vincula uma identidade a somente um cliente e bloqueia acesso cruzado', () => {
  const migration = readPortalFile(
    'supabase',
    'migrations',
    '20260724213000_portal001_client_auth_and_isolation.sql'
  );

  assert.match(migration, /auth_user_id uuid primary key references auth\.users/);
  assert.match(migration, /cliente_id uuid not null unique references public\.clientes/);
  assert.match(migration, /alter table public\.clientes enable row level security/);
  assert.match(migration, /alter table public\.veiculos enable row level security/);
  assert.match(migration, /alter table public\.agendamentos enable row level security/);
  assert.match(migration, /revoke all on table public\.clientes from anon/);
  assert.match(migration, /id = public\.portal_current_cliente_id\(\)/);
  assert.match(migration, /cliente_id = public\.portal_current_cliente_id\(\)/);
  assert.match(migration, /CUSTOMER_ALREADY_LINKED/);

  const providerMigration = readPortalFile(
    'supabase',
    'migrations',
    '20260724224500_portal001_email_identity_provider.sql'
  );
  assert.match(providerMigration, /identity_provider text not null default 'email'/);
  assert.match(providerMigration, /identity_provider in \('email', 'phone'\)/);
  assert.match(providerMigration, /email_confirmed_at is not null/);
  assert.match(providerMigration, /phone_confirmed_at is not null/);
  assert.match(providerMigration, /DUPLICATE_CUSTOMER_IDENTITY/);
});

test('operações sensíveis do portal são validadas novamente no banco', () => {
  const migration = readPortalFile(
    'supabase',
    'migrations',
    '20260724213000_portal001_client_auth_and_isolation.sql'
  );

  assert.match(migration, /portal_create_agendamento/);
  assert.match(migration, /VEHICLE_NOT_ALLOWED/);
  assert.match(migration, /TIME_SLOT_UNAVAILABLE/);
  assert.match(migration, /portal_cancel_agendamento/);
  assert.match(migration, /APPOINTMENT_NOT_ALLOWED/);
  assert.match(migration, /CANCELLATION_WINDOW_CLOSED/);
});

test('dados de cliente e operação são removidos e não regravados no localStorage', () => {
  const localDb = readPortalFile('src', 'db', 'localDb.ts');
  for (const key of [
    'KEYS.CUSTOMERS',
    'KEYS.VEHICLES',
    'KEYS.APPOINTMENTS',
    'KEYS.HISTORY',
    'KEYS.FINANCES',
    'KEYS.USERS'
  ]) {
    assert.match(localDb, new RegExp(key.replace('.', '\\.')));
  }
  assert.match(localDb, /SENSITIVE_BROWSER_STORAGE_KEYS\.has\(key\)/);
  assert.match(localDb, /localStorage\.removeItem\(key\)/);
});

test('sincronização administrativa só ocorre após perfil autenticado', () => {
  const app = readPortalFile('src', 'App.tsx');
  assert.match(app, /if \(!user \|\| !dbInstance\.config\.useRealSupabase\) return/);
  assert.match(app, /void dbInstance\.syncWithSupabase\(\)/);
});

test('nova navegacao preserva o fluxo de agendamento e oferece telas somente leitura', () => {
  const portal = readPortalFile('src', 'components', 'ClientPortal.tsx');
  const home = readPortalFile('src', 'components', 'ClientPortalHome.tsx');
  assert.match(portal, /portalSection/);
  assert.match(portal, /setStep\(4\)/);
  assert.match(home, /Agendar/);
  assert.match(home, /fidelidade/);
  assert.match(home, /Consultar agenda/);
  assert.match(home, /Somente consulta/);
  assert.doesNotMatch(home, /createPortalAppointment|cancelPortalAppointment/);
});

test('fidelidade usa agregado seguro e catalogo possui fonte administravel', () => {
  const migration = readPortalFile(
    'supabase',
    'migrations',
    '20260805235000_portal_cliente_experiencia.sql'
  );
  const portalData = readPortalFile('src', 'portal', 'portalSupabase.ts');
  const settings = readPortalFile('src', 'components', 'ConfiguracoesModule.tsx');
  assert.match(migration, /portal_referral_progress\(\)/);
  assert.match(migration, /security definer/);
  assert.match(migration, /revoke all on function public\.portal_referral_progress\(\) from public, anon/);
  assert.match(migration, /grant execute on function public\.portal_referral_progress\(\) to authenticated/);
  assert.match(portalData, /client\.rpc\('portal_referral_progress'\)/);
  assert.match(settings, /portalCatalogSource/);
  assert.match(settings, /whatsappCatalogUrl/);
  assert.match(settings, /loyaltyReferralTarget/);
});
