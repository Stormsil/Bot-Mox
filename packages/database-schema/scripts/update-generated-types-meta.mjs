import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const migrationsDir = path.join(repoRoot, 'supabase', 'migrations');
const metaFile = path.join(packageRoot, 'src', 'generated', 'supabase.types.meta.json');
const schemaList = process.env.SUPABASE_SCHEMAS?.trim() || 'public,storage,graphql_public';

function collectMigrationFiles() {
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }

  return fs
    .readdirSync(migrationsDir)
    .filter((name) => name.toLowerCase().endsWith('.sql'))
    .sort()
    .map((name) => path.join(migrationsDir, name));
}

function computeMigrationsHash() {
  const hash = createHash('sha256');
  const files = collectMigrationFiles();

  files.forEach((absolutePath) => {
    const relativePath = path.relative(repoRoot, absolutePath).replace(/\\/g, '/');
    const content = fs.readFileSync(absolutePath, 'utf8').replace(/\r\n/g, '\n');
    hash.update(relativePath);
    hash.update('\n');
    hash.update(content);
    hash.update('\n');
  });

  return {
    hash: hash.digest('hex'),
    files: files.map((absolutePath) => path.relative(repoRoot, absolutePath).replace(/\\/g, '/')),
  };
}

const migrationsState = computeMigrationsHash();
const nextMeta = {
  generatedAt: new Date().toISOString(),
  schemaList,
  migrationsHash: migrationsState.hash,
  migrationFiles: migrationsState.files,
};

fs.mkdirSync(path.dirname(metaFile), { recursive: true });
fs.writeFileSync(metaFile, `${JSON.stringify(nextMeta, null, 2)}\n`, 'utf8');
process.stdout.write(`Updated ${path.relative(repoRoot, metaFile)}\n`);
