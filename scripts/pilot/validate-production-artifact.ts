import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const distDirectory = path.resolve('dist');
const portalMarker = Buffer.from('client-portal-card');

const files = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? files(absolute) : [absolute];
  });

if (!existsSync(distDirectory)) {
  console.error('Pilot artifact: diretório dist ausente.');
  process.exitCode = 1;
} else {
  const bundledPortalFiles = files(distDirectory).filter(file =>
    readFileSync(file).includes(portalMarker)
  );

  if (bundledPortalFiles.length === 0) {
    console.error('production-client-portal-missing | dist');
    process.exitCode = 1;
  } else {
    console.log(
      `Pilot artifact: Portal do Cliente seguro presente em ${bundledPortalFiles.length} chunk(s).`
    );
  }
}
