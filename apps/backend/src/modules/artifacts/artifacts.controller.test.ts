export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { NotFoundException, UnauthorizedException } = require('@nestjs/common');
const { REQUEST_IDENTITY_KEY } = require('../auth/request-identity.ts');
const { ArtifactsController } = require('./artifacts.controller.ts');
const { ArtifactsService } = require('./artifacts.service.ts');

function createRepositoryStub() {
  const releases = new Map();
  const assignments = new Map();
  let releaseSeq = 0;
  let assignmentSeq = 0;
  return {
    getNextReleaseId: async () => {
      releaseSeq += 1;
      return releaseSeq;
    },
    findReleaseById: async (tenantId: string, releaseId: number) =>
      releases.get(`${tenantId}:${releaseId}`) || null,
    upsertRelease: async (input: { tenantId: string; id: number; payload: unknown }) => {
      releases.set(`${input.tenantId}:${input.id}`, input.payload);
      return input.payload;
    },
    getNextAssignmentId: async () => {
      assignmentSeq += 1;
      return assignmentSeq;
    },
    findAssignmentByScope: async (input: {
      tenantId: string;
      module: string;
      platform: string;
      channel: string;
      userKey: string;
    }) =>
      assignments.get(
        `${input.tenantId}:${input.module}:${input.platform}:${input.channel}:${input.userKey}`,
      ) || null,
    upsertAssignmentByScope: async (input: {
      tenantId: string;
      module: string;
      platform: string;
      channel: string;
      userKey: string;
      payload: unknown;
    }) => {
      assignments.set(
        `${input.tenantId}:${input.module}:${input.platform}:${input.channel}:${input.userKey}`,
        input.payload,
      );
      return input.payload;
    },
  };
}

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

test('ArtifactsController enforces tenant isolation for release assignment and lookup', async () => {
  const controller = new ArtifactsController(
    new ArtifactsService(createRepositoryStub(), {
      findActiveByToken: async () => ({
        lease_id: 'lease-test',
        token: 'lease-token',
        expires_at: Date.now() + 60_000,
        tenant_id: 'tenant-a',
        user_id: 'user-lease',
        vm_uuid: 'vm-1',
        module: 'core',
      }),
    }),
  );
  const auth = 'Bearer test-token';
  const tenantAReq = buildRequest('tenant-a');
  const tenantBReq = buildRequest('tenant-b');

  const createdRelease = await controller.createRelease(
    auth,
    {
      module: 'core',
      platform: 'windows',
      channel: 'stable',
      version: '1.0.0',
      object_key: 'artifacts/core/windows/stable/1.0.0.zip',
      sha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      size_bytes: 1234,
      status: 'active',
    },
    tenantAReq,
  );

  const releaseId = Number((createdRelease.data as { id: number }).id);

  await controller.assignRelease(
    auth,
    {
      user_id: 'user-1',
      module: 'core',
      platform: 'windows',
      channel: 'stable',
      release_id: releaseId,
    },
    tenantAReq,
  );

  await assert.rejects(
    () =>
      controller.assignRelease(
        auth,
        {
          user_id: 'user-1',
          module: 'core',
          platform: 'windows',
          channel: 'stable',
          release_id: releaseId,
        },
        tenantBReq,
      ),
    NotFoundException,
  );

  const tenantAAssignment = await controller.getEffectiveAssignment(
    auth,
    { userId: 'user-1', module: 'core' },
    { platform: 'windows', channel: 'stable' },
    tenantAReq,
  );
  const tenantBAssignment = await controller.getEffectiveAssignment(
    auth,
    { userId: 'user-1', module: 'core' },
    { platform: 'windows', channel: 'stable' },
    tenantBReq,
  );

  assert.equal(
    (tenantAAssignment.data as { effective_assignment: { tenant_id: string } | null })
      .effective_assignment?.tenant_id,
    'tenant-a',
  );
  assert.equal(
    (tenantBAssignment.data as { effective_assignment: { tenant_id: string } | null })
      .effective_assignment,
    null,
  );
});

test('ArtifactsController returns deterministic code for missing bearer token', async () => {
  const controller = new ArtifactsController(
    new ArtifactsService(createRepositoryStub(), {
      findActiveByToken: async () => null,
    }),
  );

  await assert.rejects(
    () =>
      controller.createRelease(
        undefined,
        {
          module: 'core',
          platform: 'windows',
          channel: 'stable',
          version: '1.0.0',
          object_key: 'artifact.zip',
          sha256: 'a'.repeat(64),
          size_bytes: 10,
          status: 'active',
        },
        buildRequest('tenant-a'),
      ),
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

test('ArtifactsController returns deterministic code for missing resolve-download assignment', async () => {
  const controller = new ArtifactsController(
    new ArtifactsService(createRepositoryStub(), {
      findActiveByToken: async () => ({
        lease_id: 'lease-a',
        token: 'lease-token',
        expires_at: Date.now() + 60_000,
        tenant_id: 'tenant-a',
        user_id: 'user-a',
        vm_uuid: 'vm-12345',
        module: 'core',
      }),
    }),
  );

  await assert.rejects(
    () =>
      controller.resolveDownload(
        'Bearer test-token',
        {
          lease_token: 'lease-token',
          vm_uuid: 'vm-12345',
          module: 'core',
          platform: 'windows',
          channel: 'stable',
        },
        buildRequest('tenant-a'),
      ),
    (error: unknown) => {
      assert.ok(error instanceof NotFoundException);
      assert.deepEqual((error as { getResponse: () => unknown }).getResponse(), {
        code: 'ARTIFACT_RESOLUTION_NOT_FOUND',
        message: 'Artifact assignment not found',
      });
      return true;
    },
  );
});
