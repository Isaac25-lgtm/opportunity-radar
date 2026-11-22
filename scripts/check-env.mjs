import { runnerImport } from 'vite';
import { unstable_getVarsForDev, unstable_readConfig } from 'wrangler';

const config = unstable_readConfig({ config: 'wrangler.jsonc' });
const vars = unstable_getVarsForDev(config.configPath, undefined, config.vars, undefined, true);
const env = Object.fromEntries(Object.entries(vars).map(([key, binding]) => [key, binding.value]));
env.DB = config.d1_databases.some(({ binding }) => binding === 'DB');
env.DOCS = config.kv_namespaces.some(({ binding }) => binding === 'DOCS');

const { module: providers } = await runnerImport('./worker/lib/providers.ts', { configFile: false });
const checks = providers.checkEnv(env);
console.log('Local Wrangler configuration');
for (const check of checks) {
  const status = check.present ? 'configured' : check.required ? 'missing (required)' : 'unset (optional)';
  console.log(`${check.name}: ${status}`);
}
if (checks.some((check) => check.required && !check.present)) process.exitCode = 1;
