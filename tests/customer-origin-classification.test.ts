import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mapDbCustomerToFrontend, mapFrontendCustomerToDb } from '../src/db/localDb';

const source = (...segments: string[]): string => readFileSync(segments.join('/'), 'utf8');

test('cliente administrativo persiste origem paga em metadados estruturados', () => {
  const row = mapFrontendCustomerToDb({
    name: 'Cliente Teste',
    phone: '(11) 99999-0000',
    whatsapp: '11999990000',
    email: 'cliente@example.com',
    birthDate: '1990-01-01',
    status: 'ativo',
    origin: 'Facebook',
    paidTrafficSource: 'facebook_ads'
  });

  assert.match(row.nome, /"origin":"Facebook"/);
  assert.match(row.nome, /"paidTrafficSource":"facebook_ads"/);

  const restored = mapDbCustomerToFrontend({
    id: 'customer-1',
    nome: row.nome,
    telefone: row.telefone,
    data_aniversario: row.data_aniversario,
    created_at: '2026-08-27T00:00:00Z'
  });

  assert.equal(restored.origin, 'Facebook');
  assert.equal(restored.paidTrafficSource, 'facebook_ads');
});

test('origem detalhada e opcoes Ads ficam apenas no cadastro administrativo', () => {
  const customersModule = source('src', 'components', 'ClientesModule.tsx');
  const portal = [
    source('src', 'components', 'ClientPortal.tsx'),
    source('src', 'components', 'ClientPortalHome.tsx')
  ].join('\n');

  assert.match(customersModule, /Facebook/);
  assert.match(customersModule, /Google Ads/);
  assert.match(customersModule, /Facebook Ads/);
  assert.match(customersModule, /originDetail/);

  assert.doesNotMatch(portal, /Google Ads|Facebook Ads|originDetail|Origem detalhada/);
});
