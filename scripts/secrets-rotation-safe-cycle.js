#!/usr/bin/env node
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

function runNodeScript(scriptRelativePath, env, extraArgs = []) {
  const scriptPath = path.join(repoRoot, scriptRelativePath);
  const result = spawnSync(process.execPath, [scriptPath, ...extraArgs], {
    cwd: repoRoot,
    env,
    stdio: 'inherit',
  });
  if (result.error) {
    throw result.error;
  }
  return Number.isInteger(result.status) ? result.status : 1;
}

function main() {
  const keyId = readEnv('SECRETS_ROTATE_KEY_ID', '');
  if (!keyId) {
    throw new Error('SECRETS_ROTATE_KEY_ID is required');
  }

  const timestamp = formatTimestampForFile(new Date());
  const reportPath =
    readEnv('SECRETS_ROTATE_REPORT_PATH', '') || `logs/secrets-rotation-report-${timestamp}.json`;

  const env = {
    ...process.env,
    SECRETS_ROTATE_REPORT_PATH: reportPath,
  };

  if (dryRun) {
    env.SECRETS_ROTATE_DRY_RUN = 'true';
  } else {
    env.SECRETS_ROTATE_DRY_RUN = readEnv('SECRETS_ROTATE_DRY_RUN', 'false') || 'false';
    env.SECRETS_ROTATE_REQUIRE_DRY_RUN_PREFLIGHT =
      readEnv('SECRETS_ROTATE_REQUIRE_DRY_RUN_PREFLIGHT', 'true') || 'true';
    env.SECRETS_ROTATE_MAX_FAILED_TENANTS =
      readEnv('SECRETS_ROTATE_MAX_FAILED_TENANTS', '0') || '0';
    env.SECRETS_ROTATE_MAX_FAILED_SECRETS =
      readEnv('SECRETS_ROTATE_MAX_FAILED_SECRETS', '0') || '0';
  }

  process.stdout.write(`[secrets-rotation-cycle] key_id=${keyId}\n`);
  process.stdout.write(`[secrets-rotation-cycle] dry_run=${env.SECRETS_ROTATE_DRY_RUN}\n`);
  process.stdout.write(`[secrets-rotation-cycle] report=${reportPath}\n`);

  const rotationExit = runNodeScript('scripts/secrets-rotation-runner.js', env);
  if (rotationExit !== 0) {
    process.exit(rotationExit);
  }

  const auditArgs = strict ? ['--strict'] : [];
  const auditExit = runNodeScript('scripts/secrets-rotation-audit-window.js', env, auditArgs);
  process.exit(auditExit);
}

try {
  main();
} catch (error) {
  process.stderr.write(
    `[secrets-rotation-cycle] FAIL ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
}
