#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = process.cwd();
const modulesRoot = path.join(repoRoot, 'apps', 'backend', 'src', 'modules');

const tenantModelClients = new Set([
  'agent',
  'agentCommand',
  'resourceItem',
  'workspaceItem',
  'financeOperation',
  'secretMeta',
  'secretBinding',
  'botEntity',
  'playbookItem',
  'settingsItem',
  'themeAssetItem',
  'licenseLeaseItem',
  'artifactReleaseItem',
  'artifactAssignmentItem',
  'infraVmItem',
  'infraVmConfigItem',
  'provisioningProfileItem',
  'provisioningTokenItem',
  'provisioningProgressItem',
  'tenantProjectRollout',
  'tenantAccountAccess',
]);

const allowFiles = new Set([
  path.join('apps', 'backend', 'src', 'modules', 'db', 'prisma.service.ts'),
]);

function walk(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
      continue;
    }
    if (!entry.name.endsWith('.ts')) continue;
    if (entry.name.endsWith('.test.ts')) continue;
    out.push(full);
  }
  return out;
}

function isGuarded(lines, index) {
  const from = Math.max(0, index - 40);
  const context = lines.slice(from, index + 1).join('\n');
  return (
    context.includes('.withTenantContext(') ||
    context.includes('.withSystemContext(') ||
    context.includes('tx.')
  );
}

function checkFile(absPath) {
  const rel = path.relative(repoRoot, absPath);
  if (allowFiles.has(rel)) return [];

  const text = fs.readFileSync(absPath, 'utf8');
  const lines = text.split(/\r?\n/);
  const violations = [];
  const pattern = /this\.prisma\.(\w+)\./g;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    let match = pattern.exec(line);
    while (match) {
      const model = match[1];
      if (tenantModelClients.has(model) && !isGuarded(lines, i)) {
        violations.push({
          rel,
          line: i + 1,
          model,
          source: line.trim(),
        });
      }
      match = pattern.exec(line);
    }
    pattern.lastIndex = 0;
  }

  return violations;
}

function main() {
  if (!fs.existsSync(modulesRoot)) {
    console.error(`[check-backend-tenant-context] modules root not found: ${modulesRoot}`);
    process.exit(1);
  }

  const files = walk(modulesRoot);
  const violations = files.flatMap((file) => checkFile(file));

  if (violations.length === 0) {
    console.log('[check-backend-tenant-context] OK: no unguarded tenant Prisma access found');
    return;
  }

  console.error('[check-backend-tenant-context] FAIL: unguarded tenant Prisma access detected');
  for (const violation of violations) {
    console.error(
      ` - ${violation.rel}:${violation.line} model=${violation.model} :: ${violation.source}`,
    );
  }
  process.exit(1);
}

main();
