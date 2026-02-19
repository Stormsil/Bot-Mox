#!/usr/bin/env node
const { execSync } = require('node:child_process');

function run(command, fallback = '') {
  try {
    return execSync(command, { stdio: ['ignore', 'pipe', 'pipe'] })
      .toString()
      .trim();
  } catch {
    return fallback;
  }
}

function normalize(file) {
  return file.replace(/\\/g, '/');
}

function getRange() {
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

  return null;
}

const range = getRange();
if (!range) {
  process.stdout.write('Docs change policy: no diff range available, skipping.\n');
  process.exit(0);
}

const changedRaw = run(`git diff --name-only ${range}`, '');
if (!changedRaw) {
  process.stdout.write(`Docs change policy: no changed files in ${range}.\n`);
  process.exit(0);
}

const changedFiles = changedRaw
  .split('\n')
  .map((item) => normalize(item.trim()))
  .filter(Boolean);

const docsChanged = changedFiles.some((file) => {
  if (!file.startsWith('docs/')) {
    return false;
  }
  if (file.startsWith('docs/history/')) {
    return false;
  }
  return file.endsWith('.md') || file.endsWith('.yaml') || file.endsWith('.yml');
});

const triggerPatterns = [
  /^apps\/(frontend|backend|agent)\//,
  /^packages\/(api-contract|database-schema|shared-types|ui-kit|utils)\//,
  /^configs\//,
  /^deploy\//,
  /^scripts\/(check-|generate-|doctor|dev-trace|stack-|deploy-|rollback-|supabase-)/,
  /^start-dev\.js$/,
  /^package\.json$/,
  /^pnpm-workspace\.yaml$/,
  /^turbo\.json$/,
  /^\.github\/workflows\//,
];

const triggeredFiles = changedFiles.filter((file) =>
  triggerPatterns.some((pattern) => pattern.test(file)),
);

if (triggeredFiles.length === 0) {
  process.stdout.write(
    'Docs change policy: no architecture/workflow affecting changes detected.\n',
  );
  process.exit(0);
}

if (!docsChanged) {
  process.stderr.write('Docs change policy failed:\n');
  process.stderr.write(
    '- This change affects architecture/workflow-critical paths, but no active docs were updated.\n',
  );
  process.stderr.write(
    '- Update at least one file under docs/ (excluding docs/history/) in the same PR.\n',
  );
  process.stderr.write('- Triggering files:\n');
  for (const file of triggeredFiles) {
    process.stderr.write(`  - ${file}\n`);
  }
  process.exit(1);
}

process.stdout.write('Docs change policy passed (active docs updated for critical changes).\n');
