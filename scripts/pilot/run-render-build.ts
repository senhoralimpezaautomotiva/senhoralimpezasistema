import { spawnSync } from 'node:child_process';
import { loadGoLiveConfiguration } from '../../src/server/goLiveConfiguration';

const configuration = loadGoLiveConfiguration();
console.log(
  `GO-LIVE environment: válido para ${configuration.supabaseProjectRef}; ` +
  `mensagens via ${configuration.messageProvider}.`
);

// The VITE_* public values remain available to the production bundle. Runtime
// credentials and integration endpoints are deliberately removed while tests
// execute so a Render build can never read or mutate the live project.
const isolatedBuildEnvironment = { ...process.env };
for (const name of [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'MAKE_WEBHOOK_URL',
  'ZAPI_INSTANCE_ID',
  'ZAPI_TOKEN',
  'ZAPI_CLIENT_TOKEN'
]) {
  delete isolatedBuildEnvironment[name];
}
isolatedBuildEnvironment.GO_LIVE_BUILD_ISOLATED = 'true';

const npmExecutable = process.env.npm_execpath;
if (!npmExecutable) {
  console.error('GO_LIVE_NPM_EXECUTABLE_NOT_FOUND');
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [npmExecutable, 'run', 'security:ci'],
  {
    env: isolatedBuildEnvironment,
    stdio: 'inherit'
  }
);

if (result.error) {
  console.error('GO_LIVE_BUILD_PROCESS_FAILED');
  process.exit(1);
}
process.exit(result.status ?? 1);
