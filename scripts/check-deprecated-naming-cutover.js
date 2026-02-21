#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = process.cwd();

const ROOTS = ['.github', 'apps', 'configs', 'deploy', 'docs', 'packages', 'scripts'];
const ROOT_FILES = [
  'README.md',
  'package.json',
  'pnpm-workspace.yaml',
  'start-dev.js',
  'turbo.json',
];

const SKIP_DIRS = new Set([
  '.git',
  '.idea',
  '.turbo',
  '.vscode',
  'coverage',
  'dist',
  'logs',
  'node_modules',
  'playwright-report',
  'release',
  'test-results',
]);

const SKIP_PATH_PREFIXES = ['docs/history/'];
const SKIP_FILES = new Set([
  'scripts/check-deprecated-naming-cutover.js',
  'scripts/check-docs-deprecated.js',
]);
const SKIP_EXTENSIONS = new Set([
  '.ico',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.pdf',
  '.zip',
  '.tar',
  '.gz',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.mp4',
  '.mp3',
  '.avi',
  '.mov',
  '.exe',
  '.dll',
  '.bin',
  '.db',
  '.sqlite',
]);

const DEPRECATED_PATTERNS = [
  { label: 'bot-mox', pattern: /\bbot-mox\b/g },
  { label: 'proxy-server', pattern: /\bproxy-server\b/g },
  { label: 'apps/api-legacy', pattern: /\bapps[\\/]+api-legacy\b/g },
  { label: 'apps/backend-legacy', pattern: /\bapps[\\/]+backend-legacy\b/g },
  { label: 'apps/api', pattern: /\bapps[\\/]+api\b/g },
  { label: '@botmox/web', pattern: /@botmox\/web\b/g },
  { label: '@botmox/api-legacy', pattern: /@botmox\/api-legacy\b/g },
];

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function shouldSkipPath(relativePath) {
  const posixPath = toPosix(relativePath);
  if (SKIP_FILES.has(posixPath)) {
    return true;
  }
  return SKIP_PATH_PREFIXES.some((prefix) => posixPath.startsWith(prefix));
}

function collectFiles(currentAbsolutePath, collected) {
  const entries = fs.readdirSync(currentAbsolutePath, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(currentAbsolutePath, entry.name);
    const relativePath = path.relative(repoRoot, absolutePath);

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || shouldSkipPath(relativePath)) {
        continue;
      }
      collectFiles(absolutePath, collected);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (shouldSkipPath(relativePath)) {
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (SKIP_EXTENSIONS.has(extension)) {
      continue;
    }

    collected.push(relativePath);
  }
}

function getLineNumber(source, index) {
  let line = 1;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (source[cursor] === '\n') {
      line += 1;
    }
  }
  return line;
}

const files = [];
for (const root of ROOTS) {
  const absoluteRoot = path.join(repoRoot, ...root.split('/'));
  if (!fs.existsSync(absoluteRoot)) {
    continue;
  }
  collectFiles(absoluteRoot, files);
}

for (const rootFile of ROOT_FILES) {
  const absoluteFile = path.join(repoRoot, ...rootFile.split('/'));
  if (fs.existsSync(absoluteFile)) {
    files.push(path.relative(repoRoot, absoluteFile));
  }
}

const uniqueFiles = Array.from(new Set(files)).sort();
const violations = [];

for (const relativePath of uniqueFiles) {
  const absolutePath = path.join(repoRoot, relativePath);
  let source = '';
  try {
    source = fs.readFileSync(absolutePath, 'utf8');
  } catch {
    continue;
  }

  for (const { label, pattern } of DEPRECATED_PATTERNS) {
    pattern.lastIndex = 0;
    let match = pattern.exec(source);
    while (match) {
      const line = getLineNumber(source, match.index);
      violations.push({
        file: toPosix(relativePath),
        line,
        label,
        snippet: match[0],
      });
      match = pattern.exec(source);
    }
  }
}

if (violations.length > 0) {
  process.stderr.write('Found deprecated naming references in active files:\n');
  for (const violation of violations) {
    process.stderr.write(
      `- ${violation.file}:${violation.line} -> ${violation.label} (${violation.snippet})\n`,
    );
  }
  process.exit(1);
}

process.stdout.write(
  `Deprecated naming cutover check passed (${uniqueFiles.length} active files scanned).\n`,
);
