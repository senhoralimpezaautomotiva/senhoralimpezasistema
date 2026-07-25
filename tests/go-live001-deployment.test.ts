import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  GoLiveConfigurationError,
  loadGoLiveConfiguration
} from '../src/server/goLiveConfiguration';
import {
  buildSupabaseAuthDeploymentPayload,
  loadSupabaseAuthDeploymentConfiguration,
  SupabaseAuthDeploymentError
} from '../src/server/supabaseAuthDeployment';

const source = (...segments: string[]): string =>
  readFileSync(path.resolve(...segments), 'utf8');

const publicKey = `sb_publishable_${'A'.repeat(28)}`;
const goLiveEnvironment = {
  APP_ENV: 'production',
  NODE_ENV: 'production',
  RENDER_EXTERNAL_URL: 'https://senhora-limpeza-piloto.onrender.com',
  SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
  SUPABASE_ANON_KEY: publicKey,
  VITE_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
  VITE_SUPABASE_ANON_KEY: publicKey,
  VITE_ENABLE_CLIENT_PORTAL: 'true',
  MAKE_WEBHOOK_URL: 'https://automation.vendor.test/hooks/pilot'
};

const smtpEnvironment = {
  SUPABASE_ACCESS_TOKEN: `sbp_${'B'.repeat(32)}`,
  SUPABASE_PROJECT_REF: 'abcdefghijklmnopqrst',
  PUBLIC_APP_URL: 'https://senhora-limpeza-piloto.onrender.com',
  SUPABASE_SMTP_HOST: 'smtp.provider.test',
  SUPABASE_SMTP_PORT: '587',
  SUPABASE_SMTP_USER: 'smtp-user',
  SUPABASE_SMTP_PASSWORD: 'smtp-password-sentinel',
  SUPABASE_SMTP_ADMIN_EMAIL: 'no-reply@senhoralimpeza.test',
  SUPABASE_SMTP_SENDER_NAME: 'Senhora Limpeza'
};

test('ambiente de go-live exige produção coerente e provedor de mensagens', () => {
  const configuration = loadGoLiveConfiguration(goLiveEnvironment);
  assert.equal(
    configuration.publicAppUrl,
    'https://senhora-limpeza-piloto.onrender.com'
  );
  assert.equal(configuration.supabaseProjectRef, 'abcdefghijklmnopqrst');
  assert.equal(configuration.messageProvider, 'make');

  assert.throws(
    () => loadGoLiveConfiguration({
      ...goLiveEnvironment,
      MAKE_WEBHOOK_URL: ''
    }),
    (error: unknown) =>
      error instanceof GoLiveConfigurationError &&
      error.code === 'GO_LIVE_MESSAGE_PROVIDER_REQUIRED'
  );
});

test('go-live rejeita URL pública insegura, projeto divergente e chave privada', () => {
  assert.throws(
    () => loadGoLiveConfiguration({
      ...goLiveEnvironment,
      RENDER_EXTERNAL_URL: 'http://senhora-limpeza-piloto.onrender.com'
    }),
    (error: unknown) =>
      error instanceof GoLiveConfigurationError &&
      error.code === 'GO_LIVE_PUBLIC_APP_URL_INVALID'
  );

  assert.throws(
    () => loadGoLiveConfiguration({
      ...goLiveEnvironment,
      VITE_SUPABASE_URL: 'https://zyxwvutsrqponmlkjihg.supabase.co'
    }),
    (error: unknown) =>
      error instanceof Error &&
      'code' in error &&
      String((error as Error & { code: unknown }).code).includes('URL_MISMATCH')
  );

  assert.throws(
    () => loadGoLiveConfiguration({
      ...goLiveEnvironment,
      SUPABASE_ANON_KEY: `sb_secret_${'C'.repeat(28)}`,
      VITE_SUPABASE_ANON_KEY: `sb_secret_${'C'.repeat(28)}`
    }),
    (error: unknown) =>
      error instanceof GoLiveConfigurationError &&
      error.code === 'GO_LIVE_SUPABASE_PUBLIC_KEY_INVALID'
  );
});

test('SMTP configurável preserva confirmação e usa Redirect URLs exatas', () => {
  const configuration =
    loadSupabaseAuthDeploymentConfiguration(smtpEnvironment);
  const payload = buildSupabaseAuthDeploymentPayload(configuration);

  assert.equal(payload.external_email_enabled, true);
  assert.equal(payload.mailer_autoconfirm, false);
  assert.equal(payload.smtp_host, 'smtp.provider.test');
  assert.equal(payload.smtp_port, 587);
  assert.equal(payload.site_url, smtpEnvironment.PUBLIC_APP_URL);
  assert.equal(
    payload.uri_allow_list,
    [
      `${smtpEnvironment.PUBLIC_APP_URL}/?portal=true`,
      `${smtpEnvironment.PUBLIC_APP_URL}/?portal=true&recovery=true`
    ].join(',')
  );
});

