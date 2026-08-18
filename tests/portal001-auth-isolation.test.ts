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
  const contract = readPortalFile('src', 'portal', 'auth', 'portalAuthProvider.ts');
  assert.match(source, /\.auth\.signUp\(\{\s*email,\s*password/s);
  assert.match(source, /emailRedirectTo:\s*portalRedirectUrl\(false\)/);
  assert.match(source, /\.auth\.signInWithPassword\(\{/);
  assert.match(source, /\.auth\.resetPasswordForEmail\(/);
  assert.match(source, /redirectTo:\s*portalRedirectUrl\(true\)/);
  assert.match(contract, /PORTAL_FORCE_PASSWORD_CHANGE_FLAG = 'force_password_change'/);
  assert.match(source, /\.auth\.updateUser\(\{\s*password,[\s\S]*\[PORTAL_FORCE_PASSWORD_CHANGE_FLAG\]: false/);
  assert.match(source, /functions\.invoke\('portal-clear-password-change'\)/);
  assert.doesNotMatch(source, /signInWithOtp|verifyOtp/);
});

test('redefinicao por token usa validacao existente e volta ao login', () => {
  const contract = readPortalFile('src', 'portal', 'auth', 'portalAuthProvider.ts');
  const provider = readPortalFile('src', 'portal', 'auth', 'emailPasswordAuthProvider.ts');
  const gate = readPortalFile('src', 'portal', 'PortalAuthGate.tsx');

  assert.match(contract, /updatePassword\(password: string, options\?: \{ clearForcePasswordChange\?: boolean \}\): Promise<void>/);
  assert.match(provider, /validatePortalPassword\(password\)/);
  assert.match(provider, /if \(options\.clearForcePasswordChange\)[\s\S]*portal-clear-password-change/);
  assert.match(gate, /passwordResetFromRecovery/);
  assert.match(gate, /PASSWORD_RECOVERY[\s\S]*setPasswordResetFromRecovery\(true\)/);
  assert.match(gate, /Redefinir senha/);
  assert.match(gate, /clearForcePasswordChange: !passwordResetFromRecovery/);
  assert.match(gate, /Senha redefinida com sucesso\. Entre novamente para acessar o Portal do Cliente\./);
  assert.match(gate, /await authProvider\.signOut\(\)/);
  assert.match(gate, /Link de redefinição inválido ou expirado/);
});

test('personalizacao de e-mail do Supabase Auth fica documentada como configuracao externa', () => {
  const guide = readPortalFile('docs', 'SUPABASE_AUTH_EMAILS.md');

  assert.match(guide, /Codigo da aplicacao/);
  assert.match(guide, /Configuracao obrigatoria no Supabase/);
  assert.match(guide, /Senhora Limpeza Estetica Automotiva/);
  assert.match(guide, /Authentication > Email Templates > Reset Password/);
  assert.match(guide, /\{\{ \.ConfirmationURL \}\}/);
  assert.match(guide, /\?portal=true&recovery=true/);
});

test('portal permite alterar senha logado com reautenticacao e logout obrigatorio', () => {
  const contract = readPortalFile('src', 'portal', 'auth', 'portalAuthProvider.ts');
  const provider = readPortalFile('src', 'portal', 'auth', 'emailPasswordAuthProvider.ts');
  const portal = readPortalFile('src', 'components', 'ClientPortal.tsx');
  const home = readPortalFile('src', 'components', 'ClientPortalHome.tsx');
  const gate = readPortalFile('src', 'portal', 'PortalAuthGate.tsx');

  assert.match(contract, /changePassword\(currentPassword: string, newPassword: string\): Promise<void>/);
  assert.match(provider, /async changePassword\(currentPassword: string, newPassword: string\)/);
  assert.match(provider, /validatePortalPassword\(newPassword\)/);
  assert.match(provider, /password:\s*currentPassword/);
  assert.match(provider, /\.auth\.updateUser\(\{\s*password:\s*newPassword\s*\}\)/);
  assert.match(portal, /handlePortalPasswordChange/);
  assert.match(portal, /activePortalAuthProvider\.changePassword\(currentPassword, newPassword\)/);
  assert.match(portal, /sl_portal_auth_notice/);
  assert.match(portal, /activePortalAuthProvider\.signOut\(\)/);
  assert.match(home, /'profile'/);
  assert.match(home, /'change-password'/);
  assert.match(home, /Alterar senha/);
  assert.match(home, /autoComplete="current-password"/);
  assert.match(home, /autoComplete="new-password"/);
  assert.match(home, /onChangePassword\(passwordForm\.currentPassword, passwordForm\.newPassword\)/);
  assert.match(gate, /sessionStorage\.getItem\('sl_portal_auth_notice'\)/);
  assert.match(gate, /setSuccessMessage\(storedNotice\)/);
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
  assert.match(app, /if \(!user \|\| isClientPortal \|\| !config\.useRealSupabase\) return/);
  assert.match(app, /await dbInstance\.syncWithSupabase\(\)/);
  assert.match(app, /window\.setInterval\([\s\S]*60_000/);
});

test('falha temporaria ao carregar perfil nao encerra sessao autenticada', () => {
  const app = readPortalFile('src', 'App.tsx');
  const gate = readPortalFile('src', 'portal', 'PortalAuthGate.tsx');

  assert.match(app, /class InvalidAdministrativeProfileError extends Error/);
  assert.match(app, /profileError[\s\S]*throw new Error/);
  assert.match(app, /error instanceof InvalidAdministrativeProfileError[\s\S]*supabase\.auth\.signOut\(\)/);
  assert.match(app, /setAuthenticatedSessionNeedsRetry\(true\)/);
  assert.match(app, /continua ativa/);
  assert.match(app, /Tentar novamente/);

  assert.match(gate, /setSession\(activeSession\);[\s\S]*await claimExistingPortalCustomer\(\)/);
  assert.match(gate, /portalDataLoadError/);
  assert.match(gate, /Sua sessao continua ativa/);
  assert.match(gate, /retryPortalDataLoad/);
  assert.doesNotMatch(gate, /catch \(error\) \{[\s\S]{0,180}authProvider\.signOut\(\)/);
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

test('cadastro administrativo de cliente provisiona Auth temporario e portal bloqueia ate trocar senha', () => {
  const localDb = readPortalFile('src', 'db', 'localDb.ts');
  const gate = readPortalFile('src', 'portal', 'PortalAuthGate.tsx');
  const clientesModule = readPortalFile('src', 'components', 'ClientesModule.tsx');
  const functionSource = readPortalFile(
    'supabase',
    'functions',
    'admin-create-client-user',
    'index.ts'
  );
  const clearFunctionSource = readPortalFile(
    'supabase',
    'functions',
    'portal-clear-password-change',
    'index.ts'
  );

  assert.match(localDb, /CLIENT_PORTAL_TEMPORARY_PASSWORD = '123456'/);
  assert.match(localDb, /readSupabaseFunctionErrorMessage/);
  assert.match(localDb, /\.from\('clientes'\)\.delete\(\)\.eq\('id', id\)/);
  assert.match(localDb, /throw new Error\(authErrorMessage\)/);
  assert.match(clientesModule, /setErrorMessage\(err\?\.message \|\|/);
  assert.doesNotMatch(clientesModule, /telefone j.{1,4} est.{1,4} cadastrado/);
  assert.match(localDb, /supabase\.functions\.invoke\('admin-create-client-user'/);
  assert.match(localDb, /Authorization:\s*`Bearer \$\{sessionData\.session\.access_token\}`/);
  assert.match(functionSource, /auth\.admin\.createUser\(\{[\s\S]*password,[\s\S]*email_confirm: true/);
  assert.match(functionSource, /app_metadata:\s*\{[\s\S]*FORCE_PASSWORD_CHANGE_FLAG/);
  assert.match(functionSource, /Ja existe um acesso ao Portal do Cliente cadastrado para este e-mail/);
  assert.match(functionSource, /portal_client_identities/);
  assert.match(functionSource, /canCreateCustomers/);
  assert.match(clearFunctionSource, /auth\.admin\.updateUserById/);
  assert.match(clearFunctionSource, /requester\.app_metadata\?\.\[FORCE_PASSWORD_CHANGE_FLAG\] !== true/);
  assert.match(clearFunctionSource, /app_metadata:\s*nextAppMetadata/);
  assert.match(gate, /mustChangePortalPassword\(activeSession\)/);
  assert.match(gate, /setMode\('new-password'\)/);
  assert.match(gate, /isRecoveryCallback \|\| mustChangePortalPassword\(data\.session\)/);
});

test('force_password_change tambem bloqueia acesso direto ao backend do portal', () => {
  const migration = readPortalFile(
    'supabase',
    'migrations',
    '20260816143000_portal_force_password_change_backend_guard.sql'
  );
  const provider = readPortalFile('src', 'portal', 'auth', 'emailPasswordAuthProvider.ts');
  const gate = readPortalFile('src', 'portal', 'PortalAuthGate.tsx');

  assert.match(migration, /portal_password_change_required\(\)/);
  assert.match(migration, /auth\.jwt\(\) -> 'app_metadata' ->> 'force_password_change'/);
  assert.match(migration, /portal_password_change_allowed\(\)/);
  assert.match(migration, /message = 'PASSWORD_CHANGE_REQUIRED'/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.portal_current_cliente_id\(\)[\s\S]*public\.portal_password_change_allowed\(\)/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.portal_resolve_auth_identity\(\)[\s\S]*public\.portal_password_change_required\(\)/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.portal_busy_intervals\(p_date date\)[\s\S]*PASSWORD_CHANGE_REQUIRED/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.portal_referral_progress\(\)[\s\S]*PASSWORD_CHANGE_REQUIRED/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.portal_validate_referral_code\(p_code text\)[\s\S]*PASSWORD_CHANGE_REQUIRED/);
  assert.match(migration, /configuracoes_empresa_select_public[\s\S]*portal_password_change_allowed\(\)/);
  assert.match(migration, /servicos_catalog_read[\s\S]*portal_password_change_allowed\(\)/);
  assert.match(provider, /functions\.invoke\('portal-clear-password-change'\)/);
  assert.match(provider, /\.auth\.refreshSession\(\)/);
  assert.match(gate, /const activeSession = \(await client\.auth\.getSession\(\)\)\.data\.session/);
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
