import { loadGoLiveConfiguration } from '../../src/server/goLiveConfiguration';

try {
  const configuration = loadGoLiveConfiguration();
  console.log(
    `GO-LIVE environment: válido para ${configuration.supabaseProjectRef}; ` +
    `mensagens via ${configuration.messageProvider}.`
  );
} catch (error) {
  const code =
    error instanceof Error && 'code' in error
      ? String((error as Error & { code: unknown }).code)
      : 'GO_LIVE_CONFIGURATION_UNKNOWN';
  console.error(code);
  process.exitCode = 1;
}
