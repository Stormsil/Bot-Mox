// @ts-nocheck
export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { ArtifactsService } = require('./artifacts.service.ts');

function createRepositoryStub(overrides = {}) {
  return {
    getNextReleaseId: async () => 1,
    findReleaseById: async () => null,
    upsertRelease: async (input: { payload: unknown }) => input.payload,
    getNextAssignmentId: async () => 1,
    findAssignmentByScope: async () => null,
    upsertAssignmentByScope: async (input: { payload: unknown }) => input.payload,
    ...overrides,
  };
}

function createLicenseRepositoryStub(overrides = {}) {
  return {
    findActiveByToken: async () => ({
      lease_id: 'lease-test',
      token: 'lease-token',
      expires_at: Date.now() + 60_000,
      tenant_id: 'tenant-a',
      user_id: 'user-lease',
      vm_uuid: 'vm-1',
      module: 'core',
    }),
    ...overrides,
  };
}

function createService(repositoryOverrides = {}, licenseRepositoryOverrides = {}) {
  const repository = createRepositoryStub(repositoryOverrides);
  const licenseRepository = createLicenseRepositoryStub(licenseRepositoryOverrides);
  return new ArtifactsService(repository, licenseRepository);
}

function createReleasePayload() {
  return {
    module: 'core',
    platform: 'windows',
    channel: 'stable',
    version: '1.0.0',
    object_key: 'artifacts/core/windows/stable/1.0.0.zip',
    sha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    size_bytes: 1234,
    status: 'active',
  } as const;
}

test('ArtifactsService requires tenantId', async () => {
  const service = createService();
  await assert.rejects(
    () => service.createRelease({ tenantId: '', payload: createReleasePayload() }),
    /tenantId is required/,
  );
  await assert.rejects(
    () =>
      service.getEffectiveAssignment({
        tenantId: '',
        userId: 'user-1',
        module: 'core',
        platform: 'windows',
        channel: 'stable',
      }),
    /tenantId is required/,
  );
});

test('ArtifactsService isolates assignments by tenant', async () => {
  let releaseSeq = 0;
  type AssignmentScopeInput = {
    tenantId: string;
    module: string;
    platform: string;
    channel: string;
    userKey: string;
  };
  const assignments = new Map<string, unknown>();
  const service = createService({
    getNextReleaseId: async () => {
      releaseSeq += 1;
      return releaseSeq;
    },
    findReleaseById: async (tenantId: string, releaseId: number) => ({
      id: releaseId,
      tenant_id: tenantId,
      module: 'core',
      platform: 'windows',
      channel: 'stable',
      version: '1.0.0',
      object_key: 'artifact.zip',
      sha256: 'a'.repeat(64),
      size_bytes: 100,
      status: 'active',
    }),
    findAssignmentByScope: async (input: AssignmentScopeInput) =>
      assignments.get(
        `${input.tenantId}:${input.module}:${input.platform}:${input.channel}:${input.userKey}`,
      ) || null,
    upsertAssignmentByScope: async (input: AssignmentScopeInput & { payload: unknown }) => {
      assignments.set(
        `${input.tenantId}:${input.module}:${input.platform}:${input.channel}:${input.userKey}`,
        input.payload,
      );
      return input.payload;
    },
  });

  const releaseA = await service.createRelease({
    tenantId: 'tenant-a',
    payload: createReleasePayload(),
  });
  const releaseB = await service.createRelease({
    tenantId: 'tenant-b',
    payload: createReleasePayload(),
  });

  await service.assignRelease({
    tenantId: 'tenant-a',
    payload: {
      user_id: 'user-1',
      module: 'core',
      platform: 'windows',
      channel: 'stable',
      release_id: releaseA.id,
    },
  });
  await service.assignRelease({
    tenantId: 'tenant-b',
    payload: {
      user_id: 'user-1',
      module: 'core',
      platform: 'windows',
      channel: 'stable',
      release_id: releaseB.id,
    },
  });

  const effectiveA = await service.getEffectiveAssignment({
    tenantId: 'tenant-a',
    userId: 'user-1',
    module: 'core',
    platform: 'windows',
    channel: 'stable',
  });
  const effectiveB = await service.getEffectiveAssignment({
    tenantId: 'tenant-b',
    userId: 'user-1',
    module: 'core',
    platform: 'windows',
    channel: 'stable',
  });

  assert.equal(effectiveA.effective_assignment?.tenant_id, 'tenant-a');
  assert.equal(effectiveB.effective_assignment?.tenant_id, 'tenant-b');
});

test('ArtifactsService uses repository and fails hard on repository errors', async () => {
  const releaseRecord = {
    id: 7,
    tenant_id: 'tenant-a',
    module: 'core',
    platform: 'windows',
    channel: 'stable',
    version: '1.0.0',
    object_key: 'artifact.zip',
    sha256: 'a'.repeat(64),
    size_bytes: 100,
    status: 'active',
  };

  const service = createService({
    getNextReleaseId: async () => 7,
    upsertRelease: async (input: { payload: unknown }) => input.payload,
    findReleaseById: async () => releaseRecord,
    getNextAssignmentId: async () => 3,
    upsertAssignmentByScope: async (input: { payload: unknown }) => input.payload,
    findAssignmentByScope: async (input: { userKey: string }) => {
      if (input.userKey === 'user-1' || input.userKey === 'lease-user') {
        return {
          id: 3,
          tenant_id: 'tenant-a',
          module: 'core',
          platform: 'windows',
          channel: 'stable',
          user_id: 'user-1',
          release_id: 7,
          is_default: false,
        };
      }
      return null;
    },
  });

  const release = await service.createRelease({
    tenantId: 'tenant-a',
    payload: createReleasePayload(),
  });
  assert.equal(release.id, 7);

  const assignment = await service.assignRelease({
    tenantId: 'tenant-a',
    payload: {
      user_id: 'user-1',
      module: 'core',
      platform: 'windows',
      channel: 'stable',
      release_id: 7,
    },
  });
  assert.equal(assignment.id, 3);

  const resolved = await service.resolveDownload({
    tenantId: 'tenant-a',
    leaseToken: 'lease-token',
    vmUuid: 'vm-1',
    module: 'core',
    platform: 'windows',
    channel: 'stable',
  });
  assert.equal(resolved?.release_id, 7);

  const failing = createService({
    getNextReleaseId: async () => {
      throw new Error('db unavailable');
    },
  });
  await assert.rejects(
    () => failing.createRelease({ tenantId: 'tenant-a', payload: createReleasePayload() }),
    /db unavailable/,
  );
});

test('ArtifactsService resolveDownload requires active matching lease token', async () => {
  const service = createService(
    {
      findReleaseById: async () => ({
        id: 10,
        tenant_id: 'tenant-a',
        module: 'core',
        platform: 'windows',
        channel: 'stable',
        version: '1.0.0',
        object_key: 'artifact.zip',
        sha256: 'a'.repeat(64),
        size_bytes: 100,
        status: 'active',
      }),
      findAssignmentByScope: async () => ({
        id: 4,
        tenant_id: 'tenant-a',
        module: 'core',
        platform: 'windows',
        channel: 'stable',
        user_id: 'lease-user',
        release_id: 10,
        is_default: false,
      }),
    },
    {
      findActiveByToken: async () => null,
    },
  );

  const resolved = await service.resolveDownload({
    tenantId: 'tenant-a',
    leaseToken: 'invalid-token',
    vmUuid: 'vm-1',
    module: 'core',
    platform: 'windows',
    channel: 'stable',
  });
  assert.equal(resolved, null);
});
