import assert from 'node:assert/strict';
import test from 'node:test';
import type { ModulePermission, SystemModuleId } from '../src/types';
import {
  FixedWindowRateLimiter,
  createSupabaseAuthentication,
  extractBearerToken,
  isAuthorized,
  requireAccess,
  validateAutomationId,
  type AdminApiAuthContext
} from '../src/server/adminApiSecurity';

const fullPermission = (enabled: boolean): ModulePermission => ({
  view: enabled,
  create: enabled,
  edit: enabled,
  delete: enabled
});

const context = (
  role: AdminApiAuthContext['role'],
  module: SystemModuleId,
  permission: ModulePermission
): AdminApiAuthContext => ({
  authUserId: '00000000-0000-0000-0000-000000000001',
  profileId: '00000000-0000-0000-0000-000000000002',
  role,
  permissions: { [module]: permission }
});

test('extrai somente bearer token estrito', () => {
  assert.equal(extractBearerToken('Bearer header.payload.signature'), 'header.payload.signature');
  assert.equal(extractBearerToken('bearer header.payload.signature'), null);
  assert.equal(extractBearerToken('Bearer token com espaco'), null);
  assert.equal(extractBearerToken(undefined), null);
});

test('autoriza perfil administrativo com permissão granular', () => {
  assert.equal(
    isAuthorized(context('admin', 'automacoes', fullPermission(true)), {
      module: 'automacoes',
      action: 'edit',
      allowedRoles: ['admin', 'gerente']
    }),
    true
  );
});

test('nega perfil não permitido mesmo quando a matriz contém permissão', () => {
  assert.equal(
    isAuthorized(context('atendente', 'automacoes', fullPermission(true)), {
      module: 'automacoes',
      action: 'view',
      allowedRoles: ['admin', 'gerente']
    }),
    false
  );
});

test('nega perfil permitido quando a ação granular está desabilitada', () => {
  assert.equal(
    isAuthorized(context('gerente', 'configuracoes', {
      view: true,
      create: false,
      edit: false,
      delete: false
    }), {
      module: 'configuracoes',
      action: 'edit',
      allowedRoles: ['admin', 'gerente']
    }),
    false
  );
});

test('rate limiter bloqueia excesso e libera após a janela', () => {
  const limiter = new FixedWindowRateLimiter(1_000, 2);
  assert.equal(limiter.consume('actor', 1_000).allowed, true);
  assert.equal(limiter.consume('actor', 1_100).allowed, true);
  const blocked = limiter.consume('actor', 1_200);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.equal(limiter.consume('actor', 2_001).allowed, true);
});

const mockResponse = () => {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    headers: new Map<string, string>(),
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers.set(name, value);
      return this;
    }
  };
  return response;
};

test('middleware de autenticação rejeita chamada sem bearer antes de acessar o Supabase', async () => {
  const middleware = createSupabaseAuthentication(() => ({
    url: 'https://example.supabase.co',
    anonKey: 'public-test-key'
  }));
  const request = {
    header: () => undefined,
    method: 'GET',
    originalUrl: '/api/automations/dashboard',
    ip: '127.0.0.1',
    socket: {}
  };
  const response = mockResponse();
  let nextCalled = false;

  await (middleware as any)(request, response, () => {
    nextCalled = true;
  });

  assert.equal(response.statusCode, 401);
  assert.equal(nextCalled, false);
});

test('middleware de autorização rejeita atendente em API administrativa', () => {
  const middleware = requireAccess({
    module: 'automacoes',
    action: 'view',
    allowedRoles: ['admin', 'gerente']
  });
  const request = {
    adminAuth: context('atendente', 'automacoes', fullPermission(true)),
    method: 'GET',
    originalUrl: '/api/automations/dashboard',
    ip: '127.0.0.1',
    socket: {}
  };
  const response = mockResponse();
  let nextCalled = false;

  (middleware as any)(request, response, () => {
    nextCalled = true;
  });

  assert.equal(response.statusCode, 403);
  assert.equal(nextCalled, false);
});

test('validação rejeita identificador de automação malformado', () => {
  const request = { params: { id: '../segredo' } };
  const response = mockResponse();
  let nextCalled = false;

  (validateAutomationId as any)(request, response, () => {
    nextCalled = true;
  });

  assert.equal(response.statusCode, 400);
  assert.equal(nextCalled, false);
});
