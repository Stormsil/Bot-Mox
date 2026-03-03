export {};

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function lcg(seed: number): () => number {
  let value = seed % 2147483647;
  if (value <= 0) {
    value += 2147483646;
  }
  return () => {
    value = (value * 48271) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function sortedClone(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortedClone(item));
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      output[key] = sortedClone(record[key]);
    }
    return output;
  }
  return value;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortedClone(value), null, 2);
}

function normalizeNewlines(value: string): string {
  return value.replace(/\r\n/g, '\n');
}

function fixturePath(name: string): string {
  return path.resolve(
    __dirname,
    '../../../../../.sisyphus/evidence',
    `task-1-backend-business-logic-fixture-${name}.json`,
  );
}

function readFixture(name: string): Record<string, unknown> {
  const fullPath = fixturePath(name);
  const raw = fs.readFileSync(fullPath, 'utf8');
  return JSON.parse(raw) as Record<string, unknown>;
}

async function withDeterminism<T>(
  seed: number,
  fixedNow: number,
  run: () => T | Promise<T>,
): Promise<T> {
  const originalNow = Date.now;
  const originalRandom = Math.random;

  Date.now = () => fixedNow;
  Math.random = lcg(seed);

  try {
    return await run();
  } finally {
    Date.now = originalNow;
    Math.random = originalRandom;
  }
}

function assertParity(stream: string, actual: unknown, expected: unknown): void {
  try {
    assert.deepEqual(actual, expected);
  } catch {
    const expectedJson = stableStringify(expected);
    const actualJson = stableStringify(actual);
    throw new Error(
      [`PARITY_MISMATCH:${stream}`, 'expected:', expectedJson, 'actual:', actualJson].join('\n'),
    );
  }
}

function assertSharedParity(
  stream: string,
  frontendActual: unknown,
  backendActual: unknown,
  fixtureExpected: unknown,
): void {
  assertParity(`${stream}.frontend-vs-fixture`, frontendActual, fixtureExpected);
  assertParity(`${stream}.backend-vs-fixture`, backendActual, fixtureExpected);
  assertParity(`${stream}.frontend-vs-backend`, frontendActual, backendActual);
}

module.exports = {
  assertParity,
  assertSharedParity,
  normalizeNewlines,
  readFixture,
  stableStringify,
  withDeterminism,
};
