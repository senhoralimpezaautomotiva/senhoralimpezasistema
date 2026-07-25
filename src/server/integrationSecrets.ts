export interface PrivateIntegrationConfig {
  makeWebhookUrl: string;
  zapiInstanceId: string;
  zapiToken: string;
  zapiClientToken: string;
}

const readSecret = (name: string): string => {
  if (typeof process === 'undefined') return '';
  return process.env[name]?.trim() || '';
};

export const getIntegrationSecrets = (): PrivateIntegrationConfig => ({
  makeWebhookUrl: readSecret('MAKE_WEBHOOK_URL'),
  zapiInstanceId: readSecret('ZAPI_INSTANCE_ID'),
  zapiToken: readSecret('ZAPI_TOKEN'),
  zapiClientToken: readSecret('ZAPI_CLIENT_TOKEN')
});

export const hasZapiCredentials = (secrets: PrivateIntegrationConfig): boolean =>
  Boolean(secrets.zapiInstanceId && secrets.zapiToken);
