#!/usr/bin/env node
const { spawnSync } = require('node:child_process');

const scripts = [
  'scripts/check-ui-boundaries.js',
  'scripts/check-entities-service-boundary.js',
  'scripts/check-vm-provider-boundary.js',
];

for (const script of scripts) {
  const result = spawnSync(process.execPath, [script], { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

process.stdout.write('Architecture import checks passed.\n');
