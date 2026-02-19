#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = process.cwd();

const budgets = [
  {
    label: 'frontend-hotspots',
    roots: ['apps/frontend/src'],
    include: ['.ts', '.tsx', '.js', '.jsx'],
    warn: 350,
    fail: 500,
    critical: 700,
    // Existing oversized files are temporarily capped to block regressions
    // while decomposition waves are executed.
    grandfatheredCaps: {
      'apps/frontend/src/hooks/vm/queue/processor.ts': 860,
      'apps/frontend/src/services/apiClient.ts': 760,
      'apps/frontend/src/utils/scheduleUtils.ts': 920,
      'apps/frontend/src/services/vmService.ts': 760,
      'apps/frontend/src/services/vmOpsService.ts': 720,
      'apps/frontend/src/pages/settings/ThemeSettingsPanel.tsx': 650,
      'apps/frontend/src/pages/settings/useThemeSettings.ts': 630,
      'apps/frontend/src/components/layout/ResourceTree.tsx': 530,
      'apps/frontend/src/hooks/useVMLog.ts': 580,
      'apps/frontend/src/services/notesService.ts': 660,
      'apps/frontend/src/utils/vm/generateSmbios.ts': 640,
    },
    ignoreDirs: new Set(['node_modules', 'dist', '.turbo', 'test-results', 'playwright-report']),
  },
  {
    label: 'contract-hotspots',
    roots: ['packages/api-contract/src'],
    include: ['.ts', '.tsx', '.js', '.jsx'],
    warn: 350,
    fail: 500,
    critical: 700,
    grandfatheredCaps: {
      'packages/api-contract/src/contract.ts': 1900,
      'packages/api-contract/src/schemas.ts': 1300,
    },
    ignoreDirs: new Set(['node_modules', 'dist', '.turbo']),
  },
];

function walk(dir, ignoreDirs, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (ignoreDirs.has(entry.name)) {
        continue;
      }
      walk(abs, ignoreDirs, files);
      continue;
    }

    if (entry.isFile()) {
      files.push(abs);
    }
  }
  return files;
}

let hasFail = false;

for (const budget of budgets) {
  const warnings = [];
  const failures = [];

  for (const root of budget.roots) {
    const absRoot = path.join(repoRoot, root);
    if (!fs.existsSync(absRoot)) {
      continue;
    }

    const files = walk(absRoot, budget.ignoreDirs);
    for (const absFile of files) {
      const ext = path.extname(absFile).toLowerCase();
      if (!budget.include.includes(ext)) {
        continue;
      }

      const source = fs.readFileSync(absFile, 'utf8');
      const lines = source.split('\n').length;
      const rel = path.relative(repoRoot, absFile).split(path.sep).join('/');
      const grandfatheredCap = budget.grandfatheredCaps?.[rel];

      if (grandfatheredCap != null) {
        if (lines > grandfatheredCap) {
          failures.push(`${rel} -> ${lines} lines (grandfathered cap > ${grandfatheredCap})`);
        } else if (lines > budget.warn) {
          warnings.push(`${rel} -> ${lines} lines (grandfathered, target reduction required)`);
        }
        continue;
      }

      if (lines > budget.critical) {
        failures.push(`${rel} -> ${lines} lines (critical > ${budget.critical})`);
      } else if (lines > budget.fail) {
        failures.push(`${rel} -> ${lines} lines (fail > ${budget.fail})`);
      } else if (lines > budget.warn) {
        warnings.push(`${rel} -> ${lines} lines (warn > ${budget.warn})`);
      }
    }
  }

  if (warnings.length > 0) {
    process.stdout.write(`[${budget.label}] warnings:\n`);
    for (const warning of warnings) {
      process.stdout.write(`- ${warning}\n`);
    }
  }

  if (failures.length > 0) {
    hasFail = true;
    process.stderr.write(`[${budget.label}] failures:\n`);
    for (const failure of failures) {
      process.stderr.write(`- ${failure}\n`);
    }
  }
}

if (hasFail) {
  process.exit(1);
}

process.stdout.write('File size budget check passed.\n');
