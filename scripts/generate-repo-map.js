#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, 'docs', '_generated');
const outputFile = path.join(outputDir, 'repo-map.txt');

const roots = ['apps', 'packages', 'configs', 'deploy', 'docs', 'scripts', 'supabase'];
const maxDepth = 4;
const skipDirs = new Set([
  '.git',
  'node_modules',
  '.turbo',
  'dist',
  'build',
  'coverage',
  'playwright-report',
  'test-results',
  '.serena',
  '.claude',
  '.vscode',
  '.kilocode',
  'logs',
]);

function safeReadDir(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function renderTree(absolutePath, relativePath, depth, lines) {
  if (depth > maxDepth) {
    return;
  }

  const entries = safeReadDir(absolutePath)
    .filter((entry) => !entry.name.startsWith('.'))
    .filter((entry) => !(entry.isDirectory() && skipDirs.has(entry.name)))
    .sort(
      (a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name),
    );

  for (const entry of entries) {
    const rel = relativePath ? `${relativePath}/${entry.name}` : entry.name;
    const indent = '  '.repeat(depth);
    lines.push(`${indent}- ${rel}${entry.isDirectory() ? '/' : ''}`);

    if (entry.isDirectory()) {
      renderTree(path.join(absolutePath, entry.name), rel, depth + 1, lines);
    }
  }
}

fs.mkdirSync(outputDir, { recursive: true });

const lines = [];
lines.push('# Repository Map');
lines.push('');
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push(`Depth: ${maxDepth}`);
lines.push('');

for (const root of roots) {
  const absolute = path.join(repoRoot, root);
  if (!fs.existsSync(absolute)) {
    continue;
  }
  lines.push(`## ${root}`);
  renderTree(absolute, root, 0, lines);
  lines.push('');
}

fs.writeFileSync(outputFile, `${lines.join('\n')}\n`, 'utf8');
process.stdout.write(`Wrote ${path.relative(repoRoot, outputFile)}\n`);
