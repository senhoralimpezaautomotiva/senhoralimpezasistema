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

test('modo 24 horas persiste no Supabase e mantém compatibilidade com o Make', () => {
  const localDb = projectFile('src', 'db', 'localDb.ts');
  const engine = projectFile('src', 'db', 'automationEngine.ts');
  const transport = projectFile('src', 'server', 'automationTransport.ts');
  const migration = projectFile(
    'supabase',
    'migrations',
    '20260730233000_automacoes_janela_24h.sql'
  );

  assert.match(localDb, /automation_24_hours/);
  assert.match(localDb, /automation_start_hour/);
  assert.match(localDb, /automation_end_hour/);
  assert.match(engine, /!dbInstance\.config\.automation24Hours/);
  assert.match(transport, /telefone:\s*payload\.phone/);
  assert.match(transport, /formattedMessage:\s*payload\.message/);
  assert.match(migration, /automation_24_hours BOOLEAN NOT NULL DEFAULT FALSE/);
  const dryRun = projectFile('scripts', 'automations', 'run-dry-run.ps1');
  assert.match(dryRun, /20260730233000_automacoes_janela_24h\.sql/);
});

test('configuração parcial recebe as quatro automações imediatas sem sobrescrever entradas existentes', () => {
  const migration = projectFile(
    'supabase',
    'migrations',
    '20260731001000_automacoes_imediatas_defaults.sql'
  );

  for (const event of [
    'novo_cliente',
    'novo_agendamento',
    'servico_iniciado',
    'servico_finalizado'
  ]) {
    assert.match(migration, new RegExp(`'event', '${event}'`));
  }

  assert.match(migration, /existing\.item->>'event' = defaults\.item->>'event'/);
  assert.match(migration, /\|\| missing_array\.items/);
  assert.doesNotMatch(migration, /SET automations = missing_array\.items/);
});

test('lembretes são deduplicados por horário e invalidados por mudança do agendamento', () => {
  const engine = projectFile('src', 'db', 'automationEngine.ts');
  const localDb = projectFile('src', 'db', 'localDb.ts');
  const migration = projectFile(
    'supabase',
    'migrations',
    '20260805220000_lembrete_seguranca.sql'
  );

  assert.match(engine, /validateReminderBeforeSend/);
  assert.match(engine, /buildReminderDeduplicationKey\(appt\.id, appt\.dateTime\)/);
  assert.match(localDb, /buildReminderDeduplicationKey/);
  assert.match(migration, /AFTER UPDATE OF status, data_agendamento, hora_agendamento/);
  assert.match(migration, /automacao = 'lembrete_agendamento'/);
  assert.match(migration, /status = 'cancelada'/);
  assert.match(migration, /legacy_reminder_pending:/);
});

test('cliente inativo usa cadência 0, 7 e 21 sem backfill do ciclo legado', () => {
  const engine = projectFile('src', 'db', 'automationEngine.ts');
  const localDb = projectFile('src', 'db', 'localDb.ts');
  const policy = projectFile('src', 'db', 'inactiveCustomerPolicy.ts');
  const documentation = projectFile('docs', 'CLIENTE_INATIVO_CADENCIA.md');
  const portalMigration = projectFile(
    'supabase',
    'migrations',
    '20260724213000_portal001_client_auth_and_isolation.sql'
  );
  const migration = projectFile(
    'supabase',
    'migrations',
    '20260805230000_cliente_inativo_seguranca.sql'
  );

  assert.match(engine, /evaluateInactiveCustomer/);
  assert.match(engine, /evaluateInactiveCustomerCadence/);
  assert.match(engine, /validateInactiveCustomerBeforeSend/);
  assert.match(engine, /const minServices = inactiveTrigger\.minServices/);
  assert.match(engine, /inactiveDays,\s*minServices,\s*now/);
  assert.match(localDb, /cliente_inativo:\s*buildInactiveCustomerDeduplicationKey/);
  assert.match(localDb, /context\.inactiveCustomerStage \?\? 1/);
  assert.match(localDb, /from\('agendamentos'\)\.insert/);
  assert.match(localDb, /createdAt:\s*row\.created_at/);
  assert.match(portalMigration, /insert into public\.agendamentos/);
  assert.match(policy, /2:\s*7/);
  assert.match(policy, /3:\s*21/);
  assert.match(policy, /legacy_cycle/);
  assert.match(policy, /appointment_after_first_message/);
  assert.match(policy, /:etapa:\$\{stage\}/);
  assert.match(documentation, /produtor único/);
  assert.match(documentation, /Portal do Cliente ou pelo profissional/);
  assert.match(documentation, /não envia acompanhamentos retroativos/);
  assert.match(migration, /cliente_inativo:/);
  assert.match(migration, /legacy_inactive_pending:/);
  assert.doesNotMatch(migration, /INSERT INTO public\.automacoes_execucoes/);
});

test('finalização usa o estado aceito pelo Supabase e a interface não engole falhas de persistência', () => {
  const localDb = projectFile('src', 'db', 'localDb.ts');
  const app = projectFile('src', 'App.tsx');

  assert.match(localDb, /finalizado:\s*'Concluído'/);
  assert.doesNotMatch(localDb, /finalizado:\s*'Finalizado'/);

  const updateHandlers = app.match(
    /onUpdateAppointment=\{async \(id, updated\) => \{[\s\S]*?throw e;[\s\S]*?\}\}/g
  );
  assert.equal(updateHandlers?.length, 2);
});

