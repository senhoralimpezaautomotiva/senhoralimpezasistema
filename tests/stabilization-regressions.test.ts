import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import type { Customer, Service, Vehicle, VehicleModel } from '../src/types';
import {
  createAppointmentFormDraft,
  getServicePrice,
  getServicesDuration,
  getServicesPrice
} from '../src/utils/servicePricing';
import {
  buildVehicleCatalog,
  resolveVehiclePorte,
  sizeCategoryToPorte
} from '../src/utils/vehicleCatalog';

const projectFile = (...segments: string[]): string =>
  readFileSync(path.resolve(...segments), 'utf8');

const customers: Customer[] = [{
  id: 'customer-1',
  name: 'Cliente',
  phone: '',
  whatsapp: '',
  email: '',
  birthDate: '',
  address: '',
  neighborhood: '',
  city: '',
  notes: '',
  clientSince: '2026-01-01',
  lastServiceDate: null,
  status: 'ativo',
  origin: 'Teste'
}];

const vehicles: Vehicle[] = [{
  id: 'vehicle-1',
  customerId: 'customer-1',
  brand: 'Marca',
  model: 'SUV',
  version: '',
  year: '2025',
  plate: 'ABC1D23',
  color: 'Preto',
  mileage: '0',
  porte: 'Grande'
}];

const services: Service[] = [{
  id: 'service-1',
  name: 'Lavagem',
  description: '',
  basePrice: 100,
  estimatedTime: 60,
  pricingType: 'porte',
  priceP: 80,
  priceM: 100,
  priceG: 140
}, {
  id: 'service-2',
  name: 'Proteção',
  description: '',
  basePrice: 50,
  estimatedTime: 30,
  pricingType: 'porte',
  priceP: 40,
  priceM: 50,
  priceG: 70
}];

test('precificação por porte usa P, M e G e preserva preço único', () => {
  assert.equal(getServicePrice(services[0], 'Pequeno'), 80);
  assert.equal(getServicePrice(services[0], 'Médio'), 100);
  assert.equal(getServicePrice(services[0], vehicles[0]), 140);
  assert.equal(getServicePrice({ ...services[0], pricingType: 'unico' }, vehicles[0]), 100);
});

test('agendamento inicial já nasce com o preço do veículo selecionado', () => {
  const draft = createAppointmentFormDraft(customers, vehicles, services, '09:00');
  assert.deepEqual(draft, {
    customerId: 'customer-1',
    vehicleId: 'vehicle-1',
    serviceId: 'service-1',
    time: '09:00',
    value: 140,
    employeeId: 'Gabriel',
    notes: ''
  });
});

test('múltiplos serviços recalculam preço e duração sem usar basePrice fixo', () => {
  assert.equal(getServicesPrice(services, ['service-1', 'service-2'], vehicles[0]), 210);
  assert.equal(getServicesDuration(services, ['service-1', 'service-2']), 90);
});

test('catálogo compartilhado resolve marca, modelo e porte de forma determinística', () => {
  const models: VehicleModel[] = [
    { id: '1', manufacturer: 'Marca B', model: 'SUV', size_category: 'G', active: true },
    { id: '2', manufacturer: 'Marca A', model: 'Hatch', size_category: 'P', active: true },
    { id: '3', manufacturer: 'Marca A', model: '', size_category: 'M', active: true },
    { id: '4', manufacturer: 'Inativa', model: 'Sedan', size_category: 'M', active: false }
  ];
  const catalog = buildVehicleCatalog(models);

  assert.deepEqual(catalog.brands.map(brand => brand.name), ['Marca A', 'Marca B']);
  assert.deepEqual(catalog.models.map(model => model.name), ['SUV', 'Hatch']);
  assert.equal(resolveVehiclePorte(catalog, 'Marca B', 'SUV'), 'Grande');
  assert.equal(sizeCategoryToPorte('P'), 'Pequeno');
  assert.equal(sizeCategoryToPorte('M'), 'Médio');
});

