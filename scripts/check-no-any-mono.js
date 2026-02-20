#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

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

function fallbackScan() {
  const roots = ['apps', 'packages'];
  const ignoreDirs = new Set(['node_modules', 'dist', '.turbo', '.git']);
  const includeExt = new Set(['.ts', '.tsx']);
  const explicitAnyRegex = new RegExp(explicitAnyPattern);
  const violations = [];

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (ignoreDirs.has(entry.name)) {
        continue;
      }

      const absPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(absPath);
        continue;
      }

      if (!entry.isFile() || !includeExt.has(path.extname(entry.name).toLowerCase())) {
        continue;
      }

      const source = fs.readFileSync(absPath, 'utf8');
      const lines = source.split(/\r?\n/);
      for (let index = 0; index < lines.length; index += 1) {
        if (explicitAnyRegex.test(lines[index])) {
          const rel = path.relative(process.cwd(), absPath).split(path.sep).join('/');
          violations.push(`${rel}:${index + 1}:${lines[index]}`);
        }
      }
    }
  }

  for (const root of roots) {
    const absRoot = path.join(process.cwd(), root);
    if (fs.existsSync(absRoot)) {
      walk(absRoot);
    }
  }

  if (violations.length > 0) {
    process.stderr.write('Explicit TypeScript "any" usage found in repo scopes:\n');
    process.stderr.write(`${violations.join('\n')}\n`);
    process.exit(1);
  }

  process.stdout.write('No explicit TypeScript "any" usage found in repo scopes.\n');
  process.exit(0);
}

if (result.status === 0) {
  process.stderr.write('Explicit TypeScript "any" usage found in repo scopes:\n');
  process.stderr.write(result.stdout);
  process.exit(1);
}

if (result.status === 1) {
  process.stdout.write('No explicit TypeScript "any" usage found in repo scopes.\n');
  process.exit(0);
}

if (result.error && result.error.code === 'ENOENT') {
  fallbackScan();
}

process.stderr.write('Failed to execute ripgrep for no-any check.\n');
if (result.stderr) {
  process.stderr.write(result.stderr);
}
process.exit(result.status || 1);
