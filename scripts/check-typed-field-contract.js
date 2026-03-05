#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = process.cwd();
const args = new Set(process.argv.slice(2));

const CONTRACT_PATH = 'configs/typed-field-canonical-contract.json';
const ALLOWLIST_PATH = 'configs/json-technical-allowlist.json';
const REQUIRED_DOMAINS = [
  'finance',
  'bots',
  'resources',
  'workspace',
  'playbooks',
  'settings',
  'theme-assets',
];

function readJson(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`missing file: ${relativePath}`);
  }
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}

function normalizeStringList(values) {
  if (!Array.isArray(values)) {
    return null;
  }
  const normalized = [];
  for (const value of values) {
    if (typeof value !== 'string') {
      return null;
    }
    const next = value.trim();
    if (!next) {
      return null;
    }
    normalized.push(next);
  }
  return normalized;
}

function unique(values) {
  return [...new Set(values)];
}

function pushMissingDomainsIssues(scopedDomains, issues, sourceName) {
  const set = new Set(scopedDomains);
  for (const domain of REQUIRED_DOMAINS) {
    if (!set.has(domain)) {
      issues.push(`${sourceName}: missing required scoped domain "${domain}"`);
    }
  }
}

function assertDomainMapRecord(record, key, issues) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    issues.push(`${key} must be an object`);
    return;
  }
  for (const domain of REQUIRED_DOMAINS) {
    const normalized = normalizeStringList(record[domain]);
    if (!normalized) {
      issues.push(`${key}.${domain} must be an array of non-empty strings`);
      continue;
    }
    if (normalized.length === 0) {
      issues.push(`${key}.${domain} must not be empty`);
      continue;
    }
    if (unique(normalized).length !== normalized.length) {
      issues.push(`${key}.${domain} must not contain duplicates`);
    }
  }
}

function hasOneOf(set, values) {
  for (const value of values) {
    if (set.has(value)) {
      return true;
    }
  }
  return false;
}

function applyNegativeFixture(contract, allowlist) {
  const nextContract = JSON.parse(JSON.stringify(contract));
  const nextAllowlist = JSON.parse(JSON.stringify(allowlist));

  nextContract.typedFieldMapByDomain.settings = [];
  const financeAllowlist = Array.isArray(nextAllowlist.technicalJsonAllowlistByDomain?.finance)
    ? nextAllowlist.technicalJsonAllowlistByDomain.finance
    : [];
  financeAllowlist.push('page');
  nextAllowlist.technicalJsonAllowlistByDomain.finance = financeAllowlist;

  return { contract: nextContract, allowlist: nextAllowlist };
}

function main() {
  const fixtureMode = args.has('--fixture-mode') || args.has('--fixture');

  let contract = readJson(CONTRACT_PATH);
  let allowlist = readJson(ALLOWLIST_PATH);
  if (fixtureMode) {
    ({ contract, allowlist } = applyNegativeFixture(contract, allowlist));
  }

  const issues = [];

  const contractScopedDomains = normalizeStringList(contract.scopedDomains);
  if (!contractScopedDomains) {
    issues.push('contract.scopedDomains must be an array of non-empty strings');
  } else {
    pushMissingDomainsIssues(contractScopedDomains, issues, 'contract.scopedDomains');
  }

  const allowlistScopedDomains = normalizeStringList(allowlist.scopedDomains);
  if (!allowlistScopedDomains) {
    issues.push('allowlist.scopedDomains must be an array of non-empty strings');
  } else {
    pushMissingDomainsIssues(allowlistScopedDomains, issues, 'allowlist.scopedDomains');
  }

  assertDomainMapRecord(contract.typedFieldMapByDomain, 'contract.typedFieldMapByDomain', issues);
  assertDomainMapRecord(
    allowlist.technicalJsonAllowlistByDomain,
    'allowlist.technicalJsonAllowlistByDomain',
    issues,
  );

  const prohibitedBusinessKeys = normalizeStringList(allowlist.prohibitedBusinessKeys);
  if (!prohibitedBusinessKeys) {
    issues.push('allowlist.prohibitedBusinessKeys must be an array of non-empty strings');
  }

  if (prohibitedBusinessKeys) {
    const prohibited = new Set(prohibitedBusinessKeys);
    for (const domain of REQUIRED_DOMAINS) {
      const allowed = normalizeStringList(allowlist.technicalJsonAllowlistByDomain?.[domain]) || [];
      for (const key of allowed) {
        if (prohibited.has(key)) {
          issues.push(
            `allowlist.technicalJsonAllowlistByDomain.${domain} includes prohibited business key "${key}"`,
          );
        }
      }
    }
  }

  const financeFields = new Set(normalizeStringList(contract.typedFieldMapByDomain?.finance) || []);
  const financeConcepts = [
    ['type', ['type', 'operation_type']],
    ['category', ['category', 'operation_category']],
    ['amount', ['amount', 'operation_amount']],
    ['currency', ['currency', 'currency_code']],
    ['operationAt', ['operation_at', 'operationAt', 'date', 'created_at']],
    ['status', ['status', 'operation_status']],
  ];
  for (const [concept, aliases] of financeConcepts) {
    if (!hasOneOf(financeFields, aliases)) {
      issues.push(`contract.finance is missing required typed concept: ${concept}`);
    }
  }

  if (issues.length > 0) {
    process.stderr.write('[check-typed-field-contract] FAIL\n');
    for (const issue of issues) {
      process.stderr.write(`- ${issue}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(
    `[check-typed-field-contract] OK: domains=${REQUIRED_DOMAINS.length}, fixture_mode=${fixtureMode ? 'on' : 'off'}\n`,
  );
}

try {
  main();
} catch (error) {
  process.stderr.write(
    `[check-typed-field-contract] FAIL ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
}
