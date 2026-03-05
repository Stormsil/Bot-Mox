#!/usr/bin/env node
const { execSync } = require('node:child_process');

const CONTRACT_PREFIX = 'packages/api-contract/src/';
const OPENAPI_PATH = 'docs/api/openapi.yaml';

function run(command, fallback = '') {
  try {
    return execSync(command, { stdio: ['ignore', 'pipe', 'pipe'] })
      .toString()
      .trim();
  } catch {
    return fallback;
  }
}

function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/');
}

function parseChangedRaw(changedRaw) {
  if (!changedRaw) {
    return [];
  }

  return changedRaw
    .split('\n')
    .map((item) => normalizePath(item.trim()))
    .filter(Boolean);
}

function readArgValue(name) {
  const args = process.argv.slice(2);
  const directPrefix = `${name}=`;

  for (let index = 0; index < args.length; index += 1) {
    const item = args[index];
    if (item.startsWith(directPrefix)) {
      return item.slice(directPrefix.length).trim();
    }
    if (item === name) {
      const next = args[index + 1] ?? '';
      return String(next).trim();
    }
  }

  return '';
}

function getCommitRange() {
  const explicitRange = readArgValue('--range');
  if (explicitRange) {
    return explicitRange;
  }

  const baseRef = process.env.GITHUB_BASE_REF;
  if (baseRef) {
    run(`git fetch --no-tags --depth=200 origin ${baseRef}`);
    const hasRemoteBase = run(`git rev-parse --verify origin/${baseRef}`, '');
    if (hasRemoteBase) {
      return `origin/${baseRef}...HEAD`;
    }
  }

  const hasPrev = run('git rev-parse --verify HEAD~1', '');
  if (hasPrev) {
    return 'HEAD~1..HEAD';
  }

  return '';
}

function getChangedFiles() {
  const changedArg = readArgValue('--changed');
  if (changedArg) {
    return changedArg
      .split(',')
      .map((item) => normalizePath(item.trim()))
      .filter(Boolean);
  }

  const againstRef = readArgValue('--against');
  if (againstRef) {
    const changedRaw = run(`git diff --name-only ${againstRef}`, '');
    return parseChangedRaw(changedRaw);
  }

  const range = getCommitRange();
  if (!range) {
    return null;
  }

  const rangeChangedFiles = parseChangedRaw(run(`git diff --name-only ${range}`, ''));
  const isCiRun = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

  if (isCiRun) {
    return rangeChangedFiles;
  }

  const localChangedFiles = new Set(rangeChangedFiles);
  for (const file of parseChangedRaw(run('git diff --name-only', ''))) {
    localChangedFiles.add(file);
  }
  for (const file of parseChangedRaw(run('git diff --name-only --cached', ''))) {
    localChangedFiles.add(file);
  }

  return Array.from(localChangedFiles);
}

const changedFiles = getChangedFiles();
if (changedFiles === null) {
  process.stdout.write('[check:contract-openapi-sync] no diff range available, skipping.\n');
  process.exit(0);
}

if (changedFiles.length === 0) {
  process.stdout.write('[check:contract-openapi-sync] no changed files detected.\n');
  process.exit(0);
}

const contractChanged = changedFiles.some((file) => file.startsWith(CONTRACT_PREFIX));
const openApiChanged = changedFiles.includes(OPENAPI_PATH);

if (contractChanged && !openApiChanged) {
  process.stderr.write('[check:contract-openapi-sync] failed:\n');
  process.stderr.write(
    `- Contract sources under ${CONTRACT_PREFIX} changed, but ${OPENAPI_PATH} did not.\n`,
  );
  process.stderr.write(
    '- Update docs/api/openapi.yaml in the same change to keep contract and OpenAPI aligned.\n',
  );
  process.stderr.write('- Changed contract files:\n');
  for (const file of changedFiles) {
    if (file.startsWith(CONTRACT_PREFIX)) {
      process.stderr.write(`  - ${file}\n`);
    }
  }
  process.exit(1);
}

if (contractChanged && openApiChanged) {
  process.stdout.write(
    '[check:contract-openapi-sync] passed: contract and OpenAPI changed together.\n',
  );
  process.exit(0);
}

process.stdout.write(
  '[check:contract-openapi-sync] passed: no api-contract source drift detected.\n',
);
