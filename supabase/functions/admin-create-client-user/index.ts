// @ts-ignore -- O specifier npm: e resolvido pelo runtime Deno da Supabase.
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

const FORCE_PASSWORD_CHANGE_FLAG = 'force_password_change';

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const canCreateCustomers = (permissions: unknown): boolean => {
  if (!isPlainObject(permissions)) return false;
  const clientes = permissions.clientes;
  return isPlainObject(clientes) && clientes.create === true;
};

const cleanString = (value: unknown, maxLength: number): string =>
  typeof value === 'string'
    ? value.trim().replace(/[\u0000-\u001F\u007F]/g, '').slice(0, maxLength)
    : '';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Metodo nao permitido.' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { error: 'Funcao nao configurada.' });
  }

  const authorization = request.headers.get('Authorization');
  const accessToken = authorization && authorization.length <= 8192
    ? authorization.match(/^Bearer ([A-Za-z0-9._~-]+)$/)?.[1]
    : null;
  if (!accessToken) {
    return jsonResponse(401, { error: 'Sessao administrativa obrigatoria.' });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: requesterResult, error: requesterError } =
    await adminClient.auth.getUser(accessToken);
  const requester = requesterResult?.user;
  if (requesterError || !requester || requester.aud !== 'authenticated') {
    return jsonResponse(401, { error: 'Sessao administrativa invalida.' });
  }

  const { data: requesterProfile, error: requesterProfileError } = await adminClient
    .from('usuarios')
    .select('id, auth_user_id, perfil, status, permissions')
    .eq('auth_user_id', requester.id)
    .maybeSingle();

  if (
    requesterProfileError ||
    !requesterProfile ||
    requesterProfile.auth_user_id !== requester.id ||
    requesterProfile.status !== 'ativo' ||
    !['admin', 'gerente', 'atendente', 'personalizado'].includes(requesterProfile.perfil) ||
    !canCreateCustomers(requesterProfile.permissions)
  ) {
    return jsonResponse(403, { error: 'Permissao insuficiente para criar acesso de cliente.' });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: 'JSON invalido.' });
  }

  const clienteId = cleanString(body.clienteId, 64);
  const nome = cleanString(body.nome, 120);
  const email = cleanString(body.email, 254).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';

  if (!/^[0-9a-fA-F-]{36}$/.test(clienteId)) {
    return jsonResponse(400, { error: 'Cliente invalido.' });
  }
  if (!nome) {
    return jsonResponse(400, { error: 'Nome obrigatorio.' });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse(400, { error: 'E-mail invalido.' });
  }
  if (password !== '123456') {
    return jsonResponse(400, { error: 'Senha temporaria invalida.' });
  }

  const { data: customer, error: customerError } = await adminClient
    .from('clientes')
    .select('id, nome')
    .eq('id', clienteId)
    .maybeSingle();
  if (customerError || !customer) {
    return jsonResponse(404, { error: 'Cliente nao encontrado.' });
  }

  const { data: existingIdentity, error: identityLookupError } = await adminClient
    .from('portal_client_identities')
    .select('auth_user_id, cliente_id')
    .eq('cliente_id', clienteId)
    .maybeSingle();
  if (identityLookupError) {
    return jsonResponse(500, { error: 'Nao foi possivel verificar o vinculo do portal.' });
  }
  if (existingIdentity?.auth_user_id) {
    const { error: updateExistingError } = await adminClient.auth.admin.updateUserById(
      existingIdentity.auth_user_id,
      {
        password,
        email_confirm: true,
        app_metadata: {
          [FORCE_PASSWORD_CHANGE_FLAG]: true,
          portal_customer_id: clienteId,
          portal_user_source: 'admin_customer_registration',
        },
      },
    );
    if (updateExistingError) {
      return jsonResponse(400, { error: 'Nao foi possivel atualizar o acesso existente.' });
    }
    return jsonResponse(200, { user: { auth_user_id: existingIdentity.auth_user_id } });
  }

  const { data: authResult, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: {
      [FORCE_PASSWORD_CHANGE_FLAG]: true,
      portal_customer_id: clienteId,
      portal_user_source: 'admin_customer_registration',
    },
  });

  if (createError || !authResult.user) {
    const createMessage = createError?.message || '';
    if (/already|registered|exists|duplicate/i.test(createMessage)) {
      return jsonResponse(409, {
        error: 'Ja existe um acesso ao Portal do Cliente cadastrado para este e-mail.',
      });
    }
    return jsonResponse(createError?.status || 400, {
      error: 'Nao foi possivel criar o usuario no Supabase Auth.',
    });
  }

  const authUserId = authResult.user.id;
  const { error: linkError } = await adminClient
    .from('portal_client_identities')
    .insert({
      auth_user_id: authUserId,
      cliente_id: clienteId,
      identity_provider: 'email',
      identity_value: email,
    });

  if (linkError) {
    await adminClient.auth.admin.deleteUser(authUserId);
    return jsonResponse(500, { error: 'Nao foi possivel vincular o usuario ao cliente.' });
  }

  return jsonResponse(201, { user: { auth_user_id: authUserId } });
});
