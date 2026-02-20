export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { NotFoundException, UnauthorizedException } = require('@nestjs/common');
const { REQUEST_IDENTITY_KEY } = require('../auth/request-identity.ts');
const { InfraServiceError } = require('./infra.errors.ts');
const { InfraController } = require('./infra.controller.ts');

function buildRequest(tenantId: string) {
  return {
    [REQUEST_IDENTITY_KEY]: {
      userId: 'user-1',
      email: `${tenantId}@example.local`,
      roles: ['admin'],
      tenantId,
      raw: {},
    },
  };
}

function createInfraServiceStub() {
  const rejectNotImplemented = async () => {
    throw new Error('not implemented in test stub');
  };
  return {
    login: rejectNotImplemented,
    status: async () => ({ connected: true }),
    listNodeVms: rejectNotImplemented,
    cloneVm: rejectNotImplemented,
    getVmConfig: rejectNotImplemented,
    updateVmConfig: rejectNotImplemented,
    getTaskStatus: rejectNotImplemented,
    vmAction: rejectNotImplemented,
    deleteVm: rejectNotImplemented,
    sendKey: rejectNotImplemented,
    getVmCurrentStatus: rejectNotImplemented,
    getClusterResources: rejectNotImplemented,
    sshTest: rejectNotImplemented,
    execSsh: rejectNotImplemented,
    readVmConfig: rejectNotImplemented,
    writeVmConfig: rejectNotImplemented,
  };
}

test('InfraController returns deterministic code for missing bearer token', async () => {
  const controller = new InfraController(createInfraServiceStub());

  await assert.rejects(
    () => controller.proxmoxStatus(undefined, buildRequest('tenant-a')),
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

test('InfraController maps InfraServiceError to deterministic not-found envelope', async () => {
  const service = createInfraServiceStub();
  service.status = async () => {
    throw new InfraServiceError(404, 'INFRA_VM_NOT_FOUND', 'VM not found');
  };
  const controller = new InfraController(service);

  await assert.rejects(
    () => controller.proxmoxStatus('Bearer test-token', buildRequest('tenant-a')),
    (error: unknown) => {
      assert.ok(error instanceof NotFoundException);
      assert.deepEqual((error as { getResponse: () => unknown }).getResponse(), {
        code: 'INFRA_VM_NOT_FOUND',
        message: 'VM not found',
      });
      return true;
    },
  );
});
