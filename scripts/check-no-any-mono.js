#!/usr/bin/env node
const { spawnSync } = require('node:child_process');

const explicitAnyPattern = [
  ':\\s*any\\b',
  '<\\s*any\\s*>',
  '\\bas\\s+any\\b',
  '\\bany\\[\\]',
  'Array<\\s*any\\s*>',
  'Promise<\\s*any\\s*>',
  'Record<[^>]*\\bany\\b[^>]*>',
].join('|');

const args = [
  '-n',
  '-P',
  explicitAnyPattern,
  'apps',
  'packages',
  'apps/frontend/src',
  'apps/agent/src',
  '--glob',
  '*.ts',
  '--glob',
  '*.tsx',
];

const result = spawnSync('rg', args, {
  cwd: process.cwd(),
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

if (result.status === 0) {
  process.stderr.write('Explicit TypeScript "any" usage found in repo scopes:\n');
  process.stderr.write(result.stdout);
  process.exit(1);
}

if (result.status === 1) {
  process.stdout.write('No explicit TypeScript "any" usage found in repo scopes.\n');
  process.exit(0);
}

process.stderr.write('Failed to execute ripgrep for no-any check.\n');
if (result.stderr) {
  process.stderr.write(result.stderr);
}
process.exit(result.status || 1);