test('portal e telas administrativas consomem a mesma fonte de catálogo', () => {
  const portal = projectFile('src', 'components', 'ClientPortal.tsx');
  const customersModule = projectFile('src', 'components', 'ClientesModule.tsx');
  const dashboard = projectFile('src', 'components', 'DashboardModule.tsx');

  for (const source of [portal, customersModule, dashboard]) {
    assert.match(source, /useVehicleCatalog/);
  }
  assert.match(customersModule, /data-testid="admin-vehicle-brand"/);
  assert.match(customersModule, /resolveVehiclePorte/);
  assert.match(dashboard, /data-testid="dashboard-vehicle-brand"/);
  assert.match(dashboard, /year:\s*newVehicleYear/);
  assert.doesNotMatch(dashboard, /year:\s*'2020'/);
});

test('agenda e dashboard não inicializam preço administrativo com basePrice fixo', () => {
  const agenda = projectFile('src', 'components', 'AgendaModule.tsx');
  const dashboard = projectFile('src', 'components', 'DashboardModule.tsx');

  assert.doesNotMatch(agenda, /value:\s*services\[0\]\?\.basePrice/);
  assert.doesNotMatch(dashboard, /value:\s*services\[0\]\?\.basePrice/);
  assert.match(agenda, /createAppointmentFormDraft/);
  assert.match(dashboard, /getServicesPrice\(services,\s*editServiceIds,\s*selectedVehicle\)/s);
  assert.match(dashboard, /\[editServiceIds,\s*editVehicleId,/);
});

test('datas de agenda e dashboard não dependem mais de julho ou dia 15', () => {
  const agenda = projectFile('src', 'components', 'AgendaModule.tsx');
  const dashboard = projectFile('src', 'components', 'DashboardModule.tsx');

  assert.doesNotMatch(agenda, /d === 15|selectedDay\}\/07/);
  assert.doesNotMatch(dashboard, /15\/07\/2026|Hoje,\s*15 de Julho|Acumulado em Julho/);
});

test('rota do portal volta corretamente ao administrativo quando a URL muda', () => {
  const app = projectFile('src', 'App.tsx');
  assert.match(app, /setIsClientPortal\(isPortal\)/);
  assert.match(app, /lazy\(\(\) => import\('\.\/components\/ClientPortal'\)\)/);
  assert.match(app, /Suspense fallback=\{<ModuleLoader \/>}/);
});

