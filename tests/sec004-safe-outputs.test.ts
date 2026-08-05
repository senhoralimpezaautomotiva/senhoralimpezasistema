import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { auditSecurityEvent } from '../src/server/adminApiSecurity';
import {
  buildSafeLogEntry,
  escapeHtml,
  maskPhone,
  neutralizeCsvFormula,
  redactExternalResponse,
  setSafeText,
  toCsvCell,
  type SafeLogDetails
} from '../src/security/safeOutput';

const projectFile = (...segments: string[]): string =>
  readFileSync(path.resolve(...segments), 'utf8');

test('log estruturado descarta payload, token, webhook, URL privada e PII não permitida', () => {
  const unsafeDetails = {
    entityId: 'customer_123',
    phone: '+55 (11) 98765-4321',
    error: {
      code: 'PROVIDER_FAILURE',
      message: 'Bearer token-super-secreto https://hooks.example/private'
    },
    payload: { cpf: '123.456.789-00', nome: 'Pessoa Completa' },
    authorization: 'Bearer token-super-secreto',
    webhook: 'https://hooks.example/private'
  } as SafeLogDetails & Record<string, unknown>;

  const serialized = JSON.stringify(
    buildSafeLogEntry('error', 'provider.send', 'error', unsafeDetails)
  );

  assert.match(serialized, /"type":"application_event"/);
  assert.match(serialized, /"correlationId":/);
  assert.match(serialized, /"entityId":"customer_123"/);
  assert.match(serialized, /"maskedPhone":"\*\*\*4321"/);
  assert.match(serialized, /"errorCode":"PROVIDER_FAILURE"/);
  assert.doesNotMatch(serialized, /98765-4321|123\.456\.789-00|Pessoa Completa/);
  assert.doesNotMatch(serialized, /token-super-secreto|hooks\.example|Bearer|authorization|payload/);
});

test('auditoria administrativa aceita somente campos diagnósticos permitidos', () => {
  const originalConsoleInfo = console.info;
  let serialized = '';
  console.info = (value?: unknown) => {
    serialized = String(value ?? '');
  };

  try {
    (auditSecurityEvent as any)(
      {
        securityRequestId: 'corr-sec004',
        method: 'POST',
        originalUrl: '/api/database/sync?token=nao-logar',
        ip: '127.0.0.1',
        socket: {}
      },
      'database.sync',
      'error',
      {
        reason: 'provider_failed',
        token: 'token-super-secreto',
        webhook: 'https://hooks.example/private',
        payload: { cpf: '123.456.789-00' }
      }
    );
  } finally {
    console.info = originalConsoleInfo;
  }

  assert.match(serialized, /"requestId":"corr-sec004"/);
  assert.match(serialized, /"path":"\/api\/database\/sync"/);
  assert.match(serialized, /"reason":"provider_failed"/);
  assert.doesNotMatch(serialized, /nao-logar|token-super-secreto|hooks\.example|123\.456/);
});

test('telefone aparece somente mascarado pelos quatro últimos dígitos', () => {
  assert.equal(maskPhone('+55 (11) 98765-4321'), '***4321');
  assert.equal(maskPhone('123'), '***');
  assert.equal(maskPhone(''), '***');
});

test('escaping converte payloads HTML e JavaScript em texto inerte', () => {
  const attacks = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '"><svg onload=alert(1)>'
  ];

  for (const attack of attacks) {
    const escaped = escapeHtml(attack);
    assert.doesNotMatch(escaped, /<script|<img|<svg/i);
    assert.match(escaped, /&lt;/);
  }
});

test('impressão segura atribui payload malicioso apenas como textContent', () => {
  const target = { textContent: null as string | null };
  const payload = '<img src=x onerror=alert(1)>';
  setSafeText(target, payload);
  assert.equal(target.textContent, payload);

  const dashboardSource = projectFile('src', 'components', 'DashboardModule.tsx');
  assert.doesNotMatch(
    dashboardSource,
    /document\.write|innerHTML|outerHTML|insertAdjacentHTML|dangerouslySetInnerHTML/
  );
  assert.match(dashboardSource, /setSafeText\(element, value\)/);
  assert.match(dashboardSource, /createTextNode/);
});

test('CSV neutraliza fórmulas iniciadas por =, +, - e @ antes do quoting', () => {
  const formulas = [
    '=HYPERLINK("http://exemplo.com")',
    '+SUM(1,1)',
    '-2+3',
    '@SUM(1,2)'
  ];

  for (const formula of formulas) {
    assert.equal(neutralizeCsvFormula(formula), `'${formula}`);
    const cell = toCsvCell(formula);
    assert.equal(cell.startsWith(`"'`), true);
    assert.equal(cell.endsWith('"'), true);
  }
  assert.equal(neutralizeCsvFormula('texto comum'), 'texto comum');
  assert.equal(neutralizeCsvFormula('  =SUM(1,2)'), "'  =SUM(1,2)");
});

