import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve('.');
const packageJson = JSON.parse(
  readFileSync(path.join(projectRoot, 'package.json'), 'utf8')
) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
const packages = [
  ...Object.keys(packageJson.dependencies || {}),
  ...Object.keys(packageJson.devDependencies || {})
];
const forbidden = /\b(?:AGPL|SSPL|BUSL|GPL-3\.0|Elastic-License)\b/i;
const incompatible: string[] = [];
const missing: string[] = [];

const resolveInstalledManifest = (name: string): string | undefined => {
  let directory = projectRoot;
  while (true) {
    const candidate = path.join(directory, 'node_modules', name, 'package.json');
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
};

for (const name of packages) {
  const manifestPath = resolveInstalledManifest(name);
  if (!manifestPath) {
    missing.push(name);
    continue;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    license?: string | { type?: string };
  };
  const license =
    typeof manifest.license === 'string'
      ? manifest.license
      : manifest.license?.type || '';
  if (!license) missing.push(name);
  if (forbidden.test(license)) incompatible.push(`${name} (${license})`);
}

if (missing.length > 0) {
  throw new Error(`Licença ou pacote não localizado: ${missing.join(', ')}`);
}
if (incompatible.length > 0) {
  throw new Error(`Licenças incompatíveis: ${incompatible.join(', ')}`);
}
console.log(`SEC005 licenses: ${packages.length} dependências diretas verificadas.`);
