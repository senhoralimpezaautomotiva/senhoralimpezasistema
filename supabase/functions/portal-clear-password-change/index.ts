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
    return jsonResponse(401, { error: 'Sessao autenticada obrigatoria.' });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: requesterResult, error: requesterError } =
    await adminClient.auth.getUser(accessToken);
  const requester = requesterResult?.user;
  if (requesterError || !requester || requester.aud !== 'authenticated') {
    return jsonResponse(401, { error: 'Sessao invalida.' });
  }
  if (requester.app_metadata?.[FORCE_PASSWORD_CHANGE_FLAG] !== true) {
    return jsonResponse(403, { error: 'Troca obrigatoria de senha nao esta pendente.' });
  }

  const nextAppMetadata = {
    ...(requester.app_metadata || {}),
    [FORCE_PASSWORD_CHANGE_FLAG]: false,
  };

  const { error: updateError } = await adminClient.auth.admin.updateUserById(
    requester.id,
    { app_metadata: nextAppMetadata },
  );
  if (updateError) {
    return jsonResponse(500, { error: 'Nao foi possivel liberar o acesso ao portal.' });
  }

  return jsonResponse(200, { ok: true });
});
