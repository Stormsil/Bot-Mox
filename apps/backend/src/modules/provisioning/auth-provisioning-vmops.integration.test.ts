// @ts-nocheck
export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { SignJWT } = require('jose');
const { AuthService } = require('../auth/auth.service.ts');
const { ProvisioningService } = require('./provisioning.service.ts');
const { VmOpsService } = require('../vm-ops/vm-ops.service.ts');

function createProvisioningRepositoryStub() {
  const profiles = new Map();
  const tokens = new Map();
  const progress = new Map();

  return {
    async listProfiles(tenantId) {
      return Array.from(profiles.values())
        .filter((item) => item.tenant === tenantId)
        .map((item) => item.payload);
    },
    async findProfileById(tenantId, id) {
      return profiles.get(`${tenantId}:${id}`)?.payload ?? null;
    },
    async upsertProfile(input) {
      profiles.set(`${input.tenantId}:${input.id}`, {
        tenant: input.tenantId,
        payload: input.payload,
      });
      return input.payload;
    },
    async deleteProfile(tenantId, id) {
      profiles.delete(`${tenantId}:${id}`);
    },
    async upsertToken(record) {
      tokens.set(record.token, record);
    },
    async findToken(token) {
      return tokens.get(token) ?? null;
    },
    async deleteToken(token) {
      tokens.delete(token);
    },
    async appendProgress(input) {
      const key = `${input.tenantId}:${input.vmUuid}`;
      const current = progress.get(key) ?? [];
      progress.set(key, [...current, input.payload]);
    },
    async listProgressByVm(tenantId, vmUuid) {
      return progress.get(`${tenantId}:${vmUuid}`) ?? [];
    },
  };
}

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
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .setIssuer('supabase')
    .setAudience('authenticated')
    .sign(secret);
}

test('auth -> provisioning -> vm-ops flow keeps tenant isolation', async () => {
  const prevSecret = process.env.SUPABASE_JWT_SECRET;
  process.env.SUPABASE_JWT_SECRET = 'integration-secret-auth-provisioning-vmops';

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

    const provisioningService = new ProvisioningService(createProvisioningRepositoryStub());
    const vmOpsService = new VmOpsService(createVmOpsRepositoryStub());

    const profileA = await provisioningService.createProfile(
      {
        name: 'tenant-a-default',
        is_default: true,
        config: { locale: { uiLanguage: 'en-US' } },
      },
      identityA.tenantId,
    );
    assert.ok(profileA.id);

    const payload = await provisioningService.generateIsoPayload(
      {
        vm_uuid: 'vm-auth-prov-1',
        vm_name: 'vm-auth-prov-1',
        ip: {
          address: '10.0.0.10',
          netmask: '255.255.255.0',
          gateway: '10.0.0.1',
          dns: ['1.1.1.1'],
        },
        profile_id: profileA.id,
        profile_config: profileA.config,
      },
      { tenantId: identityA.tenantId, userId: identityA.uid },
    );

    const validation = await provisioningService.validateToken({
      token: payload.token,
      vm_uuid: 'vm-auth-prov-1',
    });
    assert.equal(validation?.tenantId, 'tenant-a');

    const progress = await provisioningService.reportProgress({
      token: payload.token,
      vm_uuid: 'vm-auth-prov-1',
      step: 'bootstrap',
      status: 'running',
      details: {},
    });
    assert.equal(progress?.vm_uuid, 'vm-auth-prov-1');

    const tenantAProgress = await provisioningService.getProgress(
      'vm-auth-prov-1',
      identityA.tenantId,
    );
    const tenantBProgress = await provisioningService.getProgress(
      'vm-auth-prov-1',
      identityB.tenantId,
    );
    assert.equal(tenantAProgress.events.length, 1);
    assert.equal(tenantBProgress.events.length, 0);

    const command = await vmOpsService.dispatch({
      tenantId: identityA.tenantId,
      agentId: 'agent-prov',
      commandType: 'proxmox.start',
      payload: { vm_uuid: 'vm-auth-prov-1' },
      createdBy: identityA.uid,
    });
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
