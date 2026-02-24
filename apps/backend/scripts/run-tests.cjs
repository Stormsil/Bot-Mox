const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const srcRoot = path.resolve(__dirname, '..', 'src');

function collectTestFiles(dir, acc) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectTestFiles(fullPath, acc);
      continue;
    }
    if (entry.isFile() && fullPath.endsWith('.test.ts')) {
      acc.push(fullPath);
    }
  }
}

const testFiles = [];
collectTestFiles(srcRoot, testFiles);

if (testFiles.length === 0) {
  console.error('No backend test files found under src/**/*.test.ts');
  process.exit(1);
}

const extraArgs = process.argv.slice(2);
const testArgs = extraArgs.length > 0 ? extraArgs : testFiles;

function resolveTestConcurrency() {
  const raw = String(process.env.BOTMOX_BACKEND_TEST_CONCURRENCY || '').trim();
  if (raw) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  // Windows Node test workers are more prone to OOM in this repo when run in parallel.
  if (process.platform === 'win32') {
    return 1;
  }

  return null;
}

const concurrency = resolveTestConcurrency();
const nodeArgs = ['--test', '--import', 'tsx'];
if (concurrency !== null) {
  nodeArgs.push(`--test-concurrency=${concurrency}`);
}
nodeArgs.push(...testArgs);

const result = spawnSync(process.execPath, nodeArgs, {
  stdio: 'inherit',
  cwd: path.resolve(__dirname, '..'),
  env: process.env,
});

process.exit(result.status ?? 1);
