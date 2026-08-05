import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { DEFAULT_ROLE_PERMISSIONS } from '../src/db/localDb';
import { loadServerEnvironment } from '../src/server/environment';
import type { Service, Vehicle } from '../src/types';
import { getServicePrice } from '../src/utils/servicePricing';

const projectFile = (...segments: string[]): string =>
  readFileSync(path.resolve(...segments), 'utf8');

const productionEnvironment = {
  APP_ENV: 'production',
  NODE_ENV: 'production',
  SUPABASE_URL: 'https://project-ref.supabase.co',
  SUPABASE_ANON_KEY: 'public-anon-placeholder',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-placeholder',
  VITE_SUPABASE_URL: 'https://project-ref.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'public-anon-placeholder',
  VITE_ENABLE_CLIENT_PORTAL: 'true'
};

test('produção habilita o portal autenticado e ainda permite rollback pelo flag', () => {
  const environment = loadServerEnvironment(productionEnvironment);
  assert.equal(environment.clientPortalEnabled, true);

  const disabled = loadServerEnvironment({
    ...productionEnvironment,
    VITE_ENABLE_CLIENT_PORTAL: 'false'
  });
  assert.equal(disabled.clientPortalEnabled, false);
});

test('homologação permite testar o portal sem liberá-lo em produção', () => {
  const environment = loadServerEnvironment({
    ...productionEnvironment,
    APP_ENV: 'staging',
    VITE_ENABLE_CLIENT_PORTAL: 'true'
  });

  assert.equal(environment.clientPortalEnabled, true);
});

test('rota e atalhos do portal obedecem ao mesmo feature flag', () => {
  const app = projectFile('src', 'App.tsx');
  const dashboard = projectFile('src', 'components', 'DashboardModule.tsx');
  const vite = projectFile('vite.config.ts');

  assert.match(app, /CLIENT_PORTAL_ENABLED\s*&&/);
  assert.match(app, /CLIENT_PORTAL_ENABLED\s*\?\s*lazy\(/);
  assert.match(app, /onGoToPortal=\{/);
  assert.match(app, /clientPortalEnabled=\{CLIENT_PORTAL_ENABLED\}/);
  assert.match(dashboard, /\{clientPortalEnabled && \(/);
  assert.match(vite, /rawClientPortalEnabled === 'true'/);
});

test('sessão administrativa é restaurada e o perfil ativo é revalidado', () => {
  const app = projectFile('src', 'App.tsx');
  const login = projectFile('src', 'components', 'LoginScreen.tsx');

  assert.match(login, /signInWithPassword/);
  assert.match(app, /supabase\.auth\.getSession\(\)/);
  assert.match(app, /supabase\.auth\.onAuthStateChange/);
  assert.match(app, /profileRow\.auth_user_id !== session\.user\.id/);
  assert.match(app, /profile\.status !== 'ativo'/);
  assert.match(app, /supabase\.auth\.signOut\(\)/);
});

test('admin, gerente e atendente possuem o acesso operacional mínimo do piloto', () => {
  for (const role of ['admin', 'gerente', 'atendente'] as const) {
    const permissions = DEFAULT_ROLE_PERMISSIONS[role];
    assert.equal(permissions.dashboard.view, true);
    assert.equal(permissions.clientes.view, true);
    assert.equal(permissions.clientes.create, true);
    assert.equal(permissions.clientes.edit, true);
    assert.equal(permissions.servicos.view, true);
    assert.equal(permissions.agenda.view, true);
    assert.equal(permissions.agenda.create, true);
    assert.equal(permissions.agenda.edit, true);
    assert.equal(permissions.mensagens.view, true);
    assert.equal(permissions.mensagens.create, true);
    assert.equal(permissions.relatorios.view, true);
  }
});

test('preço do serviço respeita o porte do veículo', () => {
  const service: Service = {
    id: 'service-pilot',
    name: 'Lavagem',
    description: '',
    basePrice: 100,
    estimatedTime: 60,
    pricingType: 'porte',
    priceP: 80,
    priceM: 100,
    priceG: 150
  };
  const vehicle: Vehicle = {
    id: 'vehicle-pilot',
    customerId: 'customer-pilot',
    brand: 'Marca',
    model: 'SUV',
    version: '',
    year: '2025',
    plate: 'ABC1D23',
    color: 'Preto',
    mileage: '0',
    porte: 'Grande'
  };

  assert.equal(getServicePrice(service, vehicle), 150);
});

test('mudanças de status disparam as mensagens operacionais existentes', () => {
  const database = projectFile('src', 'db', 'localDb.ts');

  assert.match(database, /status === 'em_andamento'/);
  assert.match(database, /triggerAutomation\('servico_iniciado'/);
  assert.match(database, /status === 'finalizado' \|\| status === 'entregue'/);
  assert.match(database, /triggerAutomation\('servico_finalizado'/);
  assert.match(database, /triggerAutomation\('novo_agendamento'/);
});

test('impressão continua usando construção segura sem document.write', () => {
  const dashboard = projectFile('src', 'components', 'DashboardModule.tsx');

  assert.doesNotMatch(dashboard, /document\.write|innerHTML/);
  assert.match(dashboard, /setSafeText/);
  assert.match(dashboard, /printWindow\.print/);
});

test('templates e procedimento de publicação mantêm o piloto em modo seguro', () => {
  const productionTemplate = projectFile('.env.production.example');
  const stagingTemplate = projectFile('.env.staging.example');
  const deployment = projectFile('docs', 'PILOT_DEPLOYMENT.md');
  const packageJson = JSON.parse(projectFile('package.json'));

  assert.match(productionTemplate, /VITE_ENABLE_CLIENT_PORTAL="true"/);
  assert.match(stagingTemplate, /VITE_ENABLE_CLIENT_PORTAL="true"/);
  assert.match(deployment, /backup/i);
  assert.match(deployment, /rollback/i);
  assert.match(deployment, /npm run security:ci/);
  assert.match(deployment, /Portal do Cliente/is);
  assert.match(packageJson.scripts.build, /pilot:artifact/);
});
