// @ts-nocheck
export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { ArtifactsService } = require('./artifacts.service.ts');
const { LicenseService } = require('../license/license.service.ts');

function createArtifactsRepositoryStub() {
  const releases = new Map();
  const assignments = new Map();
  let releaseSeq = 0;
  let assignmentSeq = 0;

  return {
    getNextReleaseId: async () => {
      releaseSeq += 1;
      return releaseSeq;
    },
    findReleaseById: async (tenantId, releaseId) =>
      releases.get(`${tenantId}:${releaseId}`) || null,
    upsertRelease: async (input) => {
      releases.set(`${input.tenantId}:${input.id}`, input.payload);
      return input.payload;
    },
    getNextAssignmentId: async () => {
      assignmentSeq += 1;
      return assignmentSeq;
    },
    findAssignmentByScope: async (input) =>
      assignments.get(
        `${input.tenantId}:${input.module}:${input.platform}:${input.channel}:${input.userKey}`,
      ) || null,
    upsertAssignmentByScope: async (input) => {
      assignments.set(
        `${input.tenantId}:${input.module}:${input.platform}:${input.channel}:${input.userKey}`,
        input.payload,
      );
      return input.payload;
    },
  };
}

function createLicenseRepositoryStub() {
  const leases = new Map();

  return {
    findById: async (tenantId, id) => leases.get(`${tenantId}:${id}`) || null,
    upsert: async (input) => {
      leases.set(`${input.tenantId}:${input.id}`, input.payload);
      return input.payload;
    },
    findActiveByToken: async (input) => {
      const now = Date.now();
      for (const [, payload] of leases) {
        if (!payload || payload.status !== 'active' || !payload.lease) continue;
        const lease = payload.lease;
        if (lease.tenant_id !== input.tenantId) continue;
        if (lease.token !== input.token) continue;
        if (lease.vm_uuid !== input.vmUuid) continue;
        if (lease.module !== input.module) continue;
        if (Number(lease.expires_at || 0) <= now) continue;
        return lease;
      }
      return null;
    },
  };
}

test('license->artifacts flow enforces lease token + tenant isolation', async () => {
  const artifactsRepository = createArtifactsRepositoryStub();
  const licenseRepository = createLicenseRepositoryStub();

  const licenseService = new LicenseService(licenseRepository);
  const artifactsService = new ArtifactsService(artifactsRepository, licenseRepository);

  const release = await artifactsService.createRelease({
    tenantId: 'tenant-a',
    payload: {
      module: 'core',
      platform: 'windows',
      channel: 'stable',
      version: '1.0.0',
      object_key: 'artifacts/core/windows/stable/1.0.0.zip',
      sha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      size_bytes: 1024,
      status: 'active',
    },
  });

  await artifactsService.assignRelease({
    tenantId: 'tenant-a',
    payload: {
      user_id: 'lease-user',
      module: 'core',
      platform: 'windows',
      channel: 'stable',
      release_id: release.id,
    },
  });

  const lease = await licenseService.issueLease(
    { vm_uuid: 'vm-1', module: 'core' },
    { tenantId: 'tenant-a', userId: 'user-a' },
  );

  const resolved = await artifactsService.resolveDownload({
    tenantId: 'tenant-a',
    leaseToken: lease.token,
    vmUuid: 'vm-1',
    module: 'core',
    platform: 'windows',
    channel: 'stable',
  });
  assert.ok(resolved);
  assert.equal(resolved.release_id, release.id);

  const wrongTenant = await artifactsService.resolveDownload({
    tenantId: 'tenant-b',
    leaseToken: lease.token,
    vmUuid: 'vm-1',
    module: 'core',
    platform: 'windows',
    channel: 'stable',
  });
  assert.equal(wrongTenant, null);

  const wrongVm = await artifactsService.resolveDownload({
    tenantId: 'tenant-a',
    leaseToken: lease.token,
    vmUuid: 'vm-other',
    module: 'core',
    platform: 'windows',
    channel: 'stable',
  });
  assert.equal(wrongVm, null);
});
