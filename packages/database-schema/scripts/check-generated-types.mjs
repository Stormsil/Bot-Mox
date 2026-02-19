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
const migrationsDir = path.join(repoRoot, 'supabase', 'migrations');

const schemaList = process.env.SUPABASE_SCHEMAS?.trim() || 'public,storage,graphql_public';
const projectRef = process.env.SUPABASE_PROJECT_REF?.trim();
const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const verifyWithCli = String(process.env.SUPABASE_TYPES_VERIFY_WITH_CLI || '').trim() === '1';
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

function validateMetaAgainstMigrations() {
  if (!fs.existsSync(metaFile)) {
    process.stderr.write(`Missing generated meta: ${path.relative(repoRoot, metaFile)}\n`);
    process.stderr.write('Run: pnpm db:types\n');
    process.exit(1);
  }

  const migrationsState = computeMigrationsHash();
  const metaRaw = fs.readFileSync(metaFile, 'utf8');
  const meta = JSON.parse(metaRaw);
  const storedHash = String(meta?.migrationsHash || '').trim();

  if (!storedHash) {
    process.stderr.write(`Generated meta is invalid: ${path.relative(repoRoot, metaFile)}\n`);
    process.stderr.write('Run: pnpm db:types\n');
    process.exit(1);
  }

  if (storedHash !== migrationsState.hash) {
    process.stderr.write('Supabase generated types metadata is stale for current migrations.\n');
    process.stderr.write(`Expected migrations hash: ${migrationsState.hash}\n`);
    process.stderr.write(`Stored migrations hash:   ${storedHash}\n`);
    process.stderr.write('Run: pnpm db:types\n');
    process.exit(1);
  }
}

if (!fs.existsSync(targetFile)) {
  process.stderr.write(`Missing generated file: ${path.relative(repoRoot, targetFile)}\n`);
  process.stderr.write('Run: pnpm db:types\n');
  process.exit(1);
}

try {
  validateMetaAgainstMigrations();

  if (verifyWithCli) {
    const generated = withHeader(runSupabaseGen());
    const existing = fs.readFileSync(targetFile, 'utf8').replace(/\r\n/g, '\n');
    if (existing !== generated) {
      process.stderr.write('Supabase generated types are stale.\n');
      process.stderr.write('Run: pnpm db:types\n');
      process.exit(1);
    }
  }

  process.stdout.write('Supabase generated types metadata is up to date.\n');
  if (verifyWithCli) {
    process.stdout.write('Supabase CLI snapshot matches generated types.\n');
  }
} catch (error) {
  process.stderr.write('Unable to validate generated types.\n');
  if (error && typeof error === 'object' && 'stderr' in error && error.stderr) {
    process.stderr.write(String(error.stderr));
    process.stderr.write('\n');
  } else if (error instanceof Error) {
    process.stderr.write(`${error.message}\n`);
  }
  process.exit(1);
}
