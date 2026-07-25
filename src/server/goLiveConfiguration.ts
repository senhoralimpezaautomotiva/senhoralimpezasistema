import { loadServerEnvironment } from './environment';

export interface GoLiveConfiguration {
  publicAppUrl: string;
  supabaseProjectRef: string;
  messageProvider: 'make' | 'zapi';
}

export class GoLiveConfigurationError extends Error {
  constructor(public readonly code: string) {
    super(`Configuração de go-live inválida (${code}).`);
    this.name = 'GoLiveConfigurationError';
  }
}

type EnvironmentSource = Record<string, string | undefined>;

const read = (source: EnvironmentSource, name: string): string =>
  source[name]?.trim() || '';

const rejectPlaceholder = (value: string, code: string): void => {
  if (
    !value ||
    /<[^>]+>|placeholder|set-in|change-me|example-project|production-project/i.test(value)
  ) {
    throw new GoLiveConfigurationError(code);
  }
};

const normalizeHttpsOrigin = (value: string, code: string): string => {
  rejectPlaceholder(value, code);
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname !== '/' && url.pathname !== '')
    ) {
      throw new GoLiveConfigurationError(code);
    }
    return url.origin;
  } catch (error) {
    if (error instanceof GoLiveConfigurationError) throw error;
    throw new GoLiveConfigurationError(code);
  }
};

const readJwtRole = (value: string): string => {
  const parts = value.split('.');
  if (parts.length !== 3) return '';
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8')
    ) as { role?: unknown };
    return typeof payload.role === 'string' ? payload.role : '';
  } catch {
    return '';
  }
};

const assertPublicSupabaseKey = (value: string, code: string): void => {
  rejectPlaceholder(value, code);
  const isPublishable = /^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(value);
  const isLegacyAnon = readJwtRole(value) === 'anon';
  if (!isPublishable && !isLegacyAnon) {
    throw new GoLiveConfigurationError(code);
  }
};

export const loadGoLiveConfiguration = (
  source: EnvironmentSource = process.env
): GoLiveConfiguration => {
  const serverEnvironment = loadServerEnvironment(source);
  if (
    serverEnvironment.appEnvironment !== 'production' ||
    serverEnvironment.nodeEnvironment !== 'production'
  ) {
    throw new GoLiveConfigurationError('GO_LIVE_PRODUCTION_REQUIRED');
  }
  if (!serverEnvironment.clientPortalEnabled) {
    throw new GoLiveConfigurationError('GO_LIVE_PORTAL_DISABLED');
  }

  const publicAppUrl = normalizeHttpsOrigin(
    read(source, 'PUBLIC_APP_URL') || read(source, 'RENDER_EXTERNAL_URL'),
    'GO_LIVE_PUBLIC_APP_URL_INVALID'
  );
  const supabaseUrl = normalizeHttpsOrigin(
    serverEnvironment.supabaseUrl,
    'GO_LIVE_SUPABASE_URL_INVALID'
  );
  const supabaseHost = new URL(supabaseUrl).hostname;
  const hostMatch = /^([a-z0-9]{20})\.supabase\.co$/.exec(supabaseHost);
  if (!hostMatch) {
    throw new GoLiveConfigurationError('GO_LIVE_SUPABASE_HOST_INVALID');
  }

  const browserSupabaseUrl = normalizeHttpsOrigin(
    read(source, 'VITE_SUPABASE_URL'),
    'GO_LIVE_BROWSER_SUPABASE_URL_REQUIRED'
  );
  if (browserSupabaseUrl !== supabaseUrl) {
    throw new GoLiveConfigurationError('GO_LIVE_SUPABASE_URL_MISMATCH');
  }

  const serverPublicKey = serverEnvironment.supabaseAnonKey;
  const browserPublicKey = read(source, 'VITE_SUPABASE_ANON_KEY');
  assertPublicSupabaseKey(serverPublicKey, 'GO_LIVE_SUPABASE_PUBLIC_KEY_INVALID');
  assertPublicSupabaseKey(
    browserPublicKey,
    'GO_LIVE_BROWSER_SUPABASE_PUBLIC_KEY_INVALID'
  );
  if (browserPublicKey !== serverPublicKey) {
    throw new GoLiveConfigurationError('GO_LIVE_SUPABASE_KEY_MISMATCH');
  }

  if (!serverEnvironment.makeWebhookConfigured && !serverEnvironment.zapiConfigured) {
    throw new GoLiveConfigurationError('GO_LIVE_MESSAGE_PROVIDER_REQUIRED');
  }

  return {
    publicAppUrl,
    supabaseProjectRef: hostMatch[1],
    messageProvider: serverEnvironment.makeWebhookConfigured ? 'make' : 'zapi'
  };
};
