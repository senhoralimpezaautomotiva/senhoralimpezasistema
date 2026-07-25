import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve('.');
const packageJson = JSON.parse(
  readFileSync(path.join(projectRoot, 'package.json'), 'utf8')
) as {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const ignoredDirectories = new Set(['node_modules', 'dist', '.git']);
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css']);
const walk = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) return [];
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    return sourceExtensions.has(path.extname(entry.name)) ? [absolute] : [];
  });

const normalizePackage = (specifier: string): string =>
  specifier.startsWith('@')
    ? specifier.split('/').slice(0, 2).join('/')
    : specifier.split('/')[0];

const used = new Set<string>();
const importPattern =
  /(?:from\s+|import\s*\(|require\s*\(|import\s+|@import\s+)['"]([^'"]+)['"]/g;
for (const file of walk(projectRoot)) {
  const contents = readFileSync(file, 'utf8');
  for (const match of contents.matchAll(importPattern)) {
    if (!match[1].startsWith('.') && !match[1].startsWith('/')) {
      used.add(normalizePackage(match[1]));
    }
  }
}

const scripts = Object.values(packageJson.scripts || {}).join('\n');
const commandPackages: Record<string, string> = {
  tsc: 'typescript',
  tsx: 'tsx',
  vite: 'vite',
  esbuild: 'esbuild',
  bun: 'bun'
};
for (const [command, packageName] of Object.entries(commandPackages)) {
  if (new RegExp(`\\b${command}\\b`).test(scripts)) used.add(packageName);
}
for (const name of Object.keys(packageJson.devDependencies || {})) {
  if (name.startsWith('@types/')) used.add(name);
}

const declared = [
  ...Object.keys(packageJson.dependencies || {}),
  ...Object.keys(packageJson.devDependencies || {})
];
const unused = declared.filter(name => !used.has(name));
if (unused.length > 0) {
  console.log(`SEC005 unused dependency candidates: ${unused.join(', ')}`);
  console.log('Relatório informativo; nenhuma dependência foi removida automaticamente.');
} else {
  console.log('SEC005 unused dependency scan: nenhum candidato encontrado.');
}
