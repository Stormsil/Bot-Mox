// @ts-nocheck
export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { SignJWT } = require('jose');
const { AuthService } = require('../auth/auth.service.ts');
const { VmOpsService } = require('../vm-ops/vm-ops.service.ts');
const { LicenseService } = require('../license/license.service.ts');
const { ArtifactsService } = require('./artifacts.service.ts');

function createVmOpsRepositoryStub() {
  const store = new Map();
  return {
    async create(input) {
      const row = {
        id: input.id,
        tenantId: input.tenantId,
        agentId: input.agentId,
        commandType: input.commandType,
        payload: input.payload,
        status: input.status,
        queuedAt: new Date(),
        expiresAt: input.expiresAt ?? null,
        startedAt: null,
        completedAt: null,
        result: null,
        errorMessage: null,
        createdBy: input.createdBy ?? null,
      };
      store.set(row.id, row);
      return { ...row };
    },
    async findById(id) {
      const row = store.get(id);
      return row ? { ...row } : null;
    },
    async list() {
      return Array.from(store.values()).map((row) => ({ ...row }));
    },
    async claimNextQueued() {
      return null;
    },
    async updateStatus() {
      return null;
    },
    async expireStaleRunning() {
      return 0;
    },
    async listStaleDispatched() {
      return [];
    },
    async requeueDispatched() {
      return null;
    },
    async deadLetterDispatched() {
      return null;
    },
  };
}

function createArtifactsRepositoryStub() {
  const releases = new Map();
  const assignments = new Map();
  let releaseSeq = 0;
  let assignmentSeq = 0;

  return {
    async getNextReleaseId() {
      releaseSeq += 1;
      return releaseSeq;
    },
    async findReleaseById(tenantId, releaseId) {
      return releases.get(`${tenantId}:${releaseId}`) || null;
    },
    async upsertRelease(input) {
      releases.set(`${input.tenantId}:${input.id}`, input.payload);
      return input.payload;
    },
    async getNextAssignmentId() {
      assignmentSeq += 1;
      return assignmentSeq;
    },
    async findAssignmentByScope(input) {
      return (
        assignments.get(
          `${input.tenantId}:${input.module}:${input.platform}:${input.channel}:${input.userKey}`,
        ) || null
      );
    },
    async upsertAssignmentByScope(input) {
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
    async findById(tenantId, id) {
      return leases.get(`${tenantId}:${id}`) || null;
    },
    async upsert(input) {
      leases.set(`${input.tenantId}:${input.id}`, input.payload);
      return input.payload;
    },
    async findActiveByToken(input) {
      const now = Date.now();
      for (const [, payload] of leases) {
        const lease = payload?.lease;
        if (!lease || payload.status !== 'active') continue;
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

async function signToken(input) {
  const secret = new TextEncoder().encode(input.secret);
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({
    tenant_id: input.tenantId,
    email: input.email,
    role: 'admin',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(input.userId)
    .setJti(`jti-${input.userId}`)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .setIssuer('supabase')
    .setAudience('authenticated')
    .sign(secret);
}

test('auth -> vm-ops -> license -> artifacts flow keeps tenant isolation', async () => {
  const prevSecret = process.env.SUPABASE_JWT_SECRET;
  process.env.SUPABASE_JWT_SECRET = 'integration-secret-auth-vmops-license-artifacts';

  try {
    const tokenA = await signToken({
      secret: process.env.SUPABASE_JWT_SECRET,
      tenantId: 'tenant-a',
      userId: 'user-a',
      email: 'tenant-a@example.local',
    });
    const tokenB = await signToken({
      secret: process.env.SUPABASE_JWT_SECRET,
      tenantId: 'tenant-b',
      userId: 'user-b',
      email: 'tenant-b@example.local',
    });

    const authService = new AuthService();
    const identityA = await authService.verifyBearerToken(`Bearer ${tokenA}`);
    const identityB = await authService.verifyBearerToken(`Bearer ${tokenB}`);

    assert.ok(identityA);
    assert.ok(identityB);
    assert.equal(identityA.tenantId, 'tenant-a');
    assert.equal(identityB.tenantId, 'tenant-b');

    const vmOpsService = new VmOpsService(createVmOpsRepositoryStub());
    const licenseRepository = createLicenseRepositoryStub();
    const licenseService = new LicenseService(licenseRepository);
    const artifactsService = new ArtifactsService(
      createArtifactsRepositoryStub(),
      licenseRepository,
    );

    const command = await vmOpsService.dispatch({
      tenantId: identityA.tenantId,
      agentId: 'agent-a',
      commandType: 'proxmox.start',
      payload: { vm_uuid: 'vm-auth-1' },
      createdBy: identityA.uid,
    });
    assert.equal(command.tenant_id, 'tenant-a');

    const release = await artifactsService.createRelease({
      tenantId: identityA.tenantId,
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
      tenantId: identityA.tenantId,
      payload: {
        user_id: 'lease-user',
        module: 'core',
        platform: 'windows',
        channel: 'stable',
        release_id: release.id,
      },
    });

    const lease = await licenseService.issueLease(
      { vm_uuid: 'vm-auth-1', module: 'core' },
      { tenantId: identityA.tenantId, userId: identityA.uid },
    );

    const resolvedA = await artifactsService.resolveDownload({
      tenantId: identityA.tenantId,
      leaseToken: lease.token,
      vmUuid: 'vm-auth-1',
      module: 'core',
      platform: 'windows',
      channel: 'stable',
    });
    assert.ok(resolvedA);
    assert.equal(resolvedA.release_id, release.id);

    const resolvedB = await artifactsService.resolveDownload({
      tenantId: identityB.tenantId,
      leaseToken: lease.token,
      vmUuid: 'vm-auth-1',
      module: 'core',
      platform: 'windows',
      channel: 'stable',
    });
    assert.equal(resolvedB, null);

    const hiddenForTenantB = await vmOpsService.getById(command.id, identityB.tenantId);
    assert.equal(hiddenForTenantB, null);
  } finally {
    if (prevSecret === undefined) {
      delete process.env.SUPABASE_JWT_SECRET;
    } else {
      process.env.SUPABASE_JWT_SECRET = prevSecret;
    }
  }
});