test('aniversario usa politica de Sao Paulo, chave anual e guarda antes do envio', () => {
  const engine = projectFile('src', 'db', 'automationEngine.ts');
  const localDb = projectFile('src', 'db', 'localDb.ts');
  const policy = projectFile('src', 'db', 'birthdayPolicy.ts');

  assert.match(engine, /evaluateBirthday/);
  assert.match(engine, /validateBirthdayBeforeSend/);
  assert.match(engine, /automationReferenceDate: now/);
  assert.match(localDb, /buildBirthdayDeduplicationKey/);
  assert.match(policy, /America\/Sao_Paulo/);
  assert.match(policy, /deduplication_key_mismatch/);
  assert.doesNotMatch(engine, /birthDate\.slice\(5, 10\)/);
  assert.doesNotMatch(engine, /new Date\(\)\.toISOString\(\)\.slice\(5, 10\)/);
});

test('provedor distingue aceitação de entrega e bloqueia retry ambíguo', () => {
  const transport = projectFile('src', 'server', 'automationTransport.ts');
  const policy = projectFile('src', 'db', 'automationProviderPolicy.ts');
  const engine = projectFile('src', 'db', 'automationEngine.ts');
  const module = projectFile('src', 'components', 'AutomacoesModule.tsx');
  const tab = projectFile('src', 'components', 'AutomacoesTab.tsx');

  assert.match(transport, /outcome: 'permanent_failure'/);
  assert.match(transport, /provider: 'unconfigured'/);
  assert.doesNotMatch(transport, /provider: 'simulated'/);
  assert.doesNotMatch(transport, /success: true,[\s\S]*Envio simulado/);
  assert.match(policy, /ambiguous_failure/);
  assert.match(policy, /retry_exhausted/);
  assert.match(policy, /repetição automática bloqueada para evitar duplicidade/);
  assert.match(engine, /entrega não confirmada/);
  assert.match(engine, /accepted && persisted/);
  assert.match(engine, /Persistência no banco não confirmada; não repita o teste automaticamente/);
  assert.match(transport, /outcome === 'accepted' \? 'success' : 'error'/);
  assert.match(module, /Aceitas pelo provedor/);
  assert.match(tab, /Aceitas pelo provedor/);
  assert.match(module, /result\.success/);
  assert.match(module, /Solicitação não aceita pelo provedor/);
  assert.match(tab, /result\.success/);
  assert.match(tab, /Solicitação não aceita pelo provedor/);
  assert.doesNotMatch(module, /Enviadas \(Sucesso\)/);
  assert.doesNotMatch(tab, /Mensagens Enviadas/);
  assert.doesNotMatch(tab, /Executado com sucesso/);
});

test('monitoramento coloca claim vencido em quarentena sem recriá-lo', () => {
  const migration = projectFile(
    'supabase',
    'migrations',
    '20260805233000_automacoes_monitoramento_operacional.sql'
  );
  const monitoring = projectFile('src', 'db', 'automationMonitoring.ts');
  const server = projectFile('server.ts');
  const module = projectFile('src', 'components', 'AutomacoesModule.tsx');
  const tab = projectFile('src', 'components', 'AutomacoesTab.tsx');

  assert.match(migration, /\[CLAIM ABANDONADO\]/);
  assert.match(migration, /Estado anterior preservado/);
  assert.match(migration, /claim_expires_at <= now\(\)/);
  assert.match(migration, /execution\.status = 'pendente'/);
  assert.match(migration, /FOR UPDATE SKIP LOCKED/);
  assert.doesNotMatch(migration, /OR \(\s*execution\.status = 'processando'/);
  assert.doesNotMatch(migration, /claimed_at = NULL/);
  assert.doesNotMatch(migration, /claim_expires_at = NULL/);
  assert.match(monitoring, /STALLED_QUEUE_AFTER_MS/);
  assert.match(monitoring, /abandonedClaimCount/);
  assert.match(server, /summarizeAutomationOperations/);
  assert.match(server, /background_worker\.automation_health/);
  assert.match(module, /reconciliationRequiredCount/);
  assert.match(tab, /reconciliationRequiredCount/);
});

test('módulo de orçamento mantém outbox, isolamento, deduplicação e migration aditiva', () => {
  const migration = projectFile('supabase', 'migrations', '20260805234000_orcamentos_automacoes.sql');
  const engine = projectFile('src', 'db', 'automationEngine.ts');
  const localDb = projectFile('src', 'db', 'localDb.ts');
  const policy = projectFile('src', 'db', 'budgetPolicy.ts');

  assert.match(migration, /CREATE TABLE public\.orcamentos/);
  assert.match(migration, /CREATE TABLE public\.orcamento_itens/);
  assert.match(migration, /INSERT INTO public\.automacoes_eventos/);
  assert.doesNotMatch(migration, /INSERT INTO public\.automacoes_execucoes/);
  assert.match(migration, /EXCEPTION WHEN OTHERS/);
  assert.match(migration, /ON CONFLICT \(deduplication_key\) DO NOTHING/);
  assert.match(migration, /fn_enviar_orcamento/);
  assert.match(migration, /O evento de envio não foi confirmado no outbox/);
  assert.match(migration, /WHERE NOT coalesce\(usuario\.permissions/);
  assert.match(engine, /validateBudgetBeforeSend/);
  assert.match(engine, /orcamento_followup_7d/);
  assert.match(engine, /orcamento_followup_14d/);
  assert.match(localDb, /buildBudgetDeduplicationKey/);
  assert.match(localDb, /orcamento_id: execution\.budget_id/);
  assert.match(policy, /appointment_after_budget_send/);
  assert.match(policy, /seven_day_window_missed/);
});
