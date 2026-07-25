import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface BackupFileResult {
  file: string;
  bytes: number;
  sha256: string;
}

export interface BackupVerification {
  valid: boolean;
  directory: string;
  files: BackupFileResult[];
  errors: string[];
}

const REQUIRED_FILES = ['roles.sql', 'schema.sql', 'data.sql'] as const;

const digest = (contents: Buffer): string =>
  createHash('sha256').update(contents).digest('hex');

export const verifyBackupDirectory = (directory: string): BackupVerification => {
  const absoluteDirectory = path.resolve(directory);
  const files: BackupFileResult[] = [];
  const errors: string[] = [];
  const contentsByName = new Map<string, string>();

  for (const file of REQUIRED_FILES) {
    const absoluteFile = path.join(absoluteDirectory, file);
    if (!existsSync(absoluteFile) || !statSync(absoluteFile).isFile()) {
      errors.push(`${file}: ausente`);
      continue;
    }

    const contents = readFileSync(absoluteFile);
    files.push({
      file,
      bytes: contents.byteLength,
      sha256: digest(contents)
    });
    contentsByName.set(file, contents.toString('utf8'));

    if (contents.byteLength === 0 || contents.toString('utf8').trim().length === 0) {
      errors.push(`${file}: vazio`);
    }
  }

  const schema = contentsByName.get('schema.sql') || '';
  if (schema && !/(?:CREATE|ALTER)\s+(?:TABLE|VIEW|FUNCTION|POLICY|TRIGGER)/i.test(schema)) {
    errors.push('schema.sql: não contém DDL reconhecível');
  }

  const data = contentsByName.get('data.sql') || '';
  if (data && !/(?:COPY\s+|INSERT\s+INTO\s+)/i.test(data)) {
    errors.push('data.sql: não contém COPY ou INSERT; confirme se o banco de origem realmente não possui dados');
  }

  for (const [file, contents] of contentsByName) {
    if (/postgres(?:ql)?:\/\/[^\s:]+:[^@\s]+@/i.test(contents)) {
      errors.push(`${file}: possível connection string com senha embutida`);
    }
  }

  return {
    valid: errors.length === 0,
    directory: absoluteDirectory,
    files,
    errors
  };
};

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : '';

if (invokedFile === currentFile) {
  const directory = process.argv[2];
  if (!directory) {
    console.error('Uso: npm run db:backup:verify -- <diretorio-do-backup>');
    process.exitCode = 2;
  } else {
    const result = verifyBackupDirectory(directory);
    for (const file of result.files) {
      console.log(`${file.file}: ${file.bytes} bytes; sha256=${file.sha256}`);
    }
    if (!result.valid) {
      for (const error of result.errors) {
        console.error(`ERRO: ${error}`);
      }
      process.exitCode = 1;
    } else {
      console.log('Backup lógico íntegro nos controles locais da DB-001.');
    }
  }
}
