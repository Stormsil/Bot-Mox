// @ts-nocheck
export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException, NotFoundException } = require('@nestjs/common');
const { AdminProjectsService } = require('./admin-projects.service.ts');

test('AdminProjectsService rollout updates explicit tenant in normalized form', async () => {
  const upserts = [];
  const service = new AdminProjectsService({
    getReleaseById: async (id) => ({
      id,
      projectKey: 'botmox-core',
    }),
    upsertRollout: async (input) => {
      upserts.push(input);
      return {
        id: `rollout-${input.tenantId}`,
        tenantId: input.tenantId,
        status: input.status,
      };
    },
    listKnownTenants: async () => [],
  });

  const result = await service.rollout({
    projectKey: 'botmox-core',
    releaseId: 'f1d57b0f-a67a-4d3c-994e-5476f2ba8cb2',
    scope: 'tenant',
    tenantId: 'TENANT-A',
    updatedBy: 'admin-1',
  });

  assert.equal(result.count, 1);
  assert.equal(upserts.length, 1);
  assert.equal(upserts[0].tenantId, 'tenant-a');
  assert.equal(upserts[0].projectKey, 'botmox-core');
});

test('AdminProjectsService rollout(all) uses known tenants with batch size limit', async () => {
  const upserts = [];
  const service = new AdminProjectsService({
    getReleaseById: async (id) => ({
      id,
      projectKey: 'botmox-core',
    }),
    upsertRollout: async (input) => {
      upserts.push(input);
      return {
        id: `rollout-${input.tenantId}`,
        tenantId: input.tenantId,
        status: input.status,
      };
    },
    listKnownTenants: async () => ['tenant-a', 'tenant-b', 'tenant-c'],
  });

  const result = await service.rollout({
    projectKey: 'botmox-core',
    releaseId: 'eb40d66e-3fe9-496e-b891-66958c7f2709',
    scope: 'all',
    batchSize: 2,
    updatedBy: 'admin-1',
  });

  assert.equal(result.count, 2);
  assert.deepEqual(
    upserts.map((row) => row.tenantId),
    ['tenant-a', 'tenant-b'],
  );
});

test('AdminProjectsService rollout fails on project/release mismatch', async () => {
  const service = new AdminProjectsService({
    getReleaseById: async () => ({
      id: 'rel-1',
      projectKey: 'another-project',
    }),
    upsertRollout: async () => null,
    listKnownTenants: async () => [],
  });

  await assert.rejects(
    () =>
      service.rollout({
        projectKey: 'botmox-core',
        releaseId: 'f93fa65d-857d-47a6-a7c0-9e7c6ca26f15',
        scope: 'all',
        updatedBy: 'admin-1',
      }),
    (error) => {
      assert.ok(error instanceof BadRequestException);
      const response = error.getResponse();
      assert.equal(response.code, 'ROLLOUT_PROJECT_MISMATCH');
      return true;
    },
  );
});

test('AdminProjectsService rollout fails when release is missing', async () => {
  const service = new AdminProjectsService({
    getReleaseById: async () => null,
    upsertRollout: async () => null,
    listKnownTenants: async () => [],
  });

  await assert.rejects(
    () =>
      service.rollout({
        projectKey: 'botmox-core',
        releaseId: '33183a5a-bd75-41a7-8ab0-5e1cb9f69dc9',
        scope: 'all',
        updatedBy: 'admin-1',
      }),
    (error) => {
      assert.ok(error instanceof NotFoundException);
      const response = error.getResponse();
      assert.equal(response.code, 'RELEASE_NOT_FOUND');
      return true;
    },
  );
});

test('AdminProjectsService rollout(scope=wave) requires wave name', async () => {
  const service = new AdminProjectsService({
    getReleaseById: async (id) => ({
      id,
      projectKey: 'botmox-core',
    }),
    upsertRollout: async () => null,
    listKnownTenants: async () => [],
  });

  await assert.rejects(
    () =>
      service.rollout({
        projectKey: 'botmox-core',
        releaseId: '4ec2d40f-157f-4801-8f2f-231866f50a4d',
        scope: 'wave',
        updatedBy: 'admin-1',
      }),
    (error) => {
      assert.ok(error instanceof BadRequestException);
      const response = error.getResponse();
      assert.equal(response.code, 'ROLLOUT_WAVE_REQUIRED');
      return true;
    },
  );
});

