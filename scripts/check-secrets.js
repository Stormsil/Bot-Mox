const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = process.cwd();

const secretRules = [
  { name: 'Google API key pattern', pattern: /AIza[0-9A-Za-z\-_]{35}/g },
  { name: 'Private key block', pattern: /-----BEGIN (RSA|EC|OPENSSH|PRIVATE) PRIVATE KEY-----/g },
];

const textFileExtensions = new Set([
  '.js',
  '.cjs',
  '.mjs',
  '.ts',
  '.tsx',
  '.json',
  '.md',
  '.yml',
  '.yaml',
  '.env',
  '.txt',
  '.css',
  '.scss',
  '.html',
]);

function isTextCandidate(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (textFileExtensions.has(ext)) return true;

  const fileName = path.basename(filePath).toLowerCase();
  return fileName === '.env' || fileName.endsWith('.env') || fileName.endsWith('.env.example');
}

function listTrackedFiles() {
  const raw = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  return raw
    .split('\0')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const candidates = listTrackedFiles()
  .filter(isTextCandidate)
  .map((rel) => ({ rel, abs: path.join(root, rel) }));

const violations = [];
for (const file of candidates) {
  let text = '';
  try {
    text = fs.readFileSync(file.abs, 'utf8');
  } catch {
    continue;
  }

  for (const rule of secretRules) {
    const matches = text.match(rule.pattern);
    if (!matches || matches.length === 0) continue;

    for (const match of matches) {
      violations.push({ file: file.rel, rule: rule.name, value: match });
    }
  }
}

if (violations.length > 0) {
  console.error('Secret scan failed. Potential sensitive values found in tracked files:');
  for (const violation of violations.slice(0, 100)) {
    console.error(`- ${violation.file}: ${violation.rule}`);
  }
  process.exit(1);
}

console.log('Secret scan passed (tracked + untracked files, excluding gitignored)');