test('configuração SMTP rejeita placeholder, HTTP e porta inválida', () => {
  assert.throws(
    () => loadSupabaseAuthDeploymentConfiguration({
      ...smtpEnvironment,
      SUPABASE_SMTP_PASSWORD: '<smtp-password>'
    }),
    (error: unknown) => error instanceof SupabaseAuthDeploymentError
  );
  assert.throws(
    () => loadSupabaseAuthDeploymentConfiguration({
      ...smtpEnvironment,
      PUBLIC_APP_URL: 'http://senhora-limpeza-piloto.onrender.com'
    }),
    (error: unknown) =>
      error instanceof SupabaseAuthDeploymentError &&
      error.code === 'SMTP_INVALID_PUBLIC_APP_URL'
  );
  assert.throws(
    () => loadSupabaseAuthDeploymentConfiguration({
      ...smtpEnvironment,
      SUPABASE_SMTP_PORT: '70000'
    }),
    (error: unknown) =>
      error instanceof SupabaseAuthDeploymentError &&
      error.code === 'SMTP_INVALID_PORT'
  );
});

test('Blueprint do Render usa build validada, health check e segredos externos', () => {
  const blueprint = source('render.yaml');
  assert.match(blueprint, /runtime:\s*node/);
  assert.match(blueprint, /plan:\s*free/);
  assert.match(blueprint, /autoDeployTrigger:\s*off/);
  assert.match(blueprint, /npm run build:render/);
  assert.match(blueprint, /healthCheckPath:\s*\/health/);
  assert.doesNotMatch(blueprint, /maxShutdownDelaySeconds/);
  for (const key of [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'MAKE_WEBHOOK_URL',
    'ZAPI_TOKEN'
  ]) {
    assert.match(
      blueprint,
      new RegExp(`key:\\s*${key}\\s*\\n\\s*sync:\\s*false`)
    );
  }
  assert.doesNotMatch(blueprint, /sb_secret_|service_role|eyJ[A-Za-z0-9_-]{20,}\./);
});

test('build do Render valida produção e isola testes das credenciais reais', () => {
  const buildRunner = source('scripts', 'pilot', 'run-render-build.ts');
  const packageJson = JSON.parse(source('package.json'));
  assert.match(buildRunner, /loadGoLiveConfiguration\(\)/);
  assert.match(buildRunner, /delete isolatedBuildEnvironment\[name\]/);
  assert.match(buildRunner, /'SUPABASE_URL'/);
  assert.match(buildRunner, /'MAKE_WEBHOOK_URL'/);
  assert.match(buildRunner, /GO_LIVE_BUILD_ISOLATED/);
  assert.match(packageJson.scripts['build:render'], /run-render-build/);
});

test('servidor possui health check mínimo e encerramento gracioso', () => {
  const server = source('server.ts');
  assert.match(server, /app\.get\('\/health'/);
  assert.match(server, /Cache-Control', 'no-store'/);
  assert.match(server, /process\.once\('SIGTERM'/);
  assert.match(server, /clearInterval\(backgroundCycle\)/);
  assert.match(server, /httpServer\.close/);
});

test('redirects do portal partem da origem e não carregam parâmetros antigos', () => {
  const authProvider = source(
    'src',
    'portal',
    'auth',
    'emailPasswordAuthProvider.ts'
  );
  assert.match(authProvider, /new URL\('\/', window\.location\.origin\)/);
  assert.match(authProvider, /searchParams\.set\('portal', 'true'\)/);
  assert.match(authProvider, /searchParams\.set\('recovery', 'true'\)/);
  assert.doesNotMatch(authProvider, /new URL\(window\.location\.href\)/);
});

test('procedimento de publicação inclui SMTP, Redirect URLs e rollback', () => {
  const deployment = source('docs', 'GO_LIVE_RENDER.md');
  assert.match(deployment, /SMTP/i);
  assert.match(deployment, /Redirect URLs/i);
  assert.match(deployment, /health/i);
  assert.match(deployment, /rollback/i);
  assert.match(deployment, /VITE_ENABLE_CLIENT_PORTAL=false/);
  assert.match(deployment, /não execute migrations/i);
});
