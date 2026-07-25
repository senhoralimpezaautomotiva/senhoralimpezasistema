import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  PUBLIC_SYSTEM_CONFIG_KEYS,
  sanitizeLegacyConfigStorage,
  toPublicSystemConfig
} from '../src/security/publicConfig';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

test('allowlist pública descarta credenciais conhecidas e campos privados desconhecidos', () => {
  const sanitized = toPublicSystemConfig({
    companyName: 'Empresa',
    useRealSupabase: true,
    zapiToken: 'never-persist',
    zapiClientToken: 'never-persist',
    makeWebhookUrl: 'https://private.example',
    futurePrivateSecret: 'never-persist',
    agenda: {
      days: [],
      timeSlots: [],
      minAdvanceHours: 2,
      maxAdvanceDays: 30,
      autoBlockDuration: true,
      nestedSecret: 'never-persist'
    }
  });

  assert.deepEqual(Object.keys(sanitized).sort(), ['agenda', 'companyName', 'useRealSupabase']);
  assert.equal(JSON.stringify(sanitized).includes('never-persist'), false);
  assert.equal('nestedSecret' in (sanitized.agenda as object), false);
});

test('todas as chaves da configuração pública oficial pertencem à allowlist', () => {
  const keys = new Set(PUBLIC_SYSTEM_CONFIG_KEYS);
  assert.equal(keys.has('companyName'), true);
  assert.equal(keys.has('supabaseAnonKey'), true);
  assert.equal(keys.has('agenda'), true);
  assert.equal(keys.has('zapiToken' as any), false);
  assert.equal(keys.has('makeWebhookUrl' as any), false);
});

test('migração do localStorage preserva somente configuração pública', () => {
  const storage = new MemoryStorage();
  storage.setItem('sl_config', JSON.stringify({
    companyName: 'Empresa segura',
    zapiToken: 'private-token',
    makeWebhookUrl: 'https://private.example'
  }));
  storage.setItem('sl_admin_password', 'legacy-password');
  storage.setItem('sl_logs', 'legacy-log');
  storage.setItem('sl_executions', 'legacy-execution');

  sanitizeLegacyConfigStorage(storage, true);

  assert.deepEqual(JSON.parse(storage.getItem('sl_config_cache') || '{}'), {
    companyName: 'Empresa segura'
  });
  assert.equal(storage.getItem('sl_config'), null);
  assert.equal(storage.getItem('sl_admin_password'), null);
  assert.equal(storage.getItem('sl_logs'), null);
  assert.equal(storage.getItem('sl_executions'), null);
});

test('migração do sessionStorage remove integralmente caches legados', () => {
  const storage = new MemoryStorage();
  storage.setItem('sl_config_cache', JSON.stringify({
    companyName: 'Empresa',
    zapiToken: 'private-token'
  }));
  storage.setItem('sl_config', JSON.stringify({ makeWebhookUrl: 'https://private.example' }));

  sanitizeLegacyConfigStorage(storage, false);

  assert.equal(storage.getItem('sl_config_cache'), null);
  assert.equal(storage.getItem('sl_config'), null);
});

test('bundle do navegador não contém variáveis ou endpoints privados', () => {
  const assetsDirectory = path.resolve('dist', 'assets');
  const javascriptBundle = readdirSync(assetsDirectory)
    .filter(file => file.endsWith('.js'))
    .map(file => readFileSync(path.join(assetsDirectory, file), 'utf8'))
    .join('\n');

  const forbiddenMarkers = [
    'MAKE_WEBHOOK_URL',
    'ZAPI_INSTANCE_ID',
    'ZAPI_TOKEN',
    'ZAPI_CLIENT_TOKEN',
    'SUPABASE_SERVICE_ROLE_KEY',
    'api.z-api.io/instances/'
  ];
  for (const marker of forbiddenMarkers) {
    assert.equal(javascriptBundle.includes(marker), false, `Marcador privado encontrado: ${marker}`);
  }
});

test('DOM de configurações não possui campos vinculados a credenciais privadas', () => {
  const component = readFileSync(
    path.resolve('src', 'components', 'ConfiguracoesModule.tsx'),
    'utf8'
  );
  assert.doesNotMatch(component, /value=\{formData\.(zapi|makeWebhook)/);
  assert.doesNotMatch(component, /onChange=.*(zapiToken|zapiClientToken|makeWebhookUrl)/);
});

test('migração de banco remove colunas privadas e restringe escrita a administrador', () => {
  const migration = readFileSync(
    path.resolve('supabase_sec001_credentials_migration.sql'),
    'utf8'
  );
  assert.match(migration, /DROP COLUMN IF EXISTS zapi_token/);
  assert.match(migration, /DROP COLUMN IF EXISTS make_webhook_url/);
  assert.match(migration, /REVOKE ALL ON public\.configuracoes_empresa FROM anon, authenticated/);
  assert.match(migration, /is_active_usuario_admin/);
});

test('leitura, atualização e respostas públicas usam somente configuração allowlisted', () => {
  const databaseSource = readFileSync(
    path.resolve('src', 'db', 'localDb.ts'),
    'utf8'
  );
  const loadStart = databaseSource.indexOf('async loadConfigFromSupabase');
  const saveStart = databaseSource.indexOf('async saveConfigToSupabase');
  const syncStart = databaseSource.indexOf('// --- SUPABASE LIVE SYNC ENGINE ---');
  const publicLoad = databaseSource.slice(loadStart, saveStart);
  const publicSave = databaseSource.slice(saveStart, syncStart);

  for (const privateField of ['zapi_token', 'zapi_instance_id', 'make_webhook_url']) {
    assert.equal(publicLoad.includes(privateField), false);
    assert.equal(publicSave.includes(privateField), false);
  }
  assert.match(databaseSource, /this\.config = \{ \.\.\.this\.config, \.\.\.toPublicSystemConfig\(updated\) \}/);
});

test('logs do processador não registram URL, token ou payload de provedores', () => {
  const engineSource = readFileSync(
    path.resolve('src', 'db', 'automationEngine.ts'),
    'utf8'
  );
  const logStatements = engineSource
    .split(/\r?\n/)
    .filter(line => /console\.(log|info|warn|error)/.test(line))
    .join('\n');

  assert.doesNotMatch(logStatements, /zapiUrl|zapiToken|zapiClientToken|makeWebhookUrl/);
  assert.doesNotMatch(logStatements, /payloadBody|formattedMessage|telefone|mensagem/);
});
