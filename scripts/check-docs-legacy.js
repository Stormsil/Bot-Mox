#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = process.cwd();

const LEGACY_PATTERNS = [
  { label: 'bot-mox', pattern: /\bbot-mox\b/g },
  { label: 'proxy-server', pattern: /\bproxy-server\b/g },
  { label: 'apps/api-legacy', pattern: /\bapps[\\/]+api-legacy\b/g },
  { label: 'apps/backend-legacy', pattern: /\bapps[\\/]+backend-legacy\b/g },
  { label: '@botmox/web', pattern: /@botmox\/web\b/g },
  { label: '@botmox/api-legacy', pattern: /@botmox\/api-legacy\b/g },
];

const ALLOWED_PREFIXES = ['docs/history/'];
const SKIP_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.pdf',
  '.zip',
  '.tar',
  '.gz',
]);

function walk(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    const rel = path.relative(repoRoot, abs).split(path.sep).join('/');

    if (entry.isDirectory()) {
      walk(abs, files);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (SKIP_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      continue;
    }

    files.push({ abs, rel });
  }
  return files;
}

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

const docsDir = path.join(repoRoot, 'docs');
if (!fs.existsSync(docsDir)) {
  process.stdout.write('No docs directory, skipping legacy docs check.\n');
  process.exit(0);
}

const files = walk(docsDir);
const violations = [];

for (const { abs, rel } of files) {
  if (ALLOWED_PREFIXES.some((prefix) => rel.startsWith(prefix))) {
    continue;
  }

  const source = fs.readFileSync(abs, 'utf8');
  for (const { label, pattern } of LEGACY_PATTERNS) {
    pattern.lastIndex = 0;
    let m = pattern.exec(source);
    while (m) {
      violations.push({ rel, label, line: lineNumber(source, m.index), snippet: m[0] });
      m = pattern.exec(source);
    }
  }
}

if (violations.length > 0) {
  process.stderr.write('Legacy references found in active docs:\n');
  for (const v of violations) {
    process.stderr.write(`- ${v.rel}:${v.line} -> ${v.label} (${v.snippet})\n`);
  }
  process.exit(1);
}

process.stdout.write('Docs legacy check passed.\n');
