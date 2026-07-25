import assert from 'node:assert/strict';
import { once } from 'node:events';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import express from 'express';
import { validateProductionArtifact } from '../src/security/artifactPolicy';
import { scanTextForSecrets } from '../src/security/secretScanner';
import {
  EnvironmentConfigurationError,
  loadServerEnvironment
} from '../src/server/environment';
import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
  createSecurityHeaders
} from '../src/server/securityHeaders';

const source = (...segments: string[]): string =>
  readFileSync(path.resolve(...segments), 'utf8');

const productionEnvironment = {
  APP_ENV: 'production',
  NODE_ENV: 'production',
  PORT: '3000',
  SUPABASE_URL: 'https://project-ref.supabase.co',
  SUPABASE_ANON_KEY: 'public-anon-placeholder',
  VITE_SUPABASE_URL: 'https://project-ref.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'public-anon-placeholder'
};

test('headers obrigatórios estão presentes nas respostas', () => {
  const headers = buildSecurityHeaders({
    environment: 'production',
    supabaseUrl: productionEnvironment.SUPABASE_URL
  });
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['Referrer-Policy'], 'no-referrer');
  assert.match(headers['Permissions-Policy'], /camera=\(\)/);
  assert.equal(headers['X-Frame-Options'], 'DENY');
  assert.match(headers['Strict-Transport-Security'], /max-age=31536000/);

  const applied = new Map<string, string>();
  let nextCalled = false;
  const middleware = createSecurityHeaders({
    environment: 'production',
    supabaseUrl: productionEnvironment.SUPABASE_URL
  });
  (middleware as any)(
    {},
    { setHeader: (name: string, value: string) => applied.set(name, value) },
    () => {
      nextCalled = true;
    }
  );
  assert.equal(nextCalled, true);
  assert.equal(applied.get('Content-Security-Policy'), headers['Content-Security-Policy']);
});

test('headers são observáveis em uma resposta HTTP real', async () => {
  const app = express();
  app.disable('x-powered-by');
  app.use(createSecurityHeaders({
    environment: 'production',
    supabaseUrl: productionEnvironment.SUPABASE_URL
  }));
  app.get('/health', (_request, response) => response.json({ status: 'ok' }));

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const address = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.match(response.headers.get('content-security-policy') || '', /frame-ancestors 'none'/);
    assert.equal(response.headers.get('x-powered-by'), null);
  } finally {
    server.close();
    await once(server, 'close');
  }
});

test('CSP de produção bloqueia fontes não permitidas sem unsafe-eval ou script inline', () => {
  const csp = buildContentSecurityPolicy({
    environment: 'production',
    supabaseUrl: productionEnvironment.SUPABASE_URL
  });
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self'(?:;|$)/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /base-uri 'self'/);
  assert.doesNotMatch(csp, /unsafe-eval/);
  assert.doesNotMatch(csp, /script-src[^;]*unsafe-inline/);
  assert.doesNotMatch(csp, /connect-src[^;]*\shttps:\s/);
});

test('CSP preserva origens legítimas e limita exceção inline a estilos', () => {
  const csp = buildContentSecurityPolicy({
    environment: 'staging',
    supabaseUrl: productionEnvironment.SUPABASE_URL
  });
  assert.match(csp, /style-src 'self' 'unsafe-inline'/);
  assert.match(csp, /img-src[^;]*https:\/\/images\.unsplash\.com/);
  assert.match(csp, /connect-src[^;]*https:\/\/project-ref\.supabase\.co/);
  assert.match(csp, /connect-src[^;]*wss:\/\/project-ref\.supabase\.co/);
});

test('servidor remove identificação do Express e aplica cache seguro', () => {
  const serverSource = source('server.ts');
  assert.match(serverSource, /app\.disable\('x-powered-by'\)/);
  assert.match(serverSource, /public, max-age=31536000, immutable/);
  assert.match(serverSource, /res\.setHeader\('Cache-Control', 'no-cache'\)/);
  assert.match(source('src', 'server', 'adminApiSecurity.ts'), /'Cache-Control', 'no-store'/);
});

test('ambientes staging e produção exigem configuração própria e coerente', () => {
  const loaded = loadServerEnvironment(productionEnvironment);
  assert.equal(loaded.appEnvironment, 'production');
  assert.equal(loaded.nodeEnvironment, 'production');
  assert.equal(loaded.supabaseUrl, productionEnvironment.SUPABASE_URL);

  assert.throws(
    () => loadServerEnvironment({ NODE_ENV: 'production' }),
    (error: unknown) =>
      error instanceof EnvironmentConfigurationError &&
      error.code === 'ENV_REQUIRED_APP_ENV'
  );
  assert.throws(
    () => loadServerEnvironment({ APP_ENV: 'staging', NODE_ENV: 'development' }),
    (error: unknown) =>
      error instanceof EnvironmentConfigurationError &&
      error.code === 'ENV_NODE_ENV_MISMATCH'
  );
});

test('variável privada obrigatória em configuração Z-API incompleta falha com segurança', () => {
  assert.throws(
    () => loadServerEnvironment({
      ...productionEnvironment,
      ZAPI_INSTANCE_ID: 'instance-sentinel'
    }),
    (error: unknown) =>
      error instanceof EnvironmentConfigurationError &&
      error.code === 'ENV_INCOMPLETE_ZAPI_CONFIG' &&
      !error.message.includes('instance-sentinel')
  );
});

