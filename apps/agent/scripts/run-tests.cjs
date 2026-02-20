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
  console.error('No agent test files found under src/**/*.test.ts');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', '--import', 'tsx', ...testFiles], {
  stdio: 'inherit',
  cwd: path.resolve(__dirname, '..'),
  env: process.env,
});

process.exit(result.status ?? 1);
