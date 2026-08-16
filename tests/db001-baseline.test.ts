import assert from 'node:assert/strict';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { verifyBackupDirectory } from '../scripts/database/verify-backup';

interface SqlArtifact {
  path: string;
  category: string[];
  purpose: string;
  rerunnable: string;
  idempotent: string;
  risk: string;
  recommendation: string;
}

interface CatalogEntry {
  name: string;
  evidenceStatus: string;
  remoteConfirmation: string;
}

interface Db001Manifest {
  task: string;
  remoteState: string;
  backupState: string;
  restoreTestState: string;
  catalogAuthority: string;
  baselineState: string;
  officialMigrationDirectory: string;
  expectedBaselineFilenamePattern: string;
  requestedPreferredFilename: string;
  officialMigrationFiles: string[];
  sqlArtifacts: SqlArtifact[];
  catalog: CatalogEntry[];
  knownDivergences: string[];
}

const root = path.resolve('.');
const read = (...segments: string[]): string =>
  readFileSync(path.join(root, ...segments), 'utf8');
const manifest = JSON.parse(
  read('docs', 'database', 'db001-manifest.json')
) as Db001Manifest;

const walk = (directory: string): string[] => {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
};

test('manifesto registra acesso remoto e backup sem presumir restore local', () => {
  assert.equal(manifest.task, 'DB-001');
  assert.equal(manifest.remoteState, 'linked_and_introspected');
  assert.equal(manifest.backupState, 'logical_backup_verified');
  assert.equal(manifest.restoreTestState, 'pending_isolated_target_due_local_disk_capacity');
  assert.equal(manifest.catalogAuthority, 'remote_schema_dump');
  assert.equal(manifest.baselineState, 'captured_from_remote_schema');
  assert.ok(manifest.catalog.length >= 12);
});

test('supabase/migrations é a única fonte oficial e contém a baseline remota rastreada', () => {
  assert.equal(manifest.officialMigrationDirectory, 'supabase/migrations');
  const migrationsDirectory = path.join(root, manifest.officialMigrationDirectory);
  assert.ok(existsSync(migrationsDirectory));

  const migrationFiles = readdirSync(migrationsDirectory)
    .filter(file => file.endsWith('.sql'))
    .sort();
  assert.deepEqual(migrationFiles, manifest.officialMigrationFiles);
  assert.deepEqual(migrationFiles, [
    '20260724210000_baseline.sql',
    '20260724213000_portal001_client_auth_and_isolation.sql',
    '20260724224500_portal001_email_identity_provider.sql',
    '20260727220000_automacoes_execucoes.sql',
    '20260728220000_automacoes_triggers_nativos.sql',
    '20260729220000_automacoes_fluxo_unificado.sql',
    '20260729223000_automacoes_claim_backfill.sql',
    '20260729230000_automacoes_riscos_residuais.sql',
    '20260730225000_configuracoes_empresa_runtime.sql',
    '20260730233000_automacoes_janela_24h.sql',
    '20260731001000_automacoes_imediatas_defaults.sql',
    '20260805220000_lembrete_seguranca.sql',
    '20260805230000_cliente_inativo_seguranca.sql',
    '20260805233000_automacoes_monitoramento_operacional.sql',
    '20260805234000_orcamentos_automacoes.sql',
    '20260805235000_portal_cliente_experiencia.sql',
    '20260806150000_referral_loyalty_ledger.sql',
    '20260807213000_fix_referral_code_validation.sql',
    '20260815120000_fix_portal_create_cliente_customer_lookup.sql',
    '20260815123000_fix_referral_loyalty_completed_status.sql',
    '20260816143000_portal_force_password_change_backend_guard.sql'
  ]);

  const pattern = new RegExp(manifest.expectedBaselineFilenamePattern);
  assert.ok(pattern.test('20260724000001_baseline.sql'));
  assert.ok(pattern.test(migrationFiles[0]));
  assert.equal(manifest.requestedPreferredFilename, '20260724_000001_baseline.sql');
});

test('migrations futuras têm nomes únicos, compatíveis e ordem determinística', () => {
  const migrations = readdirSync(path.join(root, 'supabase', 'migrations'))
    .filter(file => file.endsWith('.sql'));
  const expectedPattern = /^\d{14}_[a-z0-9][a-z0-9_]*\.sql$/;
  for (const migration of migrations) {
    assert.match(migration, expectedPattern);
  }
  assert.equal(new Set(migrations).size, migrations.length);
  assert.deepEqual([...migrations].sort(), migrations);
});

test('todos os SQL do projeto estão classificados e nenhum legado é oficial', () => {
  const sqlFiles = walk(root)
    .filter(file => file.endsWith('.sql'))
    .filter(file => !path.relative(root, file).startsWith(`.tmp${path.sep}`))
    .filter(file => !file.includes(`${path.sep}.git${path.sep}`))
    .filter(file => !file.includes(`${path.sep}node_modules${path.sep}`))
    .filter(file => !file.includes(`${path.sep}dist${path.sep}`))
    .map(file => path.relative(root, file).replace(/\\/g, '/'))
    .sort();
  const classified = manifest.sqlArtifacts
    .map(artifact => artifact.path)
    .filter(file => file.endsWith('.sql'))
    .sort();
  assert.deepEqual(classified, sqlFiles);

  for (const legacy of [
    'configuracoes_empresa.sql',
    'supabase_sec001_credentials_migration.sql',
    'supabase_usuarios_rls_migration.sql',
    'vehicle_models.sql'
  ]) {
    const artifact = manifest.sqlArtifacts.find(item => item.path === legacy);
    assert.ok(artifact, `Artefato não classificado: ${legacy}`);
    assert.equal(artifact.category.includes('official-migration'), false);
    assert.match(artifact.recommendation, /não executar|sem replay/i);
  }
});

