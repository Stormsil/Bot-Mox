export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { resolveTypedStoreMigrationMode } = require('./typed-store-migration-mode.ts');

function buildEnv(overrides = {}) {
  return {
    BOTMOX_TYPED_STORE_DUAL_WRITE: 'true',
    BOTMOX_TYPED_STORE_PARITY_GATE: 'true',
    BOTMOX_TYPED_STORE_READ_PRECEDENCE: 'legacy-first',
    ...overrides,
  };
}

function writeReportFile(report: Record<string, unknown>) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'typed-store-parity-'));
  const reportPath = path.join(tempDir, 'report.json');
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return {
    reportPath,
    cleanup: () => fs.rmSync(tempDir, { recursive: true, force: true }),
  };
}

test('typed-first is blocked when parity report has mismatches above threshold', () => {
  const { reportPath, cleanup } = writeReportFile({
    threshold: 0,
    domains: [{ domain: 'bots', mismatchCount: 1 }],
  });

  try {
    const mode = resolveTypedStoreMigrationMode({
      env: buildEnv({
        BOTMOX_BOTS_READ_PRECEDENCE: 'typed-first',
        BOTMOX_TYPED_STORE_PARITY_REPORT_PATH: reportPath,
      }),
      readPrecedenceOverrideEnvName: 'BOTMOX_BOTS_READ_PRECEDENCE',
      dualWriteOverrideEnvName: 'BOTMOX_BOTS_DUAL_WRITE',
    });

    assert.equal(mode.readPrecedence, 'legacy-first');
    assert.match(String(mode.cutoverBlockedReason || ''), /mismatches 1 exceed threshold 0/);
  } finally {
    cleanup();
  }
});

test('typed-first is allowed when parity report passes for domain', () => {
  const { reportPath, cleanup } = writeReportFile({
    threshold: 0,
    domains: [{ domain: 'workspace', mismatchCount: 0 }],
  });

  try {
    const mode = resolveTypedStoreMigrationMode({
      env: buildEnv({
        BOTMOX_WORKSPACE_READ_PRECEDENCE: 'typed-first',
        BOTMOX_TYPED_STORE_PARITY_REPORT_PATH: reportPath,
      }),
      readPrecedenceOverrideEnvName: 'BOTMOX_WORKSPACE_READ_PRECEDENCE',
      dualWriteOverrideEnvName: 'BOTMOX_WORKSPACE_DUAL_WRITE',
    });

    assert.equal(mode.readPrecedence, 'typed-first');
    assert.equal(mode.cutoverBlockedReason, undefined);
  } finally {
    cleanup();
  }
});

test('rollback to legacy-first is deterministic via existing precedence flags', () => {
  const mode = resolveTypedStoreMigrationMode({
    env: buildEnv({
      BOTMOX_TYPED_STORE_READ_PRECEDENCE: 'typed-first',
      BOTMOX_BOTS_READ_PRECEDENCE: 'legacy-first',
      BOTMOX_TYPED_STORE_PARITY_STATUS: 'pass',
    }),
    readPrecedenceOverrideEnvName: 'BOTMOX_BOTS_READ_PRECEDENCE',
    dualWriteOverrideEnvName: 'BOTMOX_BOTS_DUAL_WRITE',
  });

  assert.equal(mode.readPrecedence, 'legacy-first');
});