test('templates de ambiente contêm somente placeholders e não há credencial padrão no código', () => {
  for (const file of [
    '.env.example',
    '.env.development.example',
    '.env.staging.example',
    '.env.production.example'
  ]) {
    const contents = source(file);
    assert.match(contents, /APP_ENV=/);
    assert.doesNotMatch(contents, /sb_secret_|eyJ[A-Za-z0-9_-]{20,}\./);
  }
  const databaseSource = source('src', 'db', 'localDb.ts');
  assert.doesNotMatch(databaseSource, /sb_publishable_[A-Za-z0-9_-]+/);
  assert.doesNotMatch(databaseSource, /https:\/\/ansrnnydksrjwefnntaw\.supabase\.co/);
  assert.match(databaseSource, /getPublicSupabaseEnvironment/);
});

test('scanner detecta sentinelas de segredo sem registrar seus valores', () => {
  const serviceKey = ['sb_', 'secret_', 'SEC005SENTINEL0123456789'].join('');
  const privateKey = ['-----BEGIN ', 'PRIVATE KEY-----'].join('');
  const webhook = ['https://hook.', 'us1.make.com/', 'SEC005SENTINELWEBHOOK'].join('');
  const findings = scanTextForSecrets(
    [serviceKey, privateKey, webhook].join('\n'),
    'sentinel.txt'
  );
  assert.deepEqual(
    new Set(findings.map(finding => finding.rule)),
    new Set(['supabase-secret-key', 'private-key', 'private-webhook-url'])
  );
  assert.equal(JSON.stringify(findings).includes('SEC005SENTINEL'), false);
});

test('scanner aceita placeholders e referências a cofres de ambiente', () => {
  const safeConfiguration = [
    'ZAPI_TOKEN="<set-in-secret-manager>"',
    'const token = process.env.ZAPI_TOKEN;',
    'const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");'
  ].join('\n');
  assert.deepEqual(scanTextForSecrets(safeConfiguration), []);
});

test('scanner permite JWT público anon e continua bloqueando outros JWTs', () => {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'HS256', typ: 'JWT', padding: 'sentinel-value' });
  const signature = 'signaturepartwithmorethantwentycharacters';
  const anonJwt = `${header}.${encode({ role: 'anon', ref: 'projectreferencevalue' })}.${signature}`;
  const privilegedJwt = `${header}.${encode({ role: 'service_role', ref: 'projectreferencevalue' })}.${signature}`;

  assert.deepEqual(scanTextForSecrets(anonJwt, 'public-build.js'), []);
  assert.equal(
    scanTextForSecrets(privilegedJwt, 'private-build.js').some(
      finding => finding.rule === 'service-role-jwt'
    ),
    true
  );
});

test('artefato atual não publica source maps, compactados ou scripts diagnósticos', () => {
  assert.deepEqual(validateProductionArtifact(path.resolve('.')), []);
  assert.equal(existsSync(path.resolve('dist', 'server.cjs.map')), false);
  const viteSource = source('vite.config.ts');
  assert.match(viteSource, /sourcemap: false/);
  assert.match(viteSource, /emptyOutDir: true/);
});

test('política de artefato rejeita source map e script probe sentinela', () => {
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'sec005-artifact-'));
  try {
    mkdirSync(path.join(temporaryRoot, 'dist', 'assets'), { recursive: true });
    writeFileSync(path.join(temporaryRoot, 'dist', 'index.html'), '<html></html>');
    writeFileSync(path.join(temporaryRoot, 'dist', 'server.cjs'), 'module.exports = {};');
    writeFileSync(path.join(temporaryRoot, 'dist', 'server.cjs.map'), '{"sourcesContent":[]}');
    writeFileSync(path.join(temporaryRoot, 'dist', 'probeDatabase.js'), 'void 0;');
    const rules = validateProductionArtifact(temporaryRoot).map(finding => finding.rule);
    assert.ok(rules.includes('forbidden-artifact-extension'));
    assert.ok(rules.includes('diagnostic-artifact'));
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test('política de artefato não confunde chunk legítimo de interface com cópia obsoleta', () => {
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'sec005-artifact-copy-'));
  try {
    mkdirSync(path.join(temporaryRoot, 'dist', 'assets'), { recursive: true });
    writeFileSync(path.join(temporaryRoot, 'dist', 'index.html'), '<html></html>');
    writeFileSync(path.join(temporaryRoot, 'dist', 'server.cjs'), 'module.exports = {};');
    writeFileSync(path.join(temporaryRoot, 'dist', 'assets', 'copy-AbCd1234.js'), 'export {};');
    assert.deepEqual(validateProductionArtifact(temporaryRoot), []);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test('comandos SEC-005 e rotina consolidada estão formalizados', () => {
  const packageJson = JSON.parse(source('package.json')) as {
    scripts: Record<string, string>;
  };
  for (const script of [
    'security:headers',
    'security:secrets',
    'security:artifact',
    'security:dependencies',
    'security:outdated',
    'security:unused',
    'security:licenses',
    'test:sec005',
    'security:ci'
  ]) {
    assert.ok(packageJson.scripts[script], `Script ausente: ${script}`);
  }
  assert.match(packageJson.scripts.build, /legal-comments=none/);
  assert.match(packageJson.scripts['security:ci'], /test:sec002/);
  assert.match(packageJson.scripts['security:ci'], /test:sec003/);
  assert.match(packageJson.scripts['security:ci'], /test:sec004/);
  assert.match(packageJson.scripts['security:ci'], /test:sec005/);
});

test('SEC-002, SEC-003 e SEC-004 permanecem presentes', () => {
  const serverSource = source('server.ts');
  assert.match(serverSource, /authenticateAdministrativeApi/);
  assert.match(serverSource, /requireAccess/);
  assert.match(source('src', 'security', 'publicConfig.ts'), /PUBLIC_SYSTEM_CONFIG_KEYS/);
  assert.match(source('src', 'security', 'safeOutput.ts'), /neutralizeCsvFormula/);
});
