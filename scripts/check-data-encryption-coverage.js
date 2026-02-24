#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = process.cwd();

const domains = [
  {
    scope: 'workspace',
    codeFiles: ['apps/backend/src/modules/workspace/workspace.service.ts'],
    codePatterns: [/DataAtRestCrypto/, /encryptNotesRecord/, /__enc_payload_v1/],
    testFiles: ['apps/backend/src/modules/workspace/workspace.service.test.ts'],
    testPatterns: [
      /encrypts notes payload at rest/i,
      /encrypts non-notes workspace payload at rest/i,
    ],
  },
  {
    scope: 'finance',
    codeFiles: ['apps/backend/src/modules/finance/finance.service.ts'],
    codePatterns: [/DataAtRestCrypto/, /encryptFinancePayload/, /__enc_payload_v1/],
    testFiles: ['apps/backend/src/modules/finance/finance.service.test.ts'],
    testPatterns: [/stores encrypted payload/i],
  },
  {
    scope: 'settings',
    codeFiles: ['apps/backend/src/modules/settings/settings.service.ts'],
    codePatterns: [/DataAtRestCrypto/, /encryptSettingsPayload/, /__enc_payload_v1/],
    testFiles: ['apps/backend/src/modules/settings/settings.service.test.ts'],
    testPatterns: [/stores encrypted payload/i],
  },
  {
    scope: 'resources',
    codeFiles: ['apps/backend/src/modules/resources/resources.service.ts'],
    codePatterns: [/DataAtRestCrypto/, /encryptResourcePayload/, /__enc_payload_v1/],
    testFiles: ['apps/backend/src/modules/resources/resources.service.test.ts'],
    testPatterns: [/stores encrypted payload/i],
  },
  {
    scope: 'playbooks',
    codeFiles: ['apps/backend/src/modules/playbooks/playbooks.service.ts'],
    codePatterns: [/DataAtRestCrypto/, /encryptPlaybookPayload/, /__enc_payload_v1/],
    testFiles: ['apps/backend/src/modules/playbooks/playbooks.service.test.ts'],
    testPatterns: [/stores encrypted payload/i],
  },
  {
    scope: 'bots',
    codeFiles: ['apps/backend/src/modules/bots/bots.service.ts'],
    codePatterns: [/DataAtRestCrypto/, /__enc_payload_v1/, /encryptJson/],
    testFiles: ['apps/backend/src/modules/bots/bots.service.test.ts'],
    testPatterns: [/stores encrypted payload/i],
  },
  {
    scope: 'provisioning',
    codeFiles: [
      'apps/backend/src/modules/provisioning/provisioning.service.ts',
      'apps/backend/src/modules/provisioning/provisioning.repository.ts',
    ],
    codePatterns: [
      /DataAtRestCrypto/,
      /encryptProfilePayload|encryptTokenPayload/,
      /__enc_payload_v1/,
    ],
    testFiles: [
      'apps/backend/src/modules/provisioning/provisioning.service.test.ts',
      'apps/backend/src/modules/provisioning/provisioning.repository.test.ts',
    ],
    testPatterns: [/encrypted (profile|progress|token|payload)/i],
  },
  {
    scope: 'infra',
    codeFiles: ['apps/backend/src/modules/infra/infra.service.ts'],
    codePatterns: [/DataAtRestCrypto/, /encryptString/, /decryptString/],
    testFiles: ['apps/backend/src/modules/infra/infra.service.test.ts'],
    testPatterns: [/encrypted vm config content at rest/i],
  },
  {
    scope: 'vmops',
    codeFiles: ['apps/backend/src/modules/vm-ops/vm-ops.repository.ts'],
    codePatterns: [/DataAtRestCrypto/, /encryptJsonField/, /decryptJsonField/],
    testFiles: ['apps/backend/src/modules/vm-ops/vm-ops.service.test.ts'],
    testPatterns: [/tenant isolation/i, /reliability sweep/i],
  },
  {
    scope: 'theme',
    codeFiles: ['apps/backend/src/modules/theme-assets/theme-assets.service.ts'],
    codePatterns: [/DataAtRestCrypto/, /__enc_payload_v1/, /encryptJson/],
    testFiles: ['apps/backend/src/modules/theme-assets/theme-assets.service.test.ts'],
    testPatterns: [/stores encrypted payload/i],
  },
  {
    scope: 'license',
    codeFiles: ['apps/backend/src/modules/license/license.repository.ts'],
    codePatterns: [/DataAtRestCrypto/, /encryptLeasePayload/, /__enc_payload_v1/],
    testFiles: ['apps/backend/src/modules/license/license.repository.test.ts'],
    testPatterns: [/stores encrypted payload/i],
  },
  {
    scope: 'artifacts',
    codeFiles: ['apps/backend/src/modules/artifacts/artifacts.repository.ts'],
    codePatterns: [/DataAtRestCrypto/, /__enc_payload_v1/, /decryptRecord|encrypt/],
    testFiles: ['apps/backend/src/modules/artifacts/artifacts.repository.test.ts'],
    testPatterns: [/stores encrypted .*payload/i],
  },
];

const rotationRunnerPath = 'scripts/data-encryption-rotation-runner.js';
const rotationControllerPath =
  'apps/backend/src/modules/admin-data-encryption/admin-data-encryption.controller.ts';

function readFile(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`missing file: ${relativePath}`);
  }
  return fs.readFileSync(absolutePath, 'utf8');
}

function hasAnyPattern(source, patterns) {
  return patterns.some((pattern) => pattern.test(source));
}

function checkDomain(domain, runnerSource, controllerSource) {
  const issues = [];

  for (const relativePath of domain.codeFiles) {
    const source = readFile(relativePath);
    if (!hasAnyPattern(source, domain.codePatterns)) {
      issues.push(`${domain.scope}: code file lacks encryption markers (${relativePath})`);
    }
  }

  let hasEncryptionTestSignal = false;
  for (const relativePath of domain.testFiles) {
    const source = readFile(relativePath);
    if (hasAnyPattern(source, domain.testPatterns)) {
      hasEncryptionTestSignal = true;
    }
  }
  if (!hasEncryptionTestSignal) {
    issues.push(`${domain.scope}: tests lack encryption/coverage signal in declared test files`);
  }

  const endpointNeedle = `rotate-${domain.scope}-tenants`;
  if (!runnerSource.includes(endpointNeedle)) {
    issues.push(`${domain.scope}: missing runner endpoint coverage (${endpointNeedle})`);
  }
  if (!controllerSource.includes(`@Post('${endpointNeedle}')`)) {
    issues.push(`${domain.scope}: missing admin controller endpoint (${endpointNeedle})`);
  }

  return issues;
}

function main() {
  const runnerSource = readFile(rotationRunnerPath);
  const controllerSource = readFile(rotationControllerPath);

  const issues = [];
  for (const domain of domains) {
    issues.push(...checkDomain(domain, runnerSource, controllerSource));
  }

  const domainNames = domains.map((d) => d.scope).join(', ');
  if (issues.length > 0) {
    process.stderr.write('[check-data-encryption-coverage] FAIL\n');
    process.stderr.write(
      `[check-data-encryption-coverage] domains=${domains.length} (${domainNames})\n`,
    );
    for (const issue of issues) {
      process.stderr.write(`- ${issue}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(
    `[check-data-encryption-coverage] OK: validated ${domains.length} domains (${domainNames}) for code markers, tests, and rotation endpoint coverage\n`,
  );
}

try {
  main();
} catch (error) {
  process.stderr.write(
    `[check-data-encryption-coverage] FAIL ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
}
