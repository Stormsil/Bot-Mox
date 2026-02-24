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
  String(
    process.env.DATA_ENCRYPTION_ROTATE_REPORT_PATH || 'logs/data-encryption-rotation-report.json',
  ).trim(),
);
const auditRelPath = path.join('docs', 'audits', `data-encryption-rotation-${monthKey}.md`);
const auditAbsPath = path.join(repoRoot, auditRelPath);

function ensureAuditFile(filePath) {
  if (fs.existsSync(filePath)) {
    return;
  }

  const initial = [
    '# Data Encryption Rotation Audit Window',
    '',
    'Status: Active  ',
    'Owner: Platform Security  ',
    `Last Updated: ${dateIso}  `,
    'Applies To: `apps/backend`, `scripts/data-encryption-rotation-runner.js`',
    '',
    '## Purpose',
    '',
    'Operational evidence log for content encryption key rotations across tenant-scoped domains.',
    '',
    '## Entries',
    '',
    '| Timestamp (UTC) | Key ID | Scope | Dry Run | Tenants | Successful | Failed Tenants | Planned | Rotated | Skipped | Failed Rows | Status | Details |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
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

function runRotationCycle() {
  const commandArgs = ['run', 'data:rotate:run'];
  const env = { ...process.env };
  if (!String(env.DATA_ENCRYPTION_ROTATE_KEY_ID || '').trim()) {
    env.DATA_ENCRYPTION_ROTATE_KEY_ID = `local-data-key-${dateIso}`;
  }
  if (!String(env.BOTMOX_ADMIN_EMAIL || '').trim()) {
    env.BOTMOX_ADMIN_EMAIL = 'admin@localhost';
  }
  if (!String(env.BOTMOX_ADMIN_PASSWORD || '').trim()) {
    env.BOTMOX_ADMIN_PASSWORD = 'BotmoxLocal234';
  }
  if (!String(env.API_BASE_URL || '').trim()) {
    env.API_BASE_URL = 'http://localhost';
  }
  env.DATA_ENCRYPTION_ROTATE_REPORT_PATH = reportJsonPath;

  const primaryCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  let result = spawnSync(primaryCommand, commandArgs, {
    cwd: repoRoot,
    env,
    stdio: 'inherit',
    shell: false,
  });
  if (process.platform === 'win32' && (result.error || result.status === null)) {
    result = spawnSync(`pnpm ${commandArgs.join(' ')}`, {
      cwd: repoRoot,
      env,
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
  const summaries = Array.isArray(parsed.summaries) ? parsed.summaries : [];
  const aggregate =
    parsed.aggregate && typeof parsed.aggregate === 'object' ? parsed.aggregate : {};
  return {
    generatedAt: String(parsed.generated_at || timestampIso),
    keyId: String(parsed.key_id || '').trim() || '(unknown)',
    scope: String(parsed.scope || 'all')
      .trim()
      .toLowerCase(),
    dryRun: parsed.dry_run === true,
    tenantIds: Array.isArray(parsed.tenant_ids)
      ? parsed.tenant_ids.map((value) => String(value || '').trim()).filter(Boolean)
      : [],
    summaries,
    aggregate,
  };
}

function toSafeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

if (!fs.existsSync(reportJsonPath)) {
  runRotationCycle();
}

const report = readRotationReport(reportJsonPath);
const summaryList = report.summaries.filter((item) => item && typeof item === 'object');
const successfulTenants = summaryList.reduce(
  (acc, row) => acc + toSafeNumber(row?.summary?.successful_tenants),
  0,
);
const failedTenants = toSafeNumber(report.aggregate.failed_tenants);
const plannedTotal = summaryList.reduce(
  (acc, row) => acc + toSafeNumber(row?.summary?.planned_total),
  0,
);
const rotatedTotal = summaryList.reduce(
  (acc, row) => acc + toSafeNumber(row?.summary?.rotated_total),
  0,
);
const skippedTotal = summaryList.reduce(
  (acc, row) => acc + toSafeNumber(row?.summary?.skipped_total),
  0,
);
const failedTotal = toSafeNumber(report.aggregate.failed_total);
const status = failedTenants > 0 || failedTotal > 0 ? 'fail' : 'pass';

const detailsParts = [];
for (const row of summaryList) {
  const scope = String(row.scope || '')
    .trim()
    .toLowerCase();
  if (!scope) {
    continue;
  }
  const rotated = toSafeNumber(row?.summary?.rotated_total);
  const failedRows = toSafeNumber(row?.summary?.failed_total);
  detailsParts.push(`${scope}:rotated=${rotated},failed=${failedRows}`);
}
if (detailsParts.length === 0) {
  detailsParts.push('ok');
}

ensureAuditFile(auditAbsPath);
let auditSource = fs.readFileSync(auditAbsPath, 'utf8');
auditSource = updateLastUpdated(auditSource);

const row = `| ${report.generatedAt} | ${report.keyId} | ${report.scope} | ${report.dryRun ? 'true' : 'false'} | ${report.tenantIds.length} | ${successfulTenants} | ${failedTenants} | ${plannedTotal} | ${rotatedTotal} | ${skippedTotal} | ${failedTotal} | ${status} | ${detailsParts.join('; ')} |`;
if (!auditSource.endsWith('\n')) {
  auditSource += '\n';
}
auditSource += `${row}\n`;
fs.writeFileSync(auditAbsPath, auditSource, 'utf8');

process.stdout.write(`Data-encryption rotation audit entry written: ${auditRelPath}\n`);
process.stdout.write(`Status: ${status}\n`);

if (strict && status === 'fail') {
  process.exit(1);
}
