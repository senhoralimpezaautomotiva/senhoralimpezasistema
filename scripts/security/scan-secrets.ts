import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { scanTextForSecrets, type SecretFinding } from '../../src/security/secretScanner';

const projectRoot = path.resolve('.');
const ignoredDirectories = new Set([
  'node_modules',
  '.git',
  '.security-reports'
]);
const archiveExtensions = new Set(['.zip', '.tar', '.gz', '.tgz']);

const walk = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) return [];
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });

const findings: SecretFinding[] = [];
for (const absolute of walk(projectRoot)) {
  const relative = path.relative(projectRoot, absolute).replace(/\\/g, '/');
  const extension = path.extname(absolute).toLowerCase();
  if (archiveExtensions.has(extension)) {
    findings.push({ rule: 'archive-requires-manual-inspection', file: relative, line: 1 });
    continue;
  }

  const contents = readFileSync(absolute);
  if (contents.includes(0)) continue;
  findings.push(...scanTextForSecrets(contents.toString('utf8'), relative));
}

if (!existsSync(path.join(projectRoot, 'dist'))) {
  findings.push({ rule: 'build-artifact-not-found', file: 'dist', line: 1 });
}

if (findings.length > 0) {
  for (const finding of findings) {
    console.error(`${finding.rule} | ${finding.file}:${finding.line}`);
  }
  process.exitCode = 1;
} else {
  console.log('SEC005 secret scan: nenhum segredo ou arquivo compactado encontrado.');
}