test('AdminProjectsService rollout deduplicates tenant_ids', async () => {
  const upserts = [];
  const service = new AdminProjectsService({
    getReleaseById: async (id) => ({
      id,
      projectKey: 'botmox-core',
    }),
    upsertRollout: async (input) => {
      upserts.push(input);
      return {
        id: `rollout-${input.tenantId}`,
        tenantId: input.tenantId,
        status: input.status,
      };
    },
    listKnownTenants: async () => [],
  });

  const result = await service.rollout({
    projectKey: 'botmox-core',
    releaseId: '74e1bf22-1f46-4c0f-83a7-32dbf4fd7a72',
    scope: 'wave',
    wave: 'alpha',
    tenantIds: ['tenant-a', 'tenant-b', 'tenant-a', 'tenant-b'],
    updatedBy: 'admin-1',
  });

  assert.equal(result.count, 2);
  assert.deepEqual(
    upserts.map((row) => row.tenantId),
    ['tenant-a', 'tenant-b'],
  );
});

test('AdminProjectsService listReleases maps repository rows', async () => {
  const now = new Date('2026-02-21T10:00:00.000Z');
  const service = new AdminProjectsService({
    listReleases: async () => ({
      items: [
        {
          id: 'rel-1',
          projectKey: 'botmox-core',
          version: '1.0.0',
          status: 'active',
          createdAt: now,
          updatedAt: now,
        },
      ],
      total: 1,
    }),
    getReleaseById: async () => null,
    upsertRollout: async () => null,
    listKnownTenants: async () => [],
  });

  const result = await service.listReleases({
    projectKey: 'botmox-core',
    limit: 10,
  });

  assert.equal(Array.isArray(result.items), true);
  assert.equal(result.total, 1);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].id, 'rel-1');
  assert.equal(result.items[0].project_key, 'botmox-core');
  assert.equal(result.items[0].version, '1.0.0');
});

test('AdminProjectsService rollback(tenant) switches tenant to previous release', async () => {
  const upserts = [];
  const service = new AdminProjectsService({
    getRolloutByTenantProject: async () => ({
      id: 'rollout-1',
      tenantId: 'tenant-a',
      projectKey: 'botmox-core',
      releaseId: 'rel-new',
      release: {
        id: 'rel-new',
        createdAt: new Date('2026-02-22T10:00:00.000Z'),
      },
    }),
    getPreviousRelease: async () => ({
      id: 'rel-old',
      projectKey: 'botmox-core',
    }),
    upsertRollout: async (input) => {
      upserts.push(input);
      return {
        id: 'rollout-2',
      };
    },
    listKnownTenants: async () => [],
  });

  const result = await service.rollback({
    projectKey: 'botmox-core',
    scope: 'tenant',
    tenantId: 'TENANT-A',
    updatedBy: 'admin-1',
  });

  assert.equal(result.rolled_back, 1);
  assert.equal(result.skipped, 0);
  assert.equal(upserts.length, 1);
  assert.equal(upserts[0].tenantId, 'tenant-a');
  assert.equal(upserts[0].releaseId, 'rel-old');
  assert.equal(upserts[0].status, 'rolled_back');
});

test('AdminProjectsService rollback skips when tenant has no current rollout', async () => {
  const service = new AdminProjectsService({
    getRolloutByTenantProject: async () => null,
    getPreviousRelease: async () => null,
    upsertRollout: async () => null,
    listKnownTenants: async () => [],
  });

  const result = await service.rollback({
    projectKey: 'botmox-core',
    scope: 'tenant',
    tenantId: 'tenant-a',
    updatedBy: 'admin-1',
  });

  assert.equal(result.rolled_back, 0);
  assert.equal(result.skipped, 1);
  assert.equal(result.tenants[0].reason, 'no_rollout');
});

