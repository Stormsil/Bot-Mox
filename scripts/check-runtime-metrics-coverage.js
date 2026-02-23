#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = process.cwd();

const checks = [
  {
    file: 'apps/backend/src/modules/observability/runtime-metrics.service.ts',
    patterns: [
      /recordHttpStatus\s*\(/,
      /auth\.failures\.401/,
      /auth\.failures\.403/,
      /http\.failures\.5xx/,
      /onSseOpened\s*\(/,
      /onSseClosed\s*\(/,
      /onWsOpened\s*\(/,
      /onWsClosed\s*\(/,
      /onWsRejected\s*\(/,
      /ws\.rejected\./,
    ],
    label: 'runtime metrics core counters',
  },
  {
    file: 'apps/backend/src/modules/common/http-error-envelope.filter.ts',
    patterns: [/RuntimeMetricsService/, /recordHttpStatus\(\{\s*statusCode/s],
    label: 'http error envelope -> metrics',
  },
  {
    file: 'apps/backend/src/modules/agents/agents-ws-server.ts',
    patterns: [
      /runtimeMetricsService\?\.onWsRejected\('unauthorized'\)/,
      /runtimeMetricsService\?\.onWsOpened\(\)/,
      /runtimeMetricsService\?\.onWsClosed\(\)/,
    ],
    label: 'agents ws -> metrics',
  },
  {
    file: 'apps/backend/src/modules/vm-ops/vm-ops.controller.ts',
    patterns: [/RuntimeMetricsService/, /onSseOpened\(\)/, /onSseClosed\(\)/],
    label: 'vm-ops sse -> metrics',
  },
  {
    file: 'apps/backend/src/main.ts',
    patterns: [/RuntimeMetricsService/, /new HttpErrorEnvelopeFilter\(runtimeMetricsService\)/],
    label: 'app bootstrap filter wiring',
  },
  {
    file: 'apps/backend/src/modules/observability/observability.controller.ts',
    patterns: [
      /diag\/runtime-metrics/,
      /enforceAdminRateLimit/,
      /runtimeMetricsService\.snapshot\(\)/,
    ],
    label: 'admin diagnostics runtime metrics endpoint',
  },
];

const testChecks = [
  {
    file: 'apps/backend/src/modules/observability/observability.controller.test.ts',
    patterns: [/runtime metrics snapshot/i, /admin role/i],
    label: 'observability controller runtime metrics tests',
  },
  {
    file: 'apps/backend/src/modules/agents/agents-ws-server.test.ts',
    patterns: [/rejects unauthorized handshake/i, /heartbeat updates/i],
    label: 'agents ws tests exercising ws lifecycle',
  },
  {
    file: 'apps/backend/src/modules/vm-ops/vm-ops.ws.integration.test.ts',
    patterns: [/ws lifecycle/i, /tenant isolation/i],
    label: 'vm-ops ws integration tests',
  },
];

function read(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`missing file: ${relativePath}`);
  }
  return fs.readFileSync(absolutePath, 'utf8');
}

function ensurePatterns(source, patterns, contextLabel, file, issues) {
  for (const pattern of patterns) {
    if (!pattern.test(source)) {
      issues.push(`${contextLabel}: missing pattern ${String(pattern)} in ${file}`);
    }
  }
}

function main() {
  const issues = [];

  for (const check of checks) {
    const source = read(check.file);
    ensurePatterns(source, check.patterns, check.label, check.file, issues);
  }

  for (const check of testChecks) {
    const source = read(check.file);
    const hasAny = check.patterns.some((pattern) => pattern.test(source));
    if (!hasAny) {
      issues.push(`${check.label}: no expected test signal found in ${check.file}`);
    }
  }

  if (issues.length > 0) {
    process.stderr.write('[check-runtime-metrics-coverage] FAIL\n');
    for (const issue of issues) {
      process.stderr.write(`- ${issue}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(
    '[check-runtime-metrics-coverage] OK: runtime metrics instrumentation and test signals are present for http/auth/ws/sse diagnostics\n',
  );
}

try {
  main();
} catch (error) {
  process.stderr.write(
    `[check-runtime-metrics-coverage] FAIL ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
}
