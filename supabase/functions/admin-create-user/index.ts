// @ts-ignore -- O specifier npm: é resolvido pelo runtime Deno da Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2';

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const allowedProfiles = new Set([
  'admin',
  'gerente',
  'atendente',
  'tecnico',
  'personalizado',
]);

const allowedModules = new Set([
  'dashboard',
  'clientes',
  'servicos',
  'agenda',
  'historico',
  'financeiro',
  'relatorios',
  'mensagens',
  'automacoes',
  'indicacoes',
  'configuracoes',
  'usuarios',
]);

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const consumeRateLimit = (key: string, maxRequests: number, windowMs = 60_000) => {
  const now = Date.now();
  if (rateLimitStore.size > 5000) {
    for (const [entryKey, entry] of rateLimitStore) {
      if (entry.resetAt <= now) rateLimitStore.delete(entryKey);
    }
  }

  const current = rateLimitStore.get(key);
  const entry = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + windowMs }
    : current;
  entry.count += 1;
  rateLimitStore.set(key, entry);

  return {
    allowed: entry.count <= maxRequests,
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  };
};

const createJsonResponse = (
  status: number,
  body: Record<string, unknown>,
  additionalHeaders: Record<string, string> = {},
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...additionalHeaders,
    },
  });

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isValidPermissions = (value: unknown): value is Record<string, unknown> => {
  if (!isPlainObject(value)) return false;
  const entries = Object.entries(value);
  if (entries.length === 0 || entries.some(([moduleId]) => !allowedModules.has(moduleId))) {
    return false;
  }
  return entries.every(([, permission]) => {
    if (!isPlainObject(permission)) return false;
    const keys = Object.keys(permission);
    return keys.length === 4 &&
      ['view', 'create', 'edit', 'delete'].every(
        action => typeof permission[action] === 'boolean',
      );
  });
};

const isValidCommissions = (value: unknown): value is Array<Record<string, unknown>> =>
  Array.isArray(value) &&
  value.length <= 100 &&
  value.every(rule =>
    isPlainObject(rule) &&
    typeof rule.serviceId === 'string' &&
    rule.serviceId.length <= 100 &&
    Number.isFinite(Number(rule.percentage)) &&
    Number(rule.percentage) >= 0 &&
    Number(rule.percentage) <= 100
  );

