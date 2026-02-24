#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const args = new Set(process.argv.slice(2));
const strict = args.has('--strict');

const repoRoot = process.cwd();
const now = new Date();
const dateIso = now.toISOString().slice(0, 10);
const timestampIso = now.toISOString();
const monthKey = dateIso.slice(0, 7);
const reportJsonPath = path.resolve(
  repoRoot,
  String(process.env.SECRETS_ROTATE_REPORT_PATH || 'logs/secrets-rotation-report.json').trim(),
);
const auditRelPath = path.join('docs', 'audits', `secrets-rotation-${monthKey}.md`);
const auditAbsPath = path.join(repoRoot, auditRelPath);

function ensureAuditFile(filePath) {
  if (fs.existsSync(filePath)) {
    return;
  }

  const initial = [
    '# Secrets Rotation Audit Window',
    '',
    'Status: Active  ',
    'Owner: Platform Security  ',
    `Last Updated: ${dateIso}  `,
    'Applies To: `apps/backend`, `scripts/secrets-rotation-runner.js`',
    '',
    '## Purpose',
    '',
    'Operational evidence log for tenant secret rotation runs (dry-run and live).',
    '',
    '## Entries',
    '',
    '| Timestamp (UTC) | Key ID | Dry Run | Tenants | Successful | Failed Tenants | Planned | Rotated | Skipped | Failed Secrets | Status | Details |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    '',
  ];

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${initial.join('\n')}\n`, 'utf8');
}

function updateLastUpdated(source) {
  if (source.includes('Last Updated:')) {
    return source.replace(/Last Updated:\s*[0-9]{4}-[0-9]{2}-[0-9]{2}/, `Last Updated: ${dateIso}`);
  }
  return source;
}

function readRotationReport(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`rotation report not found: ${filePath}`);
  }
  const source = fs.readFileSync(filePath, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    throw new Error(
      `rotation report is not valid JSON: ${error instanceof Error ? error.message : 'unknown_error'}`,
    );
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('rotation report payload must be an object');
  }
  const summary =
    parsed.summary && typeof parsed.summary === 'object'
      ? parsed.summary
      : (() => {
          throw new Error('rotation report payload is missing summary object');
        })();
  return {
    generatedAt: String(parsed.generated_at || timestampIso),
    keyId: String(parsed.key_id || '').trim() || '(unknown)',
    dryRun: parsed.dry_run === true,
    tenantIds: Array.isArray(parsed.tenant_ids)
      ? parsed.tenant_ids.map((value) => String(value || '').trim()).filter(Boolean)
      : [],
    summary,
  };
}

function toSafeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function runRotationCycle() {
  const commandArgs = ['run', 'secrets:rotate:run'];
  const rotationEnv = { ...process.env };
  const explicitDryRun = String(rotationEnv.SECRETS_ROTATE_DRY_RUN || '').trim();
  if (!String(rotationEnv.SECRETS_ROTATE_KEY_ID || '').trim()) {
    rotationEnv.SECRETS_ROTATE_KEY_ID = `local-key-${dateIso}`;
  }
  if (!String(rotationEnv.BOTMOX_ADMIN_EMAIL || '').trim()) {
    rotationEnv.BOTMOX_ADMIN_EMAIL = 'admin@localhost';
  }
  if (!String(rotationEnv.BOTMOX_ADMIN_PASSWORD || '').trim()) {
    rotationEnv.BOTMOX_ADMIN_PASSWORD = 'BotmoxLocal234';
  }
  if (!String(rotationEnv.API_BASE_URL || '').trim()) {
    rotationEnv.API_BASE_URL = 'http://localhost';
  }
  if (strict) {
    if (!explicitDryRun) {
      rotationEnv.SECRETS_ROTATE_DRY_RUN = 'false';
    }
    rotationEnv.SECRETS_ROTATE_REQUIRE_DRY_RUN_PREFLIGHT = 'true';
    rotationEnv.SECRETS_ROTATE_MAX_FAILED_TENANTS = '0';
    rotationEnv.SECRETS_ROTATE_MAX_FAILED_SECRETS = '0';
  }
  rotationEnv.SECRETS_ROTATE_REPORT_PATH = reportJsonPath;
  const primaryCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  let result = spawnSync(primaryCommand, commandArgs, {
    cwd: repoRoot,
    env: rotationEnv,
    stdio: 'inherit',
    shell: false,
  });
  if (process.platform === 'win32' && (result.error || result.status === null)) {
    result = spawnSync(`pnpm ${commandArgs.join(' ')}`, {
      cwd: repoRoot,
      env: rotationEnv,
      stdio: 'inherit',
      shell: true,
    });
  }
  if (result.status !== 0) {
    throw new Error(
      `rotation cycle command failed: pnpm ${commandArgs.join(' ')} (exit=${result.status ?? 'null'})`,
    );
  }
}

if (!fs.existsSync(reportJsonPath)) {
  runRotationCycle();
}

const report = readRotationReport(reportJsonPath);
const summary = report.summary;
const requestedTenants = toSafeNumber(summary.requested_tenants || report.tenantIds.length);
const successfulTenants = toSafeNumber(summary.successful_tenants);
const failedTenants = toSafeNumber(summary.failed_tenants);
const plannedTotal = toSafeNumber(summary.planned_total);
const rotatedTotal = toSafeNumber(summary.rotated_total);
const skippedTotal = toSafeNumber(summary.skipped_total);
const failedTotal = toSafeNumber(summary.failed_total);
const status = failedTenants > 0 || failedTotal > 0 ? 'fail' : 'pass';

const detailsParts = [];
if (failedTenants > 0) {
  detailsParts.push(`failed_tenants=${failedTenants}`);
}
if (failedTotal > 0) {
  detailsParts.push(`failed_secrets=${failedTotal}`);
}
if (detailsParts.length === 0) {
  detailsParts.push('ok');
}
const details = detailsParts.join('; ');

ensureAuditFile(auditAbsPath);
let auditSource = fs.readFileSync(auditAbsPath, 'utf8');
auditSource = updateLastUpdated(auditSource);
const row = `| ${report.generatedAt} | ${report.keyId} | ${report.dryRun ? 'true' : 'false'} | ${requestedTenants} | ${successfulTenants} | ${failedTenants} | ${plannedTotal} | ${rotatedTotal} | ${skippedTotal} | ${failedTotal} | ${status} | ${details} |`;
if (!auditSource.endsWith('\n')) {
  auditSource += '\n';
}
auditSource += `${row}\n`;
fs.writeFileSync(auditAbsPath, auditSource, 'utf8');

process.stdout.write(`Secrets-rotation audit entry written: ${auditRelPath}\n`);
process.stdout.write(`Status: ${status}\n`);

if (strict && status === 'fail') {
  process.exit(1);
}
