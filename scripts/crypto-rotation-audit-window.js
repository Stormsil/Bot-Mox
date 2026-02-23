#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const args = new Set(process.argv.slice(2));
const strict = args.has('--strict');

const repoRoot = process.cwd();
const now = new Date();
const dateIso = now.toISOString().slice(0, 10);
const monthKey = dateIso.slice(0, 7);

const secretsReportPath = path.resolve(
  repoRoot,
  String(process.env.SECRETS_ROTATE_REPORT_PATH || 'logs/secrets-rotation-report.json').trim(),
);
const dataReportPath = path.resolve(
  repoRoot,
  String(
    process.env.DATA_ENCRYPTION_ROTATE_REPORT_PATH || 'logs/data-encryption-rotation-report.json',
  ).trim(),
);
const auditRelPath = path.join('docs', 'audits', `crypto-rotation-${monthKey}.md`);
const auditAbsPath = path.join(repoRoot, auditRelPath);

function ensureAuditFile(filePath) {
  if (fs.existsSync(filePath)) {
    return;
  }

  const initial = [
    '# Crypto Rotation Audit Window',
    '',
    'Status: Active  ',
    'Owner: Platform Security  ',
    `Last Updated: ${dateIso}  `,
    'Applies To: `apps/backend`, `scripts/secrets-rotation-runner.js`, `scripts/data-encryption-rotation-runner.js`',
    '',
    '## Purpose',
    '',
    'Unified operational evidence log for key rotation windows across tenant secrets and tenant content encryption (including workspace notes and other sensitive user data).',
    '',
    '## Entries',
    '',
    '| Timestamp (UTC) | Secrets Key | Data Key | Secrets Dry Run | Data Dry Run | Tenant Count | Secrets Failed Tenants | Secrets Failed Secrets | Data Failed Tenants | Data Failed Rows | Status | Details |',
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

function readJson(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} report not found: ${filePath}`);
  }
  const source = fs.readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(
      `${label} report is not valid JSON: ${error instanceof Error ? error.message : 'unknown_error'}`,
    );
  }
}

function toSafeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeSecretsReport(parsed) {
  const summary = parsed?.summary && typeof parsed.summary === 'object' ? parsed.summary : {};
  const tenantIds = Array.isArray(parsed?.tenant_ids)
    ? parsed.tenant_ids.map((value) => String(value || '').trim()).filter(Boolean)
    : [];
  return {
    generatedAt: String(parsed?.generated_at || now.toISOString()),
    keyId: String(parsed?.key_id || '').trim() || '(unknown)',
    dryRun: parsed?.dry_run === true,
    tenantCount: Math.max(toSafeNumber(summary.requested_tenants), tenantIds.length),
    failedTenants: toSafeNumber(summary.failed_tenants),
    failedTotal: toSafeNumber(summary.failed_total),
  };
}

function normalizeDataReport(parsed) {
  const aggregate =
    parsed?.aggregate && typeof parsed.aggregate === 'object' ? parsed.aggregate : {};
  const tenantIds = Array.isArray(parsed?.tenant_ids)
    ? parsed.tenant_ids.map((value) => String(value || '').trim()).filter(Boolean)
    : [];
  return {
    generatedAt: String(parsed?.generated_at || now.toISOString()),
    keyId: String(parsed?.key_id || '').trim() || '(unknown)',
    dryRun: parsed?.dry_run === true,
    tenantCount: tenantIds.length,
    failedTenants: toSafeNumber(aggregate.failed_tenants),
    failedTotal: toSafeNumber(aggregate.failed_total),
    scope: String(parsed?.scope || 'all')
      .trim()
      .toLowerCase(),
  };
}

function maxIso(a, b) {
  return String(a) > String(b) ? String(a) : String(b);
}

const secrets = normalizeSecretsReport(readJson(secretsReportPath, 'secrets rotation'));
const data = normalizeDataReport(readJson(dataReportPath, 'data encryption rotation'));

const tenantCount = Math.max(secrets.tenantCount, data.tenantCount);
const status =
  secrets.failedTenants > 0 ||
  secrets.failedTotal > 0 ||
  data.failedTenants > 0 ||
  data.failedTotal > 0
    ? 'fail'
    : 'pass';

const detailsParts = [
  `secrets_report=${path.relative(repoRoot, secretsReportPath)}`,
  `data_report=${path.relative(repoRoot, dataReportPath)}`,
  `data_scope=${data.scope || 'all'}`,
];
if (status === 'pass') {
  detailsParts.push('ok');
}

ensureAuditFile(auditAbsPath);
let auditSource = fs.readFileSync(auditAbsPath, 'utf8');
auditSource = updateLastUpdated(auditSource);

const row = `| ${maxIso(secrets.generatedAt, data.generatedAt)} | ${secrets.keyId} | ${data.keyId} | ${secrets.dryRun ? 'true' : 'false'} | ${data.dryRun ? 'true' : 'false'} | ${tenantCount} | ${secrets.failedTenants} | ${secrets.failedTotal} | ${data.failedTenants} | ${data.failedTotal} | ${status} | ${detailsParts.join('; ')} |`;
if (!auditSource.endsWith('\n')) {
  auditSource += '\n';
}
auditSource += `${row}\n`;
fs.writeFileSync(auditAbsPath, auditSource, 'utf8');

process.stdout.write(`Crypto-rotation audit entry written: ${auditRelPath}\n`);
process.stdout.write(`Status: ${status}\n`);

if (strict && status === 'fail') {
  process.exit(1);
}
