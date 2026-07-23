import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let sharedClient: SupabaseClient | null = null;
let sharedUrl = '';
let sharedAnonKey = '';

/**
 * Returns the single Supabase client used by the active application runtime.
 * The browser client owns the persisted Auth session; the server runtime keeps
 * using an in-memory, non-persisted session.
 */
export function getSharedSupabaseClient(url: string, anonKey: string): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error('Supabase URL e chave pública são obrigatórias.');
  }

  if (!sharedClient || sharedUrl !== url || sharedAnonKey !== anonKey) {
    const isBrowser = typeof window !== 'undefined';

    sharedClient = createClient(url, anonKey, {
      auth: {
        persistSession: isBrowser,
        autoRefreshToken: isBrowser,
        detectSessionInUrl: isBrowser,
      },
    });
    sharedUrl = url;
    sharedAnonKey = anonKey;
  }

  return sharedClient;
}
