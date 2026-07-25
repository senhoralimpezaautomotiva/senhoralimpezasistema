import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applySupabaseAuthDeployment,
  loadSupabaseAuthDeploymentConfiguration
} from '../../src/server/supabaseAuthDeployment';

export const runSupabaseAuthConfiguration = async (
  apply: boolean,
  source: Record<string, string | undefined> = process.env
): Promise<void> => {
  const configuration = loadSupabaseAuthDeploymentConfiguration(source);
  if (!apply) {
    console.log(
      'Supabase Auth: configuração SMTP e URLs validada; nenhuma alteração aplicada.'
    );
    return;
  }

  await applySupabaseAuthDeployment(configuration);
  console.log(
    'Supabase Auth: SMTP, confirmação de e-mail e Redirect URLs aplicados.'
  );
};

const isMain =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  void runSupabaseAuthConfiguration(process.argv.includes('--apply')).catch(error => {
    const code =
      error instanceof Error && 'code' in error
        ? String((error as Error & { code: unknown }).code)
        : 'SMTP_CONFIGURATION_UNKNOWN';
    console.error(code);
    process.exitCode = 1;
  });
}
