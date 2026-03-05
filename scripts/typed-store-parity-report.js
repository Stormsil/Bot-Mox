#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const SUPPORTED_DOMAINS = [
  'bots',
  'finance',
  'resources',
  'workspace',
  'playbooks',
  'settings',
  'theme-assets',
];

function parseBoolean(value, fallback) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') {
    return true;
  }
  if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') {
    return false;
  }
  return fallback;
}

function parseArgs(argv) {
  const args = {
    json: false,
    threshold: Number.parseInt(
      String(process.env.BOTMOX_TYPED_STORE_PARITY_MAX_MISMATCHES || '0'),
      10,
    ),
    tenantId: String(process.env.BOTMOX_TYPED_STORE_PARITY_TENANT || '').trim() || null,
    reportFile: String(process.env.BOTMOX_TYPED_STORE_PARITY_REPORT_PATH || '').trim() || null,
    fixtureFile: null,
    domains: [...SUPPORTED_DOMAINS],
    includeMatchRows: parseBoolean(process.env.BOTMOX_TYPED_STORE_PARITY_INCLUDE_MATCH_ROWS, false),
  };

  for (const raw of argv) {
    if (raw === '--json') {
      args.json = true;
      continue;
    }
    if (raw.startsWith('--threshold=')) {
      const parsed = Number.parseInt(raw.slice('--threshold='.length), 10);
      if (Number.isFinite(parsed) && parsed >= 0) {
        args.threshold = parsed;
      }
      continue;
    }
    if (raw.startsWith('--tenant=')) {
      const tenantId = String(raw.slice('--tenant='.length)).trim();
      args.tenantId = tenantId || null;
      continue;
    }
    if (raw.startsWith('--report-file=')) {
      const filePath = String(raw.slice('--report-file='.length)).trim();
      args.reportFile = filePath || null;
      continue;
    }
    if (raw.startsWith('--fixture=')) {
      const filePath = String(raw.slice('--fixture='.length)).trim();
      args.fixtureFile = filePath || null;
      continue;
    }
    if (raw.startsWith('--domains=')) {
      const domains = String(raw.slice('--domains='.length))
        .split(',')
        .map((domain) => domain.trim().toLowerCase())
        .filter(Boolean);
      if (domains.length > 0) {
        args.domains = [...new Set(domains)];
      }
      continue;
    }
    if (raw === '--include-match-rows') {
      args.includeMatchRows = true;
    }
  }

  if (!Number.isFinite(args.threshold) || args.threshold < 0) {
    args.threshold = 0;
  }

  const unsupported = args.domains.filter((domain) => !SUPPORTED_DOMAINS.includes(domain));
  if (unsupported.length > 0) {
    throw new Error(
      `Unsupported domain(s): ${unsupported.join(', ')}. Supported: ${SUPPORTED_DOMAINS.join(', ')}`,
    );
  }

  return args;
}

function sortedClone(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => sortedClone(entry));
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = sortedClone(value[key]);
    }
    return out;
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(sortedClone(value));
}

function rowKey(row) {
  return `${String(row.tenantId)}::${String(row.entityId)}`;
}

function normalizeRows(rows) {
  return rows.map((row) => ({
    tenantId: String(row.tenantId || '').trim(),
    entityId: String(row.entityId || '').trim(),
    payload: row.payload ?? null,
  }));
}

function buildDomainParityResult(domain, legacyRows, typedRows, includeMatchRows) {
  const normalizedLegacy = normalizeRows(legacyRows);
  const normalizedTyped = normalizeRows(typedRows);

  const legacyMap = new Map();
  for (const row of normalizedLegacy) {
    legacyMap.set(rowKey(row), row);
  }

  const typedMap = new Map();
  for (const row of normalizedTyped) {
    typedMap.set(rowKey(row), row);
  }

  const keys = [...new Set([...legacyMap.keys(), ...typedMap.keys()])].sort();
  const mismatches = [];
  const matches = [];

  for (const key of keys) {
    const legacy = legacyMap.get(key) || null;
    const typed = typedMap.get(key) || null;

    if (!legacy && typed) {
      mismatches.push({
        type: 'missing-in-legacy',
        domain,
        tenantId: typed.tenantId,
        entityId: typed.entityId,
      });
      continue;
    }

    if (legacy && !typed) {
      mismatches.push({
        type: 'missing-in-typed',
        domain,
        tenantId: legacy.tenantId,
        entityId: legacy.entityId,
      });
      continue;
    }

    const legacyFingerprint = stableStringify(legacy.payload);
    const typedFingerprint = stableStringify(typed.payload);
    if (legacyFingerprint !== typedFingerprint) {
      mismatches.push({
        type: 'payload-mismatch',
        domain,
        tenantId: legacy.tenantId,
        entityId: legacy.entityId,
        legacyPayload: legacy.payload,
        typedPayload: typed.payload,
      });
      continue;
    }

    if (includeMatchRows) {
      matches.push({
        domain,
        tenantId: legacy.tenantId,
        entityId: legacy.entityId,
      });
    }
  }

  return {
    domain,
    comparedRows: keys.length,
    legacyRows: normalizedLegacy.length,
    typedRows: normalizedTyped.length,
    mismatchCount: mismatches.length,
    mismatches,
    matches,
  };
}

