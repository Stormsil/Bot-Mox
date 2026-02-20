const testReconnect = require('node:test');
const assertReconnect = require('node:assert/strict');
const { computeReconnectDelayMs } = require('./reconnect-policy.ts');

testReconnect('computeReconnectDelayMs grows exponentially and respects max', () => {
  const values = [
    computeReconnectDelayMs({
      attempt: 1,
      baseMs: 1000,
      maxMs: 8000,
      jitterRatio: 0,
    }),
    computeReconnectDelayMs({
      attempt: 2,
      baseMs: 1000,
      maxMs: 8000,
      jitterRatio: 0,
    }),
    computeReconnectDelayMs({
      attempt: 3,
      baseMs: 1000,
      maxMs: 8000,
      jitterRatio: 0,
    }),
    computeReconnectDelayMs({
      attempt: 10,
      baseMs: 1000,
      maxMs: 8000,
      jitterRatio: 0,
    }),
  ];

  assertReconnect.deepEqual(values, [1000, 2000, 4000, 8000]);
});

testReconnect('computeReconnectDelayMs applies jitter within bounds', () => {
  const withoutJitter = computeReconnectDelayMs({
    attempt: 3,
    baseMs: 1000,
    maxMs: 8000,
    jitterRatio: 0,
  });
  const minJitter = computeReconnectDelayMs({
    attempt: 3,
    baseMs: 1000,
    maxMs: 8000,
    jitterRatio: 0.2,
    random: () => 0,
  });
  const maxJitter = computeReconnectDelayMs({
    attempt: 3,
    baseMs: 1000,
    maxMs: 8000,
    jitterRatio: 0.2,
    random: () => 1,
  });

  assertReconnect.equal(withoutJitter, 4000);
  assertReconnect.equal(minJitter, 3200);
  assertReconnect.equal(maxJitter, 4800);
});
