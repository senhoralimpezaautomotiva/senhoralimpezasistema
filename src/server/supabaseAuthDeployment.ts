export interface SupabaseAuthDeploymentConfiguration {
  accessToken: string;
  projectRef: string;
  publicAppUrl: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  smtpAdminEmail: string;
  smtpSenderName: string;
}

export class SupabaseAuthDeploymentError extends Error {
  constructor(public readonly code: string) {
    super(`Configuração do Supabase Auth inválida (${code}).`);
    this.name = 'SupabaseAuthDeploymentError';
  }
}

type EnvironmentSource = Record<string, string | undefined>;

const required = (source: EnvironmentSource, name: string): string => {
  const value = source[name]?.trim() || '';
  if (
    !value ||
    /<[^>]+>|placeholder|change-me|set-in|example\.(com|org)/i.test(value)
  ) {
    throw new SupabaseAuthDeploymentError(`SMTP_REQUIRED_${name}`);
  }
  return value;
};

const parsePublicAppUrl = (value: string): string => {
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
      throw new SupabaseAuthDeploymentError('SMTP_INVALID_PUBLIC_APP_URL');
    }
    return url.origin;
  } catch (error) {
    if (error instanceof SupabaseAuthDeploymentError) throw error;
    throw new SupabaseAuthDeploymentError('SMTP_INVALID_PUBLIC_APP_URL');
  }
};

export const loadSupabaseAuthDeploymentConfiguration = (
  source: EnvironmentSource = process.env
): SupabaseAuthDeploymentConfiguration => {
  const projectRef = required(source, 'SUPABASE_PROJECT_REF');
  if (!/^[a-z0-9]{20}$/.test(projectRef)) {
    throw new SupabaseAuthDeploymentError('SMTP_INVALID_PROJECT_REF');
  }

  const smtpHost = required(source, 'SUPABASE_SMTP_HOST');
  if (
    smtpHost.includes('://') ||
    smtpHost.includes('/') ||
    /\s/.test(smtpHost)
  ) {
    throw new SupabaseAuthDeploymentError('SMTP_INVALID_HOST');
  }

  const rawPort = required(source, 'SUPABASE_SMTP_PORT');
  const smtpPort = Number(rawPort);
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
    throw new SupabaseAuthDeploymentError('SMTP_INVALID_PORT');
  }

  const smtpAdminEmail = required(source, 'SUPABASE_SMTP_ADMIN_EMAIL').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(smtpAdminEmail)) {
    throw new SupabaseAuthDeploymentError('SMTP_INVALID_ADMIN_EMAIL');
  }

  return {
    accessToken: required(source, 'SUPABASE_ACCESS_TOKEN'),
    projectRef,
    publicAppUrl: parsePublicAppUrl(required(source, 'PUBLIC_APP_URL')),
    smtpHost,
    smtpPort,
    smtpUser: required(source, 'SUPABASE_SMTP_USER'),
    smtpPassword: required(source, 'SUPABASE_SMTP_PASSWORD'),
    smtpAdminEmail,
    smtpSenderName: required(source, 'SUPABASE_SMTP_SENDER_NAME')
  };
};

export const buildSupabaseAuthDeploymentPayload = (
  configuration: SupabaseAuthDeploymentConfiguration
): Record<string, string | number | boolean> => ({
  site_url: configuration.publicAppUrl,
  uri_allow_list: [
    `${configuration.publicAppUrl}/?portal=true`,
    `${configuration.publicAppUrl}/?portal=true&recovery=true`
  ].join(','),
  external_email_enabled: true,
  mailer_secure_email_change_enabled: true,
  mailer_autoconfirm: false,
  smtp_admin_email: configuration.smtpAdminEmail,
  smtp_host: configuration.smtpHost,
  smtp_port: configuration.smtpPort,
  smtp_user: configuration.smtpUser,
  smtp_pass: configuration.smtpPassword,
  smtp_sender_name: configuration.smtpSenderName
});

export const applySupabaseAuthDeployment = async (
  configuration: SupabaseAuthDeploymentConfiguration,
  request: typeof fetch = fetch
): Promise<void> => {
  const response = await request(
    `https://api.supabase.com/v1/projects/${configuration.projectRef}/config/auth`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${configuration.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(buildSupabaseAuthDeploymentPayload(configuration))
    }
  );

  if (!response.ok) {
    throw new SupabaseAuthDeploymentError(
      `SMTP_MANAGEMENT_API_${response.status}`
    );
  }
};
