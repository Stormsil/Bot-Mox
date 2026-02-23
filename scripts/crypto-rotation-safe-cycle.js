#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const args = new Set(process.argv.slice(2));
const strict = args.has('--strict');
const dryRun = args.has('--dry-run');
const repoRoot = process.cwd();

function readEnv(name, fallback = '') {
  const value = process.env[name];
  if (value === undefined || value === null) {
    return fallback;
  }
  return String(value).trim();
}

function formatTimestampForFile(date) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function runNodeScript(scriptRelativePath, extraArgs = [], extraEnv = {}) {
  const scriptPath = path.join(repoRoot, scriptRelativePath);
  const result = spawnSync(process.execPath, [scriptPath, ...extraArgs], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...extraEnv,
    },
    stdio: 'inherit',
  });
  if (result.error) {
    throw result.error;
  }
  return Number.isInteger(result.status) ? result.status : 1;
}

function main() {
  const secretsKeyId = readEnv('SECRETS_ROTATE_KEY_ID', '');
  const dataKeyId = readEnv('DATA_ENCRYPTION_ROTATE_KEY_ID', '');

  if (!secretsKeyId) {
    throw new Error('SECRETS_ROTATE_KEY_ID is required');
  }
  if (!dataKeyId) {
    throw new Error('DATA_ENCRYPTION_ROTATE_KEY_ID is required');
  }

  const timestamp = formatTimestampForFile(new Date());
  const logsDir = path.join(repoRoot, 'logs');
  const auditsDir = path.join(repoRoot, 'docs', 'audits');
  ensureDir(logsDir);
  ensureDir(auditsDir);

  const secretsReportPath =
    readEnv('SECRETS_ROTATE_REPORT_PATH', '') || `logs/secrets-rotation-report-${timestamp}.json`;
  const dataReportPath =
    readEnv('DATA_ENCRYPTION_ROTATE_REPORT_PATH', '') ||
    `logs/data-encryption-rotation-report-${timestamp}.json`;

  const commonArgs = [];
  if (strict) commonArgs.push('--strict');
  if (dryRun) commonArgs.push('--dry-run');

  process.stdout.write('[crypto-rotation-cycle] starting combined rotation cycle\n');
  process.stdout.write(`[crypto-rotation-cycle] strict=${strict ? 'true' : 'false'}\n`);
  process.stdout.write(`[crypto-rotation-cycle] dry_run=${dryRun ? 'true' : 'false'}\n`);
  process.stdout.write(`[crypto-rotation-cycle] secrets_key_id=${secretsKeyId}\n`);
  process.stdout.write(`[crypto-rotation-cycle] data_key_id=${dataKeyId}\n`);
  process.stdout.write(
    '[crypto-rotation-cycle] data scope includes tenant content domains (workspace notes/calendar/kanban, finance, settings, resources, playbooks, bots, artifacts, theme, license, provisioning, infra, vmops)\n',
  );

  const secretsExit = runNodeScript('scripts/secrets-rotation-safe-cycle.js', commonArgs, {
    SECRETS_ROTATE_REPORT_PATH: secretsReportPath,
  });
  if (secretsExit !== 0) {
    process.exit(secretsExit);
  }

  const dataExit = runNodeScript('scripts/data-encryption-rotation-safe-cycle.js', commonArgs, {
    DATA_ENCRYPTION_ROTATE_REPORT_PATH: dataReportPath,
  });
  if (dataExit !== 0) {
    process.exit(dataExit);
  }

  const summaryLines = [
    `timestamp=${new Date().toISOString()}`,
    `strict=${strict ? 'true' : 'false'}`,
    `dry_run=${dryRun ? 'true' : 'false'}`,
    `secrets_key_id=${secretsKeyId}`,
    `data_key_id=${dataKeyId}`,
    `secrets_report_path=${secretsReportPath}`,
    `data_report_path=${dataReportPath}`,
    'data_scope_note=workspace domain includes notes/calendar/kanban and other tenant content domains',
    'status=PASS',
  ];

  const latestPath = path.join(auditsDir, 'crypto-rotation-latest.txt');
  const timestampedPath = path.join(auditsDir, `crypto-rotation-${timestamp}.txt`);
  fs.writeFileSync(latestPath, `${summaryLines.join('\n')}\n`, 'utf8');
  fs.writeFileSync(timestampedPath, `${summaryLines.join('\n')}\n`, 'utf8');

  process.stdout.write(
    `[crypto-rotation-cycle] summary_latest=${path.relative(repoRoot, latestPath)}\n`,
  );
  process.stdout.write(
    `[crypto-rotation-cycle] summary_timestamped=${path.relative(repoRoot, timestampedPath)}\n`,
  );
  process.stdout.write('[crypto-rotation-cycle] PASS\n');
}
try {
  main();
} catch (error) {
  process.stderr.write(
    `[crypto-rotation-cycle] FAIL ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
}
