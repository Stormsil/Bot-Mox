const path = require('node:path');
const { spawnSync } = require('node:child_process');

const backendRoot = path.resolve(__dirname, '..');
const testArgs = process.argv.slice(2);

const runTests = spawnSync(
  process.execPath,
  [path.resolve(__dirname, 'run-tests.cjs'), ...testArgs],
  {
    stdio: 'inherit',
    cwd: backendRoot,
    env: process.env,
  },
);

if ((runTests.status ?? 1) !== 0) {
  process.exit(runTests.status ?? 1);
}

const tscEntrypoint = require.resolve('typescript/bin/tsc');
const runTypecheck = spawnSync(
  process.execPath,
  [tscEntrypoint, '-p', 'tsconfig.json', '--noEmit'],
  {
    stdio: 'inherit',
    cwd: backendRoot,
    env: process.env,
  },
);

process.exit(runTypecheck.status ?? 1);