test('exportação CSV aplica proteção a todas as células e usa Blob em vez de data URL', () => {
  const reportSource = projectFile('src', 'components', 'RelatoriosModule.tsx');
  assert.match(reportSource, /\.map\(toCsvCell\)/);
  assert.match(reportSource, /new Blob\(\[csvContent\]/);
  assert.match(reportSource, /URL\.createObjectURL\(csvBlob\)/);
  assert.match(reportSource, /URL\.revokeObjectURL\(objectUrl\)/);
  assert.doesNotMatch(reportSource, /encodeURI\(csvContent\)/);
});

test('resposta externa preserva apenas status técnico e redige conteúdo legado', () => {
  assert.equal(
    redactExternalResponse('[Z-API] Status HTTP: 202\n[Make Webhook] Status HTTP: 204'),
    'Provedor externo: HTTP 202\nProvedor externo: HTTP 204'
  );

  const legacyResponse = JSON.stringify({
    url: 'https://api.z-api.io/instances/private/token/private/send-text',
    token: 'token-super-secreto',
    response: { customerName: 'Pessoa Completa', phone: '5511987654321' }
  });
  const redacted = redactExternalResponse(legacyResponse);
  assert.equal(redacted, 'Resposta externa redigida');
  assert.doesNotMatch(redacted, /z-api|token|Pessoa|5511/);

  assert.equal(
    redactExternalResponse(
      'Provedor Make: webhook aceito na fila do Make; entrega ainda não confirmada. HTTP 200.'
    ),
    'Provedor Make: solicitação aceita; entrega não confirmada. HTTP 200.'
  );
  assert.equal(
    redactExternalResponse(
      '[RESULTADO AMBÍGUO] Provedor Z-API: resultado ambíguo; repetição automática bloqueada para evitar duplicidade.'
    ),
    'Provedor Z-API: resultado ambíguo; retry automático bloqueado.'
  );
  assert.equal(
    redactExternalResponse(
      '[CLAIM ABANDONADO] Reconciliação necessária: contato protegido.'
    ),
    'Reconciliação necessária: claim expirado; reenvio automático bloqueado.'
  );
});

test('API administrativa redige PII, mensagens e respostas externas e correlaciona erros', () => {
  const serverSource = projectFile('server.ts');
  assert.match(serverSource, /telefone: maskPhone\(e\.telefone\)/);
  assert.match(serverSource, /mensagem: 'Conteúdo da mensagem redigido\.'/);
  assert.match(serverSource, /resposta_api: redactExternalResponse\(e\.resposta_api\)/);
  assert.match(serverSource, /correlationId: req\.securityRequestId/);
  assert.doesNotMatch(serverSource, /cliente: customer \? customer\.name/);
});

test('caminhos auditados não enviam objetos brutos ao console', () => {
  const auditedFiles = [
    projectFile('src', 'components', 'ClientPortal.tsx'),
    projectFile('src', 'components', 'DashboardModule.tsx'),
    projectFile('src', 'components', 'RelatoriosModule.tsx'),
    projectFile('src', 'db', 'localDb.ts'),
    projectFile('src', 'db', 'automationEngine.ts'),
    projectFile('server.ts')
  ].join('\n');

  assert.doesNotMatch(auditedFiles, /console\.(log|info|warn|error)\s*\(/);
  assert.doesNotMatch(auditedFiles, /logs\.push\([^)]*(customer\.name|referralCode|telefone|mensagem)/s);
  assert.doesNotMatch(auditedFiles, /API Error.*(err\.message|error\.message)/);
});

test('proteções SEC-002 e SEC-003 permanecem conectadas aos fluxos administrativos', () => {
  const serverSource = projectFile('server.ts');
  const engineSource = projectFile('src', 'db', 'automationEngine.ts');
  const transportSource = projectFile('src', 'server', 'automationTransport.ts');
  const publicConfigSource = projectFile('src', 'security', 'publicConfig.ts');

  assert.match(serverSource, /authenticateAdministrativeApi/);
  assert.match(serverSource, /requireAccess/);
  assert.match(serverSource, /createRateLimit/);
  assert.match(transportSource, /getIntegrationSecrets/);
  assert.doesNotMatch(engineSource + transportSource, /import\.meta\.env/);
  assert.match(publicConfigSource, /PUBLIC_SYSTEM_CONFIG_KEYS/);
  assert.match(publicConfigSource, /sanitizeLegacyConfigStorage/);
});
