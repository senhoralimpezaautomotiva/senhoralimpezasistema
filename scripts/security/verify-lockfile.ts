import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve('.');
const packageJson = JSON.parse(
  readFileSync(path.join(projectRoot, 'package.json'), 'utf8')
) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
const lockPath = path.join(projectRoot, 'bun.lock');
if (!existsSync(lockPath)) {
  throw new Error('bun.lock ausente.');
}
if (existsSync(path.join(projectRoot, 'package-lock.json'))) {
  throw new Error('Lockfiles concorrentes detectados.');
}

const lockContents = readFileSync(lockPath, 'utf8');
const declared = [
  ...Object.keys(packageJson.dependencies || {}),
  ...Object.keys(packageJson.devDependencies || {})
];
const missing = declared.filter(name => !lockContents.includes(`"${name}"`));
if (missing.length > 0) {
  throw new Error(`Dependências ausentes do bun.lock: ${missing.join(', ')}`);
}

console.log(`SEC005 lockfile: ${declared.length} dependências declaradas verificadas.`);
