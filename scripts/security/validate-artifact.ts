import path from 'node:path';
import { validateProductionArtifact } from '../../src/security/artifactPolicy';

const findings = validateProductionArtifact(path.resolve('.'));
if (findings.length > 0) {
  for (const finding of findings) {
    console.error(`${finding.rule} | ${finding.file}`);
  }
  process.exitCode = 1;
} else {
  console.log('SEC005 artifact policy: dist contém somente artefatos permitidos.');
}
