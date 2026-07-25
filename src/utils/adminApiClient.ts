import { dbInstance } from '../db/localDb';

export const adminApiFetch = async (
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> => {
  const supabase = dbInstance.getSupabaseClient();
  const {
    data: { session },
    error
  } = await supabase.auth.getSession();

  if (error || !session?.access_token) {
    throw new Error('Sessão administrativa ausente ou expirada.');
  }

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${session.access_token}`);
  headers.set('Accept', 'application/json');

  return fetch(input, {
    ...init,
    headers,
    credentials: 'same-origin'
  });
};