Deno.serve(async (request) => {
  const requestId = crypto.randomUUID();
  const jsonResponse = (
    status: number,
    body: Record<string, unknown>,
    additionalHeaders: Record<string, string> = {},
  ) => createJsonResponse(
    status,
    status >= 400 ? { ...body, correlationId: requestId } : body,
    { 'X-Correlation-Id': requestId, ...additionalHeaders },
  );
  const sourceIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const audit = (
    event: string,
    outcome: 'success' | 'denied' | 'error',
    actorAuthUserId?: string,
    details: { reason?: string; createdProfileId?: string } = {},
  ) => {
    console.log(JSON.stringify({
      type: 'security_audit',
      timestamp: new Date().toISOString(),
      requestId,
      event,
      outcome,
      sourceIp,
      actorAuthUserId,
      reason: details.reason,
      createdProfileId: details.createdProfileId,
    }));
  };

  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    audit('users.create', 'denied', undefined, { reason: 'method_not_allowed' });
    return jsonResponse(405, { error: 'Método não permitido.' });
  }

  const unauthenticatedLimit = consumeRateLimit(`admin-create-user:ip:${sourceIp}`, 60);
  if (!unauthenticatedLimit.allowed) {
    audit('users.create', 'denied', undefined, { reason: 'ip_rate_limit' });
    return jsonResponse(
      429,
      { error: 'Limite de requisições excedido.' },
      { 'Retry-After': String(unauthenticatedLimit.retryAfterSeconds) },
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    audit('users.create', 'error', undefined, { reason: 'service_not_configured' });
    return jsonResponse(500, { error: 'Serviço administrativo indisponível.' });
  }

  const authorization = request.headers.get('Authorization');
  const accessToken = authorization && authorization.length <= 8192
    ? authorization.match(/^Bearer ([A-Za-z0-9._~-]+)$/)?.[1]
    : undefined;
  if (!accessToken) {
    audit('users.create', 'denied', undefined, { reason: 'missing_bearer_token' });
    return jsonResponse(401, { error: 'Sessão administrativa ausente.' });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const {
    data: { user: requester },
    error: requesterError,
  } = await adminClient.auth.getUser(accessToken);

  if (requesterError || !requester || requester.aud !== 'authenticated') {
    audit('users.create', 'denied', undefined, { reason: 'invalid_or_expired_session' });
    return jsonResponse(401, { error: 'Sessão administrativa inválida ou expirada.' });
  }

  const { data: requesterProfile, error: requesterProfileError } = await adminClient
    .from('usuarios')
    .select('id, auth_user_id, perfil, status')
    .eq('auth_user_id', requester.id)
    .maybeSingle();

  if (requesterProfileError) {
    audit('users.create', 'error', requester.id, { reason: 'profile_lookup_failed' });
    return jsonResponse(500, { error: 'Não foi possível validar o perfil do administrador.' });
  }

  if (
    !requesterProfile ||
    requesterProfile.auth_user_id !== requester.id ||
    requesterProfile.perfil !== 'admin' ||
    requesterProfile.status !== 'ativo'
  ) {
    audit('users.create', 'denied', requester.id, { reason: 'inactive_or_non_admin_profile' });
    return jsonResponse(403, { error: 'Somente um administrador ativo pode cadastrar usuários.' });
  }

  const actorLimit = consumeRateLimit(`admin-create-user:actor:${requester.id}`, 10);
  if (!actorLimit.allowed) {
    audit('users.create', 'denied', requester.id, { reason: 'actor_rate_limit' });
    return jsonResponse(
      429,
      { error: 'Limite de criação de usuários excedido.' },
      { 'Retry-After': String(actorLimit.retryAfterSeconds) },
    );
  }

  let body: Record<string, unknown>;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 32 * 1024) {
      audit('users.create', 'denied', requester.id, { reason: 'payload_too_large' });
      return jsonResponse(413, { error: 'Corpo da requisição excede o limite permitido.' });
    }
    body = JSON.parse(rawBody);
    if (!isPlainObject(body)) throw new Error('invalid_body');
  } catch {
    audit('users.create', 'denied', requester.id, { reason: 'invalid_json' });
    return jsonResponse(400, { error: 'Corpo JSON inválido.' });
  }

  const nome = typeof body.nome === 'string' ? body.nome.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const telefone = typeof body.telefone === 'string' ? body.telefone.trim() : '';
  const fotoUrl = typeof body.foto_url === 'string' ? body.foto_url.trim() : '';
  const perfil = typeof body.perfil === 'string' ? body.perfil : '';
  const status = body.status === 'inativo' ? 'inativo' : body.status === 'ativo' ? 'ativo' : '';
  const permissions = body.permissions;
  const commissions = body.commissions;
  const defaultCommissionPercent = Number(body.default_commission_percent);
  const validationError = (reason: string, error: string) => {
    audit('users.create', 'denied', requester.id, { reason });
    return jsonResponse(400, { error });
  };

  if (!nome || nome.length > 120) {
    return validationError('invalid_name', 'Nome é obrigatório e deve ter até 120 caracteres.');
  }
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return validationError('invalid_email', 'E-mail inválido.');
  }
  if (password.length < 6 || password.length > 128) {
    return validationError('invalid_password_policy', 'A senha deve conter entre 6 e 128 caracteres.');
  }
  if (telefone.length > 30 || fotoUrl.length > 500) {
    return validationError('invalid_field_length', 'Telefone ou URL da foto excede o limite permitido.');
  }
  if (fotoUrl) {
    try {
      const parsedPhotoUrl = new URL(fotoUrl);
      if (parsedPhotoUrl.protocol !== 'https:') {
        return validationError('insecure_photo_url', 'A URL da foto deve utilizar HTTPS.');
      }
    } catch {
      return validationError('invalid_photo_url', 'URL da foto inválida.');
    }
  }
  if (!allowedProfiles.has(perfil)) {
    return validationError('invalid_target_role', 'Perfil de acesso inválido.');
  }
  if (!status) {
    return validationError('invalid_target_status', 'Status de usuário inválido.');
  }
  if (!isValidPermissions(permissions)) {
    return validationError('invalid_permissions', 'A matriz de permissões é inválida.');
  }
  if (!isValidCommissions(commissions)) {
    return validationError('invalid_commissions', 'As regras de comissão são inválidas.');
  }
  if (
    !Number.isFinite(defaultCommissionPercent) ||
    defaultCommissionPercent < 0 ||
    defaultCommissionPercent > 100
  ) {
    return validationError('invalid_default_commission', 'A comissão padrão é inválida.');
  }

  const { data: authResult, error: authCreateError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authCreateError || !authResult.user) {
    audit('users.create', 'denied', requester.id, { reason: 'identity_creation_rejected' });
    return jsonResponse(authCreateError?.status || 400, {
      error: 'Não foi possível criar o usuário no Authentication.',
    });
  }

  const authUserId = authResult.user.id;
  const { data: profile, error: profileCreateError } = await adminClient
    .from('usuarios')
    .insert({
      auth_user_id: authUserId,
      nome,
      email,
      telefone,
      foto_url: fotoUrl,
      perfil,
      status,
      permissions,
      commissions,
      default_commission_percent: defaultCommissionPercent,
    })
    .select(`
      id,
      auth_user_id,
      nome,
      email,
      telefone,
      foto_url,
      perfil,
      status,
      permissions,
      commissions,
      default_commission_percent,
      created_at,
      updated_at
    `)
    .single();

  if (profileCreateError || !profile) {
    let rollbackError: Error | null = null;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const { error } = await adminClient.auth.admin.deleteUser(authUserId);
      if (!error) {
        rollbackError = null;
        break;
      }
      rollbackError = error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 150));
    }

    if (rollbackError) {
      audit('users.create', 'error', requester.id, {
        reason: 'profile_creation_and_identity_rollback_failed',
      });
      return jsonResponse(500, {
        error: 'Falha crítica ao criar o perfil e reverter a identidade. Consulte a auditoria.',
      });
    }

    audit('users.create', 'error', requester.id, {
      reason: 'profile_creation_failed_rolled_back',
    });
    return jsonResponse(500, {
      error: 'O perfil não pôde ser criado. A identidade temporária foi revertida.',
    });
  }

  audit('users.create', 'success', requester.id, {
    createdProfileId: String(profile.id),
  });
  return jsonResponse(201, { user: profile });
});