function buildParityReport(options) {
  const threshold = Number.isFinite(options.threshold)
    ? Math.max(0, Math.trunc(options.threshold))
    : 0;
  const domainResults = options.domainSnapshots.map((snapshot) =>
    buildDomainParityResult(
      snapshot.domain,
      snapshot.legacyRows || [],
      snapshot.typedRows || [],
      Boolean(options.includeMatchRows),
    ),
  );

  const totalMismatches = domainResults.reduce((sum, domain) => sum + domain.mismatchCount, 0);
  const failedDomains = domainResults
    .filter((domain) => domain.mismatchCount > threshold)
    .map((domain) => domain.domain);

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    threshold,
    tenantFilter: options.tenantId || null,
    domains: domainResults,
    totalMismatches,
    failedDomains,
    ok: failedDomains.length === 0,
  };
}

async function loadDomainSnapshotsFromDb(options) {
  let PrismaClient;
  try {
    ({ PrismaClient } = require('@prisma/client'));
  } catch {
    const backendRequire = createRequire(path.resolve(process.cwd(), 'apps/backend/package.json'));
    ({ PrismaClient } = backendRequire('@prisma/client'));
  }
  const prisma = new PrismaClient();

  const tenantFilterSql = options.tenantId
    ? (tableAlias) => ` and ${tableAlias}.tenant_id = $1`
    : () => '';
  const params = options.tenantId ? [options.tenantId] : [];

  const query = async (sqlText) => {
    const rows = await prisma.$queryRawUnsafe(sqlText, ...params);
    return Array.isArray(rows) ? rows : [];
  };

  try {
    const snapshots = [];

    if (options.domains.includes('bots')) {
      snapshots.push({
        domain: 'bots',
        legacyRows: await query(
          `select tenant_id as "tenantId", id as "entityId", payload from public.bot_entities e where 1=1${tenantFilterSql('e')}`,
        ),
        typedRows: await query(
          `select tenant_id as "tenantId", id as "entityId", data as payload from public.bots t where 1=1${tenantFilterSql('t')}`,
        ),
      });
    }

    if (options.domains.includes('finance')) {
      snapshots.push({
        domain: 'finance',
        legacyRows: await query(
          `select tenant_id as "tenantId", id as "entityId", payload from public.finance_operations e where 1=1${tenantFilterSql('e')}`,
        ),
        typedRows: await query(
          `select tenant_id as "tenantId", id as "entityId", data as payload from public.finance_operations t where 1=1${tenantFilterSql('t')}`,
        ),
      });
    }

    if (options.domains.includes('resources')) {
      snapshots.push({
        domain: 'resources',
        legacyRows: await query(
          `select tenant_id as "tenantId", kind || ':' || id as "entityId", payload
           from public.resource_items e
           where kind in ('licenses', 'proxies', 'subscriptions')${tenantFilterSql('e')}`,
        ),
        typedRows: await query(
          `select tenant_id as "tenantId", 'licenses:' || id as "entityId", data as payload from public.resources_licenses t where 1=1${tenantFilterSql('t')}
           union all
           select tenant_id as "tenantId", 'proxies:' || id as "entityId", data as payload from public.resources_proxies t where 1=1${tenantFilterSql('t')}
           union all
           select tenant_id as "tenantId", 'subscriptions:' || id as "entityId", data as payload from public.resources_subscriptions t where 1=1${tenantFilterSql('t')}`,
        ),
      });
    }

    if (options.domains.includes('workspace')) {
      snapshots.push({
        domain: 'workspace',
        legacyRows: await query(
          `select tenant_id as "tenantId", kind || ':' || id as "entityId", payload
           from public.workspace_items e
           where kind in ('notes', 'calendar', 'kanban')${tenantFilterSql('e')}`,
        ),
        typedRows: await query(
          `select tenant_id as "tenantId", 'notes:' || id as "entityId", data as payload from public.workspace_notes t where 1=1${tenantFilterSql('t')}
           union all
           select tenant_id as "tenantId", 'calendar:' || id as "entityId", data as payload from public.workspace_calendar_events t where 1=1${tenantFilterSql('t')}
           union all
           select tenant_id as "tenantId", 'kanban:' || id as "entityId", data as payload from public.workspace_kanban_tasks t where 1=1${tenantFilterSql('t')}`,
        ),
      });
    }

    if (options.domains.includes('playbooks')) {
      snapshots.push({
        domain: 'playbooks',
        legacyRows: await query(
          `select tenant_id as "tenantId", id as "entityId", payload from public.playbook_items e where 1=1${tenantFilterSql('e')}`,
        ),
        typedRows: await query(
          `select tenant_id as "tenantId", id as "entityId", data as payload from public.playbooks t where 1=1${tenantFilterSql('t')}`,
        ),
      });
    }

    if (options.domains.includes('settings')) {
      snapshots.push({
        domain: 'settings',
        legacyRows: await query(
          `select tenant_id as "tenantId", path as "entityId", payload from public.settings_items e where 1=1${tenantFilterSql('e')}`,
        ),
        typedRows: await query(
          `select tenant_id as "tenantId", kv.key as "entityId", kv.value as payload
           from public.app_settings t
           cross join lateral jsonb_each(t.data) as kv(key, value)
           where 1=1${tenantFilterSql('t')}`,
        ),
      });
    }

    if (options.domains.includes('theme-assets')) {
      snapshots.push({
        domain: 'theme-assets',
        legacyRows: await query(
          `select tenant_id as "tenantId", id as "entityId", payload from public.theme_asset_items e where 1=1${tenantFilterSql('e')}`,
        ),
        typedRows: await query(
          `select tenant_id as "tenantId", id as "entityId", data as payload from public.theme_background_assets t where 1=1${tenantFilterSql('t')}`,
        ),
      });
    }

    return snapshots;
  } finally {
    await prisma.$disconnect();
  }
}

