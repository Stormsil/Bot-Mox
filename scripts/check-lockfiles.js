#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = process.cwd();
const forbidden = ['package-lock.json'];
const skipDirs = new Set([
  '.git',
  'node_modules',
  '.turbo',
  'dist',
  'build',
  'coverage',
  'playwright-report',
  'test-results',
]);
const allowPathPrefixes = ['docs/history/'];

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function isAllowed(relativePath) {
  const normalized = toPosix(relativePath);
  return allowPathPrefixes.some((prefix) => normalized.startsWith(prefix));
}

function walk(dir, found = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    const relativePath = path.relative(repoRoot, absolutePath);

    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) {
        continue;
      }
      walk(absolutePath, found);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (forbidden.includes(entry.name)) {
      found.push(toPosix(relativePath));
    }
  }
  return found;
}

const violations = walk(repoRoot).filter((file) => !isAllowed(file));

if (violations.length > 0) {
  process.stderr.write('Forbidden lockfiles found (pnpm-only policy):\n');
  for (const file of violations.sort()) {
    process.stderr.write(`- ${file}\n`);
  }
  process.exit(1);
}

process.stdout.write('Lockfile policy check passed (pnpm-lock.yaml only).\n');
