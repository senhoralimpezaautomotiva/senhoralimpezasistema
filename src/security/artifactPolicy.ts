import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

export interface ArtifactFinding {
  rule: string;
  file: string;
}

const FORBIDDEN_EXTENSIONS = new Set([
  '.map',
  '.zip',
  '.tar',
  '.gz',
  '.tgz',
  '.ts',
  '.tsx',
  '.sql',
  '.md',
  '.env',
  '.tmp'
]);

const FORBIDDEN_NAME =
  /^(?:probe|inspect|test|debug|diagnostic)(?:[-_.]|[A-Z])|(?:backup|old)(?:[-_.]|$)|(?:[-_.]copy)(?:[-_.]|$)/i;

const walk = (directory: string): string[] => {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
};

export const validateProductionArtifact = (
  projectRoot: string
): ArtifactFinding[] => {
  const distDirectory = path.join(projectRoot, 'dist');
  const findings: ArtifactFinding[] = [];
  if (!existsSync(distDirectory) || !statSync(distDirectory).isDirectory()) {
    return [{ rule: 'dist-missing', file: 'dist' }];
  }

  for (const absolute of walk(distDirectory)) {
    const relative = path.relative(projectRoot, absolute).replace(/\\/g, '/');
    const extension = path.extname(absolute).toLowerCase();
    const basename = path.basename(absolute);
    if (FORBIDDEN_EXTENSIONS.has(extension)) {
      findings.push({ rule: 'forbidden-artifact-extension', file: relative });
    }
    if (FORBIDDEN_NAME.test(basename)) {
      findings.push({ rule: 'diagnostic-artifact', file: relative });
    }
    const contents = readFileSync(absolute);
    if (contents.includes(Buffer.from('sourceMappingURL='))) {
      findings.push({ rule: 'source-map-reference', file: relative });
    }
    if (contents.includes(Buffer.from('"sourcesContent"'))) {
      findings.push({ rule: 'embedded-source-map', file: relative });
    }
  }

  for (const obsolete of [
    'server.js',
    'server.cjs',
    'server.cjs.map',
    'dist.zip',
    'build.zip'
  ]) {
    if (existsSync(path.join(projectRoot, obsolete))) {
      findings.push({ rule: 'obsolete-root-build', file: obsolete });
    }
  }

  const required = ['dist/index.html', 'dist/server.cjs'];
  for (const relative of required) {
    if (!existsSync(path.join(projectRoot, relative))) {
      findings.push({ rule: 'required-artifact-missing', file: relative });
    }
  }
  return findings;
};
