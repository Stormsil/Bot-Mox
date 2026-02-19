#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = process.cwd();
const routesDir = path.join(repoRoot, 'proxy-server', 'src', 'modules', 'v1');

function listRouteFiles(dirPath) {
  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.routes.js'))
    .map((entry) => path.join(dirPath, entry.name))
    .sort();
}

function hasBoundaryAccess(text) {
  return /req\.(body|query|params)/.test(text);
}

function usesContractSchemas(text) {
  return /contracts\/schemas/.test(text);
}

function relative(filePath) {
  return path.relative(repoRoot, filePath).replace(/\\/g, '/');
}

function main() {
  if (!fs.existsSync(routesDir)) {
    process.stderr.write('Missing proxy-server/src/modules/v1 directory.\n');
    process.exit(1);
  }

  const allowedLocalSchemaRoutes = new Set([
    'client-logs.routes.js', // local schema is intentional for frontend log payload redaction limits
    'otel.routes.js', // OTLP raw passthrough endpoint
  ]);

  const files = listRouteFiles(routesDir);
  const violations = [];
  let checked = 0;

  for (const filePath of files) {
    const text = fs.readFileSync(filePath, 'utf8');
    if (!hasBoundaryAccess(text)) {
      continue;
    }
    checked += 1;

    const fileName = path.basename(filePath);
    if (allowedLocalSchemaRoutes.has(fileName)) {
      continue;
    }

    if (!usesContractSchemas(text)) {
      violations.push(
        `${relative(filePath)}: boundary route does not import centralized contracts/schemas`,
      );
    }
  }

  process.stdout.write('Legacy contract-adapter gate report\n');
  process.stdout.write('===================================\n');
  process.stdout.write(`Route files with boundary access checked: ${checked}\n`);
  process.stdout.write(`Violations: ${violations.length}\n`);

  if (violations.length > 0) {
    process.stderr.write('\nDetected missing legacy contract adapter wiring:\n');
    for (const violation of violations) {
      process.stderr.write(`- ${violation}\n`);
    }
    process.exit(2);
  }

  process.stdout.write(
    'All checked legacy boundary routes are wired to centralized contract schemas.\n',
  );
}

main();