test('scripts avulsos perigosos estão inventariados e fora do fluxo oficial', () => {
  for (const diagnostic of [
    'checkPorte.ts',
    'logInsertErrorDetails.ts',
    'probeAgendamentosColumns.ts',
    'testInsertAgendamentos.ts'
  ]) {
    const artifact = manifest.sqlArtifacts.find(item => item.path === diagnostic);
    assert.ok(artifact, `Diagnóstico ausente: ${diagnostic}`);
    assert.ok(artifact.category.includes('dangerous'));
    assert.match(artifact.recommendation, /não executar/i);
  }
});

test('todas as tabelas consumidas pela aplicação constam no catálogo', () => {
  const applicationFiles = [
    ...walk(path.join(root, 'src')),
    ...walk(path.join(root, 'supabase', 'functions')),
    path.join(root, 'server.ts')
  ].filter(file => /\.(?:ts|tsx)$/.test(file));

  const referencedTables = new Set<string>();
  for (const file of applicationFiles) {
    const contents = readFileSync(file, 'utf8');
    for (const match of contents.matchAll(
      /(?:supabase|adminClient)\s*\.from\(\s*['"]([^'"]+)['"]\s*\)/g
    )) {
      referencedTables.add(match[1]);
    }
  }

  const catalogTables = new Set(
    manifest.catalog.map(entry => entry.name.replace(/^public\./, ''))
  );
  for (const table of referencedTables) {
    assert.ok(catalogTables.has(table), `Tabela sem catálogo: ${table}`);
  }
});

test('divergências críticas entre runtime e DDL embutido estão registradas', () => {
  const localDb = read('src', 'db', 'localDb.ts');
  assert.match(localDb, /row\.cliente_id/);
  assert.match(localDb, /customer_id UUID REFERENCES public\.clientes/);
  assert.match(localDb, /row\.nome_servico/);
  assert.match(localDb, /name VARCHAR\(255\) NOT NULL/);
  assert.ok(
    manifest.knownDivergences.some(item =>
      item.includes('colunas portuguesas') && item.includes('colunas inglesas')
    )
  );
  assert.ok(
    manifest.knownDivergences.some(item =>
      item.includes('marcas_veiculos') &&
      item.includes('modelos_veiculos') &&
      item.includes('servicos_precos')
    )
  );
});

test('introspecção e validação de restore são somente leitura', () => {
  for (const file of [
    ['scripts', 'database', 'introspect_schema.sql'],
    ['scripts', 'database', 'validate_restore.sql']
  ]) {
    const sql = read(...file);
    assert.doesNotMatch(
      sql,
      /^\s*(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|CALL|DO)\b/im
    );
    assert.match(sql, /SELECT/i);
  }
});

test('backups, arquivos físicos e estado temporário do CLI não são versionáveis', () => {
  const gitignore = read('.gitignore');
  assert.match(gitignore, /^backups\/$/m);
  assert.match(gitignore, /^\*\.backup$/m);
  assert.match(gitignore, /^supabase\/\.temp\/$/m);
  assert.match(gitignore, /^supabase\/\.branches\/$/m);
  assert.match(gitignore, /^\.tmp\/$/m);
});

test('verificador rejeita backup incompleto e aceita dump sentinela válido', () => {
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'db001-backup-'));
  try {
    assert.equal(verifyBackupDirectory(temporaryRoot).valid, false);

    mkdirSync(temporaryRoot, { recursive: true });
    writeFileSync(path.join(temporaryRoot, 'roles.sql'), '-- no custom roles\n');
    writeFileSync(
      path.join(temporaryRoot, 'schema.sql'),
      'CREATE TABLE public.db001_sentinel (id bigint PRIMARY KEY);\n'
    );
    writeFileSync(
      path.join(temporaryRoot, 'data.sql'),
      'COPY public.db001_sentinel (id) FROM stdin;\n1\n\\.\n'
    );

    const result = verifyBackupDirectory(temporaryRoot);
    assert.equal(result.valid, true, result.errors.join('; '));
    assert.equal(result.files.length, 3);
    assert.ok(result.files.every(file => /^[a-f0-9]{64}$/.test(file.sha256)));
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test('pipeline preserva SEC-002 a SEC-005 e inclui DB-001', () => {
  const packageJson = JSON.parse(read('package.json')) as {
    scripts: Record<string, string>;
  };
  assert.ok(packageJson.scripts['test:db001']);
  assert.ok(packageJson.scripts['db:backup:verify']);
  for (const suite of [
    'test:sec002',
    'test:sec003',
    'test:sec004',
    'test:sec005',
    'test:db001'
  ]) {
    assert.match(packageJson.scripts['security:ci'], new RegExp(suite));
  }
});
