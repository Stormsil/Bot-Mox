#!/usr/bin/env node
const path = require('node:path');
const fs = require('node:fs');
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

function runNodeScript(scriptRelativePath, env) {
  const scriptPath = path.join(repoRoot, scriptRelativePath);
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: repoRoot,
    env,
    stdio: 'inherit',
  });
  if (result.error) {
    throw result.error;
  }
  return Number.isInteger(result.status) ? result.status : 1;
}

function formatTimestampForFile(date) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function toSafeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readRotationAggregate(reportPath) {
  if (!reportPath || !fs.existsSync(reportPath)) {
    throw new Error(`rotation_report_missing: ${reportPath || '(empty-path)'}`);
  }
  try {
    const source = fs.readFileSync(reportPath, 'utf8');
    const parsed = JSON.parse(source);
    const aggregate =
      parsed &&
      typeof parsed === 'object' &&
      parsed.aggregate &&
      typeof parsed.aggregate === 'object'
        ? parsed.aggregate
        : null;
    if (!aggregate) {
      throw new Error('rotation_report_invalid: missing aggregate section');
    }
    return {
      failedTenants: toSafeNumber(aggregate.failed_tenants),
      failedRows: toSafeNumber(aggregate.failed_total),
    };
  } catch (error) {
    throw new Error(
      `rotation_report_invalid: ${error instanceof Error ? error.message : 'unknown_error'}`,
    );
  }
}

function main() {
  const keyId = readEnv('DATA_ENCRYPTION_ROTATE_KEY_ID', '');
  if (!keyId) {
    throw new Error('DATA_ENCRYPTION_ROTATE_KEY_ID is required');
  }

  const maxFailedTenants = Number.parseInt(
    readEnv('DATA_ENCRYPTION_ROTATE_MAX_FAILED_TENANTS', '0'),
    10,
  );
  const maxFailedRows = Number.parseInt(readEnv('DATA_ENCRYPTION_ROTATE_MAX_FAILED_ROWS', '0'), 10);

  const env = {
    ...process.env,
    DATA_ENCRYPTION_ROTATE_REPORT_PATH:
      readEnv('DATA_ENCRYPTION_ROTATE_REPORT_PATH', '') ||
      `logs/data-encryption-rotation-report-${formatTimestampForFile(new Date())}.json`,
    DATA_ENCRYPTION_ROTATE_DRY_RUN: dryRun
      ? 'true'
      : readEnv('DATA_ENCRYPTION_ROTATE_DRY_RUN', 'false'),
  };

  if (env.DATA_ENCRYPTION_ROTATE_DRY_RUN !== 'true') {
    const preflight = runNodeScript('scripts/data-encryption-rotation-runner.js', {
      ...env,
      DATA_ENCRYPTION_ROTATE_DRY_RUN: 'true',
    });
    if (preflight !== 0) {
      process.exit(preflight);
    }
  }

  const runResult = spawnSync(
    process.execPath,
    [path.join(repoRoot, 'scripts/data-encryption-rotation-runner.js')],
    {
      cwd: repoRoot,
      env,
      stdio: ['inherit', 'pipe', 'pipe'],
      encoding: 'utf8',
    },
  );

  if (runResult.stdout) {
    process.stdout.write(runResult.stdout);
  }
  if (runResult.stderr) {
    process.stderr.write(runResult.stderr);
  }
  if (runResult.error) {
    throw runResult.error;
  }
  if (runResult.status !== 0) {
    process.exit(runResult.status || 1);
  }

  const aggregateFromReport = readRotationAggregate(env.DATA_ENCRYPTION_ROTATE_REPORT_PATH);
  const failedTenants = aggregateFromReport.failedTenants;
  const failedRows = aggregateFromReport.failedRows;

  const normalizedMaxFailedTenants = Number.isFinite(maxFailedTenants)
    ? Math.max(0, maxFailedTenants)
    : 0;
  const normalizedMaxFailedRows = Number.isFinite(maxFailedRows) ? Math.max(0, maxFailedRows) : 0;

  if (failedTenants > normalizedMaxFailedTenants || failedRows > normalizedMaxFailedRows) {
    throw new Error(
      `rotation_failed_threshold: failed_tenants=${failedTenants}, failed_rows=${failedRows}, max_failed_tenants=${normalizedMaxFailedTenants}, max_failed_rows=${normalizedMaxFailedRows}`,
    );
  }

  const auditScriptPath = path.join(repoRoot, 'scripts/data-encryption-rotation-audit-window.js');
  const auditArgs = strict ? [auditScriptPath, '--strict'] : [auditScriptPath];
  const auditResult = spawnSync(process.execPath, auditArgs, {
    cwd: repoRoot,
    env,
    stdio: 'inherit',
  });
  if (auditResult.error) {
    throw auditResult.error;
  }
  if (auditResult.status !== 0) {
    throw new Error(`audit_window_failed: exit=${auditResult.status ?? 'null'}`);
  }
}

try {
  main();
} catch (error) {
  process.stderr.write(
    `[data-encryption-rotation-cycle] FAIL ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
}
