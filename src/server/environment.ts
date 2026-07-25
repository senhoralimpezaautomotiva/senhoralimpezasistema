export type AppEnvironment = 'development' | 'staging' | 'production';

export interface ServerEnvironment {
  appEnvironment: AppEnvironment;
  nodeEnvironment: 'development' | 'production' | 'test';
  port: number;
  supabaseUrl: string;
  supabaseAnonKey: string;
  clientPortalEnabled: boolean;
  makeWebhookConfigured: boolean;
  zapiConfigured: boolean;
}

export class EnvironmentConfigurationError extends Error {
  constructor(public readonly code: string) {
    super(`Configuração de ambiente inválida (${code}).`);
    this.name = 'EnvironmentConfigurationError';
  }
}

type EnvironmentSource = Record<string, string | undefined>;

const required = (source: EnvironmentSource, name: string): string => {
  const value = source[name]?.trim() || '';
  if (!value) throw new EnvironmentConfigurationError(`ENV_REQUIRED_${name}`);
  return value;
};

const optional = (source: EnvironmentSource, name: string): string =>
  source[name]?.trim() || '';

const assertHttpsUrl = (
  value: string,
  code: string,
  allowLocalHttp = false
): void => {
  if (!value) return;
  try {
    const parsed = new URL(value);
    const isLocalHttp =
      allowLocalHttp &&
      parsed.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
    if (parsed.protocol !== 'https:' && !isLocalHttp) {
      throw new EnvironmentConfigurationError(code);
    }
  } catch (error) {
    if (error instanceof EnvironmentConfigurationError) throw error;
    throw new EnvironmentConfigurationError(code);
  }
};

export const loadServerEnvironment = (
  source: EnvironmentSource = process.env
): ServerEnvironment => {
  const rawNodeEnvironment = optional(source, 'NODE_ENV') || 'development';
  if (!['development', 'production', 'test'].includes(rawNodeEnvironment)) {
    throw new EnvironmentConfigurationError('ENV_INVALID_NODE_ENV');
  }
  const nodeEnvironment = rawNodeEnvironment as ServerEnvironment['nodeEnvironment'];

  const rawAppEnvironment = optional(source, 'APP_ENV');
  if (!rawAppEnvironment && nodeEnvironment === 'production') {
    throw new EnvironmentConfigurationError('ENV_REQUIRED_APP_ENV');
  }
  const appEnvironment = (rawAppEnvironment || 'development') as AppEnvironment;
  if (!['development', 'staging', 'production'].includes(appEnvironment)) {
    throw new EnvironmentConfigurationError('ENV_INVALID_APP_ENV');
  }
  if (
    (appEnvironment === 'staging' || appEnvironment === 'production') &&
    nodeEnvironment !== 'production'
  ) {
    throw new EnvironmentConfigurationError('ENV_NODE_ENV_MISMATCH');
  }
  if (appEnvironment === 'development' && nodeEnvironment === 'production') {
    throw new EnvironmentConfigurationError('ENV_PRODUCTION_USING_DEVELOPMENT');
  }

  const rawPort = optional(source, 'PORT') || '3000';
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new EnvironmentConfigurationError('ENV_INVALID_PORT');
  }

  const requiresSupabase =
    appEnvironment === 'staging' || appEnvironment === 'production';
  const supabaseUrl = requiresSupabase
    ? required(source, 'SUPABASE_URL')
    : optional(source, 'SUPABASE_URL');
  const supabaseAnonKey = requiresSupabase
    ? required(source, 'SUPABASE_ANON_KEY')
    : optional(source, 'SUPABASE_ANON_KEY');

  if (Boolean(supabaseUrl) !== Boolean(supabaseAnonKey)) {
    throw new EnvironmentConfigurationError('ENV_INCOMPLETE_SUPABASE_CONFIG');
  }
  assertHttpsUrl(
    supabaseUrl,
    'ENV_INVALID_SUPABASE_URL',
    appEnvironment === 'development'
  );

  const browserSupabaseUrl = optional(source, 'VITE_SUPABASE_URL');
  const browserSupabaseAnonKey = optional(source, 'VITE_SUPABASE_ANON_KEY');
  if (Boolean(browserSupabaseUrl) !== Boolean(browserSupabaseAnonKey)) {
    throw new EnvironmentConfigurationError('ENV_INCOMPLETE_BROWSER_SUPABASE_CONFIG');
  }
  if (
    browserSupabaseUrl &&
    supabaseUrl &&
    browserSupabaseUrl !== supabaseUrl
  ) {
    throw new EnvironmentConfigurationError('ENV_SUPABASE_URL_MISMATCH');
  }
  if (
    browserSupabaseAnonKey &&
    supabaseAnonKey &&
    browserSupabaseAnonKey !== supabaseAnonKey
  ) {
    throw new EnvironmentConfigurationError('ENV_SUPABASE_KEY_MISMATCH');
  }

  const rawClientPortalEnabled =
    optional(source, 'VITE_ENABLE_CLIENT_PORTAL') || 'true';
  if (!['true', 'false'].includes(rawClientPortalEnabled)) {
    throw new EnvironmentConfigurationError('ENV_INVALID_CLIENT_PORTAL_FLAG');
  }
  const clientPortalEnabled = rawClientPortalEnabled === 'true';

  const makeWebhookUrl = optional(source, 'MAKE_WEBHOOK_URL');
  assertHttpsUrl(makeWebhookUrl, 'ENV_INVALID_MAKE_WEBHOOK_URL');

  const zapiInstanceId = optional(source, 'ZAPI_INSTANCE_ID');
  const zapiToken = optional(source, 'ZAPI_TOKEN');
  const zapiClientToken = optional(source, 'ZAPI_CLIENT_TOKEN');
  if (Boolean(zapiInstanceId) !== Boolean(zapiToken)) {
    throw new EnvironmentConfigurationError('ENV_INCOMPLETE_ZAPI_CONFIG');
  }
  if (zapiClientToken && !zapiToken) {
    throw new EnvironmentConfigurationError('ENV_ORPHAN_ZAPI_CLIENT_TOKEN');
  }

  return {
    appEnvironment,
    nodeEnvironment,
    port,
    supabaseUrl,
    supabaseAnonKey,
    clientPortalEnabled,
    makeWebhookConfigured: Boolean(makeWebhookUrl),
    zapiConfigured: Boolean(zapiInstanceId && zapiToken)
  };
};