test('AdminProjectsService rollback skips when previous release is missing', async () => {
  const service = new AdminProjectsService({
    getRolloutByTenantProject: async () => ({
      id: 'rollout-1',
      tenantId: 'tenant-a',
      projectKey: 'botmox-core',
      releaseId: 'rel-new',
      release: {
        id: 'rel-new',
        createdAt: new Date('2026-02-22T10:00:00.000Z'),
      },
    }),
    getPreviousRelease: async () => null,
    upsertRollout: async () => null,
    listKnownTenants: async () => [],
  });

  const result = await service.rollback({
    projectKey: 'botmox-core',
    scope: 'tenant',
    tenantId: 'tenant-a',
    updatedBy: 'admin-1',
  });

  assert.equal(result.rolled_back, 0);
  assert.equal(result.skipped, 1);
  assert.equal(result.tenants[0].reason, 'no_previous_release');
});

test('AdminProjectsService rollback(scope=wave) requires wave', async () => {
  const service = new AdminProjectsService({
    getRolloutByTenantProject: async () => null,
    getPreviousRelease: async () => null,
    upsertRollout: async () => null,
    listKnownTenants: async () => [],
  });

  await assert.rejects(
    () =>
      service.rollback({
        projectKey: 'botmox-core',
        scope: 'wave',
        updatedBy: 'admin-1',
      }),
    (error) => {
      assert.ok(error instanceof BadRequestException);
      const response = error.getResponse();
      assert.equal(response.code, 'ROLLBACK_WAVE_REQUIRED');
      return true;
    },
  );
});

test('AdminProjectsService rolloutStaged performs canary then wave rollout', async () => {
  const upserts = [];
  const service = new AdminProjectsService({
    getReleaseById: async (id) => ({
      id,
      projectKey: 'botmox-core',
    }),
    upsertRollout: async (input) => {
      upserts.push(input);
      return {
        id: `rollout-${input.tenantId}`,
        tenantId: input.tenantId,
        status: input.status,
      };
    },
    listKnownTenants: async () => ['tenant-a', 'tenant-b'],
  });

  const result = await service.rolloutStaged({
    projectKey: 'botmox-core',
    releaseId: '332501f6-f3cf-4a66-8710-34052d4bedd9',
    testTenantId: 'TENANT-A',
    batchSize: 2,
    wave: 'wave-1',
    notes: 'staged rollout',
    updatedBy: 'admin-1',
  });

  assert.equal(result.staged, true);
  assert.equal(result.canary_tenant_id, 'tenant-a');
  assert.equal(result.wave, 'wave-1');
  assert.equal(result.wave_target_count, 1);
  assert.equal(result.total_updated, 2);
  assert.equal(upserts.length, 2);
  assert.equal(upserts[0].tenantId, 'tenant-a');
  assert.equal(upserts[0].wave, null);
  assert.equal(upserts[1].tenantId, 'tenant-b');
  assert.equal(upserts[1].wave, 'wave-1');
});

test('AdminProjectsService rolloutStaged skips wave phase when only canary tenant is targeted', async () => {
  const upserts = [];
  const service = new AdminProjectsService({
    getReleaseById: async (id) => ({
      id,
      projectKey: 'botmox-core',
    }),
    upsertRollout: async (input) => {
      upserts.push(input);
      return {
        id: `rollout-${input.tenantId}`,
        tenantId: input.tenantId,
        status: input.status,
      };
    },
    listKnownTenants: async () => ['tenant-a'],
  });

  const result = await service.rolloutStaged({
    projectKey: 'botmox-core',
    releaseId: '7fc83657-ab54-444d-86d7-2186b3bef6d6',
    testTenantId: 'TENANT-A',
    tenantIds: ['TENANT-A'],
    wave: 'wave-empty',
    updatedBy: 'admin-1',
  });

  assert.equal(result.wave_target_count, 0);
  assert.equal(result.total_updated, 1);
  assert.equal(upserts.length, 1);
  assert.equal(result.phases.wave.count, 0);
  assert.deepEqual(result.phases.wave.tenants, []);
});