function loadDomainSnapshotsFromFixture(fixtureFile, selectedDomains) {
  const absolutePath = path.isAbsolute(fixtureFile)
    ? fixtureFile
    : path.resolve(process.cwd(), fixtureFile);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Fixture file not found: ${absolutePath}`);
  }

  const raw = fs.readFileSync(absolutePath, 'utf8');
  const parsed = JSON.parse(raw);
  const snapshots = Array.isArray(parsed?.domainSnapshots) ? parsed.domainSnapshots : [];

  return snapshots
    .map((snapshot) => ({
      domain: String(snapshot?.domain || '')
        .trim()
        .toLowerCase(),
      legacyRows: Array.isArray(snapshot?.legacyRows) ? snapshot.legacyRows : [],
      typedRows: Array.isArray(snapshot?.typedRows) ? snapshot.typedRows : [],
    }))
    .filter((snapshot) => snapshot.domain && selectedDomains.includes(snapshot.domain));
}

function printHumanReport(report) {
  process.stdout.write(
    `[typed-store-parity] ${report.ok ? 'PASS' : 'FAIL'} threshold=${report.threshold} total_mismatches=${report.totalMismatches} domains=${report.domains.length}\n`,
  );

  for (const domain of report.domains) {
    const status = domain.mismatchCount > report.threshold ? 'FAIL' : 'PASS';
    process.stdout.write(
      `- ${status}: ${domain.domain} compared=${domain.comparedRows} legacy_rows=${domain.legacyRows} typed_rows=${domain.typedRows} mismatches=${domain.mismatchCount}\n`,
    );
    if (domain.mismatches.length > 0) {
      for (const mismatch of domain.mismatches) {
        process.stdout.write(
          `  * ${mismatch.type} domain=${mismatch.domain} tenant=${mismatch.tenantId} entity=${mismatch.entityId}\n`,
        );
      }
    }
  }
}

function writeReportFile(reportFile, report) {
  if (!reportFile) {
    return;
  }
  const absolutePath = path.isAbsolute(reportFile)
    ? reportFile
    : path.resolve(process.cwd(), reportFile);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(
    `[typed-store-parity] report written: ${path.relative(process.cwd(), absolutePath)}\n`,
  );
}

async function runCli(argv) {
  const options = parseArgs(argv);
  const domainSnapshots = options.fixtureFile
    ? loadDomainSnapshotsFromFixture(options.fixtureFile, options.domains)
    : await loadDomainSnapshotsFromDb(options);

  const report = buildParityReport({
    threshold: options.threshold,
    tenantId: options.tenantId,
    includeMatchRows: options.includeMatchRows,
    domainSnapshots,
  });

  if (!options.json) {
    printHumanReport(report);
  }

  writeReportFile(options.reportFile, report);

  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  }

  if (!report.ok) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  runCli(process.argv.slice(2)).catch((error) => {
    process.stderr.write(
      `[typed-store-parity] FAIL ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  });
}

module.exports = {
  SUPPORTED_DOMAINS,
  buildParityReport,
  buildDomainParityResult,
  parseArgs,
  runCli,
};
