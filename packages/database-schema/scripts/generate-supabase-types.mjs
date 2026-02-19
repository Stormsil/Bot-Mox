import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const targetFile = path.join(packageRoot, 'src', 'generated', 'supabase.types.ts');
const metaFile = path.join(packageRoot, 'src', 'generated', 'supabase.types.meta.json');

const schemaList = process.env.SUPABASE_SCHEMAS?.trim() || 'public,storage,graphql_public';
const projectRef = process.env.SUPABASE_PROJECT_REF?.trim();
const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const migrationsDir = path.join(repoRoot, 'supabase', 'migrations');
function runSupabaseGen() {
  const baseArgs = ['supabase', 'gen', 'types', 'typescript', '--schema', schemaList];
  const args =
    projectRef && accessToken
      ? [...baseArgs, '--project-id', projectRef]
      : [...baseArgs, '--local'];

  return execSync(`corepack pnpm exec ${args.join(' ')}`, {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });
}

function withHeader(source) {
  const normalized = source.replace(/\r\n/g, '\n').trim();
  return [
    '/**',
    ' * THIS FILE IS AUTO-GENERATED.',
    ' * Run: pnpm db:types',
    ' */',
    '',
    normalized,
    '',
  ].join('\n');
}

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

try {
  const generated = runSupabaseGen();
  const migrationsState = computeMigrationsHash();
  const nextMeta = {
    generatedAt: new Date().toISOString(),
    schemaList,
    migrationsHash: migrationsState.hash,
    migrationFiles: migrationsState.files,
  };

  fs.mkdirSync(path.dirname(targetFile), { recursive: true });
  fs.writeFileSync(targetFile, withHeader(generated), 'utf8');
  fs.writeFileSync(metaFile, `${JSON.stringify(nextMeta, null, 2)}\n`, 'utf8');
  process.stdout.write(`Generated ${path.relative(repoRoot, targetFile)}\n`);
  process.stdout.write(`Updated ${path.relative(repoRoot, metaFile)}\n`);
} catch (error) {
  process.stderr.write('Failed to generate Supabase types.\n');
  process.stderr.write(
    'Tip: start local stack (`corepack pnpm exec supabase start`) or provide SUPABASE_PROJECT_REF + SUPABASE_ACCESS_TOKEN.\n',
  );
  if (error && typeof error === 'object' && 'stderr' in error && error.stderr) {
    process.stderr.write(String(error.stderr));
    process.stderr.write('\n');
  } else if (error instanceof Error) {
    process.stderr.write(`${error.message}\n`);
  }
  process.exit(1);
}
