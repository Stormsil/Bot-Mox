export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException, UnauthorizedException } = require('@nestjs/common');
const { IpqsController } = require('./ipqs.controller.ts');

function createServiceStub() {
  return {
    getStatus: () => ({ configured: false }),
    checkIp: (ip: string) => ({ ip, fraud_score: 0 }),
    checkIpBatch: (ips: string[]) => ips.map((ip) => ({ ip, fraud_score: 0 })),
  };
}

test('IpqsController returns deterministic code for missing bearer token', async () => {
  const controller = new IpqsController(createServiceStub());

  await assert.rejects(
    async () => controller.getStatus(undefined),
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

test('IpqsController returns deterministic code for invalid check payload', async () => {
  const controller = new IpqsController(createServiceStub());

  await assert.rejects(
    async () => controller.check('Bearer test-token', {}),
    (error: unknown) => {
      assert.ok(error instanceof BadRequestException);
      const response = (error as { getResponse: () => unknown }).getResponse() as {
        code?: string;
      };
      assert.equal(response.code, 'IPQS_INVALID_CHECK_BODY');
      return true;
    },
  );
});
