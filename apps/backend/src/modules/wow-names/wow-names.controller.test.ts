export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException, UnauthorizedException } = require('@nestjs/common');
const { WowNamesController } = require('./wow-names.controller.ts');

test('WowNamesController returns deterministic code for missing bearer token', () => {
  const controller = new WowNamesController({
    getWowNames: () => ({ names: [], count: 0, batches: 1, random: '', source: 'test' }),
  });

  assert.throws(
    () => controller.get(undefined, {}),
    (error: unknown) => {
      assert.ok(error instanceof UnauthorizedException);
      assert.deepEqual((error as { getResponse: () => unknown }).getResponse(), {
        code: 'MISSING_BEARER_TOKEN',
        message: 'Missing bearer token',
      });
      return true;
    },
  );
});

test('WowNamesController returns deterministic code for invalid query payload', () => {
  const controller = new WowNamesController({
    getWowNames: () => ({ names: [], count: 0, batches: 1, random: '', source: 'test' }),
  });

  assert.throws(
    () => controller.get('Bearer test-token', { count: 0 }),
    (error: unknown) => {
      assert.ok(error instanceof BadRequestException);
      const response = (error as { getResponse: () => unknown }).getResponse() as {
        code?: string;
        message?: string;
      };
      assert.equal(response.code, 'WOW_NAMES_INVALID_QUERY');
      assert.equal(response.message, 'Invalid wow names query');
      return true;
    },
  );
});