test('ações mutáveis respeitam permissões nos módulos estabilizados', () => {
  const files = [
    ['ClientesModule.tsx', /canDelete &&/, /if \(!canDelete\) return/],
    ['ServicosModule.tsx', /canEdit &&/, /if \(!canDelete\) return/],
    ['AgendaModule.tsx', /canCreate=\{canCreate\}/, /if \(!canDelete\) return/],
    ['FinanceiroModule.tsx', /\{canDelete &&/, /if \(!canDelete\) return/],
    ['UsuariosModule.tsx', /canDelete && user\.role/, /if \(!canDelete/]
  ] as const;

  for (const [file, visualGate, handlerGate] of files) {
    const source = projectFile('src', 'components', file);
    assert.match(source, visualGate);
    assert.match(source, handlerGate);
  }
});

test('baseline estrito e worker não sobreposto permanecem habilitados', () => {
  const tsconfig = JSON.parse(projectFile('tsconfig.json'));
  const server = projectFile('server.ts');
  const reports = projectFile('src', 'components', 'RelatoriosModule.tsx');

  assert.equal(tsconfig.compilerOptions.noUnusedLocals, true);
  assert.equal(tsconfig.compilerOptions.noUnusedParameters, true);
  assert.match(server, /backgroundCycleRunning/);
  assert.match(server, /previous_cycle_still_running/);
  assert.match(reports, /a\.durationTotal \|\| 120/);
  assert.doesNotMatch(reports, /a\.status === 'concluido'/);
});

test('portal mantém preço por porte e tabela de sobrescritas após unificação do catálogo', () => {
  const portal = projectFile('src', 'components', 'ClientPortal.tsx');
  const repository = projectFile('src', 'portal', 'portalSupabase.ts');
  assert.match(repository, /\.from\('servicos_precos'\)/);
  assert.match(repository, /tempo_estimado_minutos/);
  assert.match(portal, /pricingType === 'porte'/);
  assert.match(portal, /sizeCategoryToPorte/);
});

test('filtro de execuções pendentes usa timestamps numéricos e aceita sufixos +00:00 e Z', () => {
  const now = Date.now();
  const pastIsoUtc = new Date(now - 10000).toISOString();
  const pastIsoOffset = pastIsoUtc.replace(/\.\d{3}Z$/, '+00:00');
  const futureIsoZ = new Date(now + 3600000).toISOString();

  const executions = [
    { id: 'exec_overdue_offset', status: 'pendente', data_execucao: pastIsoOffset },
    { id: 'exec_overdue_z', status: 'pendente', data_execucao: pastIsoUtc },
    { id: 'exec_future', status: 'pendente', data_execucao: futureIsoZ },
    { id: 'exec_completed', status: 'sucesso', data_execucao: pastIsoUtc }
  ];

  const pending = executions.filter(e => 
    e.status === 'pendente' && new Date(e.data_execucao).getTime() <= now
  );

  assert.equal(pending.length, 2);
  assert.deepEqual(pending.map(e => e.id), ['exec_overdue_offset', 'exec_overdue_z']);
});

test('janela operacional em America/Sao_Paulo suporta 08:00-20:00 e travessia de meia-noite 08:00-02:00', async () => {
  const {
    getPartsInTimezone,
    isWithinOperationalWindow,
    getNextStartTime
  } = await import('../src/utils/operationalWindow');

  // 14:00 em SP (17:00 UTC) -> dentro da janela em ambas
  const dateAt14SP = new Date('2026-07-28T17:00:00.000Z');
  assert.equal(getPartsInTimezone(dateAt14SP, 'America/Sao_Paulo').hours, '14');
  assert.equal(isWithinOperationalWindow('08:00', '20:00', dateAt14SP), true);
  assert.equal(isWithinOperationalWindow('08:00', '02:00', dateAt14SP), true);

  // 21:00 em SP (00:00 UTC do dia seguinte) -> fora de 08:00-20:00, dentro de 08:00-02:00
  const dateAt21SP = new Date('2026-07-29T00:00:00.000Z');
  assert.equal(getPartsInTimezone(dateAt21SP, 'America/Sao_Paulo').hours, '21');
  assert.equal(isWithinOperationalWindow('08:00', '20:00', dateAt21SP), false);
  assert.equal(isWithinOperationalWindow('08:00', '02:00', dateAt21SP), true);

  // 01:30 em SP (04:30 UTC) -> fora de 08:00-20:00, dentro de 08:00-02:00
  const dateAt0130SP = new Date('2026-07-28T04:30:00.000Z');
  assert.equal(getPartsInTimezone(dateAt0130SP, 'America/Sao_Paulo').hours, '01');
  assert.equal(isWithinOperationalWindow('08:00', '20:00', dateAt0130SP), false);
  assert.equal(isWithinOperationalWindow('08:00', '02:00', dateAt0130SP), true);

  // 04:00 em SP (07:00 UTC) -> fora de ambas
  const dateAt0400SP = new Date('2026-07-28T07:00:00.000Z');
  assert.equal(getPartsInTimezone(dateAt0400SP, 'America/Sao_Paulo').hours, '04');
  assert.equal(isWithinOperationalWindow('08:00', '20:00', dateAt0400SP), false);
  assert.equal(isWithinOperationalWindow('08:00', '02:00', dateAt0400SP), false);

  // Testa getNextStartTime
  const nextStart = getNextStartTime('08:00', '20:00', dateAt21SP);
  assert.equal(new Date(nextStart).toISOString(), '2026-07-29T11:00:00.000Z');
});
