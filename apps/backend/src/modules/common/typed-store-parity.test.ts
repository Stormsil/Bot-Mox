export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const parityScript = require(
  path.resolve(__dirname, '../../../../../scripts/typed-store-parity-report.js'),
);

test('parity report marks payload mismatch with domain and entity identifiers', () => {
  const report = parityScript.buildParityReport({
    threshold: 0,
    tenantId: null,
    includeMatchRows: false,
    domainSnapshots: [
      {
        domain: 'finance',
        legacyRows: [
          {
            tenantId: 'tenant-a',
            entityId: 'op-1',
            payload: { amount: 10, currency: 'USD' },
          },
        ],
        typedRows: [
          {
            tenantId: 'tenant-a',
            entityId: 'op-1',
            payload: { amount: 999, currency: 'USD' },
          },
        ],
      },
    ],
  });

  assert.equal(report.ok, false);
  assert.equal(report.totalMismatches, 1);
  assert.deepEqual(report.failedDomains, ['finance']);

  const mismatch = report.domains[0].mismatches[0];
  assert.equal(mismatch.type, 'payload-mismatch');
  assert.equal(mismatch.domain, 'finance');
  assert.equal(mismatch.tenantId, 'tenant-a');
  assert.equal(mismatch.entityId, 'op-1');
});

test('parity report passes when all rows are equal', () => {
  const report = parityScript.buildParityReport({
    threshold: 0,
    tenantId: null,
    includeMatchRows: false,
    domainSnapshots: [
      {
        domain: 'bots',
        legacyRows: [
          {
            tenantId: 'tenant-a',
            entityId: 'bot-1',
            payload: { id: 'bot-1', name: 'Bot' },
          },
        ],
        typedRows: [
          {
            tenantId: 'tenant-a',
            entityId: 'bot-1',
            payload: { id: 'bot-1', name: 'Bot' },
          },
        ],
      },
    ],
  });

  assert.equal(report.ok, true);
  assert.equal(report.totalMismatches, 0);
  assert.deepEqual(report.failedDomains, []);
});
