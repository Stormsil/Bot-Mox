#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, 'docs', '_generated');
const outputFile = path.join(outputDir, 'hotspots.csv');

const roots = ['apps/frontend/src', 'apps/backend/src', 'apps/agent/src', 'packages'];
const includeExtensions = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.css',
  '.md',
  '.json',
  '.yaml',
  '.yml',
  '.sql',
]);
const skipDirs = new Set([
  'node_modules',
  '.turbo',
  'dist',
  'build',
  'coverage',
  'playwright-report',
  'test-results',
]);

function ownerLayer(relativePath) {
  const normalized = relativePath.split(path.sep).join('/');
  if (normalized.startsWith('apps/frontend/src/pages/')) return 'frontend-page';
  if (normalized.startsWith('apps/frontend/src/components/')) return 'frontend-component';
  if (normalized.startsWith('apps/frontend/src/services/')) return 'frontend-service';
  if (normalized.startsWith('apps/frontend/src/hooks/')) return 'frontend-hook';
  if (normalized.startsWith('apps/frontend/src/entities/')) return 'frontend-entity';
  if (normalized.startsWith('apps/backend/src/modules/')) return 'backend-module';
  if (normalized.startsWith('apps/agent/src/')) return 'agent';
  if (normalized.startsWith('packages/api-contract/')) return 'contract';
  if (normalized.startsWith('packages/database-schema/')) return 'database-schema';
  if (normalized.startsWith('packages/')) return 'package';
  return 'other';
}

function walk(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) {
        continue;
      }
      walk(abs, files);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (!includeExtensions.has(ext)) {
      continue;
    }
    files.push(abs);
  }
  return files;
}

const rows = [];
for (const root of roots) {
  const absRoot = path.join(repoRoot, root);
  if (!fs.existsSync(absRoot)) {
    continue;
  }

  for (const absFile of walk(absRoot)) {
    const source = fs.readFileSync(absFile, 'utf8');
    const lines = source.split('\n').length;
    const bytes = fs.statSync(absFile).size;
    const relative = path.relative(repoRoot, absFile).split(path.sep).join('/');
    rows.push({ path: relative, lines, bytes, ownerLayer: ownerLayer(relative) });
  }
}

rows.sort((a, b) => b.lines - a.lines || b.bytes - a.bytes || a.path.localeCompare(b.path));

fs.mkdirSync(outputDir, { recursive: true });
const header = 'path,lines,bytes,owner_layer';
const content = [
  header,
  ...rows.map((row) => `${row.path},${row.lines},${row.bytes},${row.ownerLayer}`),
].join('\n');
fs.writeFileSync(outputFile, `${content}\n`, 'utf8');
process.stdout.write(`Wrote ${path.relative(repoRoot, outputFile)} (${rows.length} rows)\n`);
