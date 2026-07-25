export interface PublicSupabaseEnvironment {
  supabaseUrl: string;
  supabaseAnonKey: string;
  isConfigured: boolean;
}

declare const __PUBLIC_SUPABASE_URL__: string | undefined;
declare const __PUBLIC_SUPABASE_ANON_KEY__: string | undefined;
declare const __CLIENT_PORTAL_ENABLED__: boolean | undefined;

const readNodeEnvironment = (name: string): string => {
  if (typeof process === 'undefined' || !process.env) return '';
  return process.env[name]?.trim() || '';
};

const readViteSupabaseUrl = (): string =>
  typeof __PUBLIC_SUPABASE_URL__ === 'string'
    ? __PUBLIC_SUPABASE_URL__.trim()
    : '';

const readViteSupabaseAnonKey = (): string =>
  typeof __PUBLIC_SUPABASE_ANON_KEY__ === 'string'
    ? __PUBLIC_SUPABASE_ANON_KEY__.trim()
    : '';

export const getPublicSupabaseEnvironment = (): PublicSupabaseEnvironment => {
  const supabaseUrl =
    readNodeEnvironment('SUPABASE_URL') ||
    readViteSupabaseUrl();
  const supabaseAnonKey =
    readNodeEnvironment('SUPABASE_ANON_KEY') ||
    readViteSupabaseAnonKey();

  return {
    supabaseUrl,
    supabaseAnonKey,
    isConfigured: Boolean(supabaseUrl && supabaseAnonKey)
  };
};

export const isClientPortalEnabled = (): boolean =>
  typeof __CLIENT_PORTAL_ENABLED__ === 'boolean' &&
  __CLIENT_PORTAL_ENABLED__ === true;
