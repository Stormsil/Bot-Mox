export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { HealthController } = require('./health.controller.ts');

test('HealthController summary returns expected backend marker', () => {
  const controller = new HealthController();
  const result = controller.summary();

  assert.equal(result.success, true);
  assert.equal(result.data.service, 'botmox-api');
  assert.equal(result.data.data_backend, 'supabase');
  assert.equal(typeof result.data.timestamp, 'string');
});

test('HealthController live/ready return expected status markers', () => {
  const controller = new HealthController();
  const live = controller.live();
  const ready = controller.ready();

  assert.equal(live.success, true);
  assert.equal(live.data.status, 'live');
  assert.equal(typeof live.data.ts, 'string');

  assert.equal(ready.success, true);
  assert.equal(ready.data.ready, true);
  assert.equal(typeof ready.data.ts, 'string');
});
