// @ts-nocheck
export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { SecretsService } = require('./secrets.service.ts');

function createRepositoryStub(overrides = {}) {
  const secretStore = new Map();
  const bindingStore = new Map();

  return {
    upsertSecretMeta: async (input) => {
      const now = new Date();
      const row = {
        id: String(input.id),
        tenantId: String(input.tenantId),
        label: String(input.label),
        alg: String(input.alg),
        keyId: String(input.keyId),
        vaultRef: input.vaultRef ?? null,
        materialVersion: Number(input.materialVersion ?? 1),
        aadMeta: input.aadMeta ?? {},
        rotatedAt: input.rotatedAt ?? null,
        createdAt: secretStore.get(`${input.tenantId}:${input.id}`)?.createdAt ?? now,
        updatedAt: now,
      };
      secretStore.set(`${input.tenantId}:${input.id}`, row);
      return row;
    },
    findSecretMeta: async (tenantId, id) => secretStore.get(`${tenantId}:${id}`) ?? null,
    listSecretMeta: async (input) =>
      Array.from(secretStore.values())
        .filter((item) => item.tenantId === input.tenantId)
        .slice(0, Number(input.limit ?? 500)),
    upsertBinding: async (input) => {
      const key = `${input.tenantId}:${input.scopeType}:${input.scopeId}:${input.fieldName}`;
      const existing = bindingStore.get(key);
      const now = new Date();
      const row = {
        id: existing?.id ?? String(input.id),
        tenantId: String(input.tenantId),
        scopeType: String(input.scopeType),
        scopeId: String(input.scopeId),
        secretRef: String(input.secretRef),
        fieldName: String(input.fieldName),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      bindingStore.set(key, row);
      return row;
    },
    listBindings: async (input) =>
      Array.from(bindingStore.values())
        .filter((item) => item.tenantId === input.tenantId)
        .filter((item) => !input.scopeType || item.scopeType === input.scopeType)
        .filter((item) => !input.scopeId || item.scopeId === input.scopeId),
    ...overrides,
  };
}

function makeVaultStub(overrides = {}) {
  return {
    storeMaterial: async () => ({ vaultRef: 'vault://ref-1', materialVersion: 1 }),
    rotateMaterial: async () => ({ vaultRef: 'vault://ref-2', materialVersion: 2 }),
    rotateStoredMaterial: async () => ({ vaultRef: 'vault://ref-3', materialVersion: 3 }),
    ...overrides,
  };
}

function createService(repositoryStub, vaultStub, vaultMode = 'shadow') {
  const previousVaultMode = process.env.SECRETS_VAULT_MODE;
  process.env.SECRETS_VAULT_MODE = vaultMode;
  const service = new SecretsService(repositoryStub, vaultStub);
  return {
    service,
    restore: () => {
      process.env.SECRETS_VAULT_MODE = previousVaultMode;
    },
  };
}

test('SecretsService requires tenantId', async () => {
  const { service, restore } = createService(createRepositoryStub(), makeVaultStub());
  try {
    await assert.rejects(
      () =>
        service.createSecret({
          tenantId: '',
          label: 's1',
          ciphertext: 'abc',
          alg: 'aes',
          keyId: 'k1',
          nonce: 'n1',
        }),
      /tenantId is required/,
    );
    await assert.rejects(() => service.getSecretMeta('', 'sec-1'), /tenantId is required/);
    await assert.rejects(
      () =>
        service.createBinding({
          tenantId: '',
          scopeType: 'bot',
          scopeId: 'b1',
          secretRef: 'sec-1',
          fieldName: 'password',
        }),
      /tenantId is required/,
    );
  } finally {
    restore();
  }
});

test('SecretsService uses repository and keeps tenant boundaries', async () => {
  const { service, restore } = createService(createRepositoryStub(), makeVaultStub());
  try {
    const created = await service.createSecret({
      tenantId: 'tenant-a',
      label: 'secret-a',
      ciphertext: 'cipher',
      alg: 'aes',
      keyId: 'k1',
      nonce: 'n1',
    });
    assert.equal(created.tenant_id, 'tenant-a');

    const fetched = await service.getSecretMeta('tenant-a', created.id);
    assert.equal(fetched?.id, created.id);

    const rotated = await service.rotateSecret({
      tenantId: 'tenant-a',
      id: created.id,
      ciphertext: 'cipher-2',
      keyId: 'k2',
      nonce: 'n2',
      aadMeta: { x: 1 },
    });
    assert.equal(rotated?.key_id, 'k2');

    await service.createBinding({
      tenantId: 'tenant-a',
      scopeType: 'bot',
      scopeId: 'b1',
      secretRef: created.id,
      fieldName: 'password',
    });
    await service.createBinding({
      tenantId: 'tenant-b',
      scopeType: 'bot',
      scopeId: 'b1',
      secretRef: created.id,
      fieldName: 'password',
    });

    const tenantA = await service.listBindings({ tenantId: 'tenant-a' });
    const tenantB = await service.listBindings({ tenantId: 'tenant-b' });
    assert.equal(tenantA.length, 1);
    assert.equal(tenantB.length, 1);
    assert.equal(tenantA[0].tenant_id, 'tenant-a');
  } finally {
    restore();
  }
});

test('SecretsService fails hard on repository errors', async () => {
  const repo = createRepositoryStub({
    upsertSecretMeta: async () => {
      throw new Error('db upsert secret failed');
    },
    listBindings: async () => {
      throw new Error('db list bindings failed');
    },
  });
  const { service, restore } = createService(repo, makeVaultStub());
  try {
    await assert.rejects(
      () =>
        service.createSecret({
          tenantId: 'tenant-a',
          label: 'secret-a',
          ciphertext: 'cipher',
          alg: 'aes',
          keyId: 'k1',
          nonce: 'n1',
        }),
      /db upsert secret failed/,
    );

    await assert.rejects(
      () => service.listBindings({ tenantId: 'tenant-a' }),
      /db list bindings failed/,
    );
  } finally {
    restore();
  }
});

test('SecretsService enforced vault mode rejects local fallback references', async () => {
  const localVaultStub = makeVaultStub({
    storeMaterial: async () => ({
      vaultRef: 'local-vault://tenant-a/sec-1/abc',
      materialVersion: 1,
    }),
  });

  const { service, restore } = createService(createRepositoryStub(), localVaultStub, 'enforced');
  try {
    await assert.rejects(
      () =>
        service.createSecret({
          tenantId: 'tenant-a',
          label: 'secret-a',
          ciphertext: 'cipher',
          alg: 'aes',
          keyId: 'k1',
          nonce: 'n1',
        }),
      /Local vault fallback is forbidden/,
    );
  } finally {
    restore();
  }
});

test('SecretsService rejects local fallback references in shadow mode', async () => {
  const localVaultStub = makeVaultStub({
    storeMaterial: async () => ({
      vaultRef: 'local-vault://tenant-a/sec-1/abc',
      materialVersion: 1,
    }),
  });

  const shadow = createService(createRepositoryStub(), localVaultStub, 'shadow');
  try {
    await assert.rejects(
      () =>
        shadow.service.createSecret({
          tenantId: 'tenant-a',
          label: 'secret-a',
          ciphertext: 'cipher',
          alg: 'aes',
          keyId: 'k1',
          nonce: 'n1',
        }),
      /Local vault fallback is forbidden/,
    );
  } finally {
    shadow.restore();
  }
});

test('SecretsService rotateTenantSecrets rotates tenant scoped metadata only', async () => {
  const repository = createRepositoryStub();
  const { service, restore } = createService(repository, makeVaultStub());
  try {
    const a = await service.createSecret({
      tenantId: 'tenant-a',
      label: 'secret-a1',
      ciphertext: 'cipher-a1',
      alg: 'aes',
      keyId: 'k-old',
      nonce: 'n1',
    });
    await service.createSecret({
      tenantId: 'tenant-a',
      label: 'secret-a2',
      ciphertext: 'cipher-a2',
      alg: 'aes',
      keyId: 'k-old',
      nonce: 'n2',
    });
    const b = await service.createSecret({
      tenantId: 'tenant-b',
      label: 'secret-b1',
      ciphertext: 'cipher-b1',
      alg: 'aes',
      keyId: 'k-old',
      nonce: 'n3',
    });

    const summary = await service.rotateTenantSecrets({
      tenantId: 'tenant-a',
      keyId: 'k-new',
    });
    assert.equal(summary.tenant_id, 'tenant-a');
    assert.equal(summary.key_id, 'k-new');
    assert.equal(summary.dry_run, false);
    assert.equal(summary.requested, 2);
    assert.equal(summary.planned, 0);
    assert.equal(summary.rotated, 2);
    assert.equal(summary.failed, 0);

    const rotatedMeta = await service.getSecretMeta('tenant-a', a.id);
    assert.equal(rotatedMeta?.key_id, 'k-new');
    assert.equal(rotatedMeta?.material_version, 3);

    const untouched = await service.getSecretMeta('tenant-b', b.id);
    assert.equal(untouched?.key_id, 'k-old');
  } finally {
    restore();
  }
});

test('SecretsService rotateTenantSecrets dry-run plans rotations without mutating metadata', async () => {
  const repository = createRepositoryStub();
  const { service, restore } = createService(repository, makeVaultStub());
  try {
    const created = await service.createSecret({
      tenantId: 'tenant-a',
      label: 'secret-a1',
      ciphertext: 'cipher-a1',
      alg: 'aes',
      keyId: 'k-old',
      nonce: 'n1',
    });

    const summary = await service.rotateTenantSecrets({
      tenantId: 'tenant-a',
      keyId: 'k-new',
      dryRun: true,
    });

    assert.equal(summary.dry_run, true);
    assert.equal(summary.requested, 1);
    assert.equal(summary.planned, 1);
    assert.equal(summary.rotated, 0);
    assert.equal(summary.failed, 0);
    assert.equal(summary.details[0]?.status, 'planned');

    const after = await service.getSecretMeta('tenant-a', created.id);
    assert.equal(after?.key_id, 'k-old');
  } finally {
    restore();
  }
});

test('SecretsService rotateTenantSecrets skips secrets already on target key id', async () => {
  const repository = createRepositoryStub();
  const { service, restore } = createService(repository, makeVaultStub());
  try {
    const created = await service.createSecret({
      tenantId: 'tenant-a',
      label: 'secret-a1',
      ciphertext: 'cipher-a1',
      alg: 'aes',
      keyId: 'k-current',
      nonce: 'n1',
    });

    const dryRunSummary = await service.rotateTenantSecrets({
      tenantId: 'tenant-a',
      keyId: 'k-current',
      dryRun: true,
    });
    assert.equal(dryRunSummary.requested, 1);
    assert.equal(dryRunSummary.planned, 0);
    assert.equal(dryRunSummary.skipped, 1);
    assert.equal(dryRunSummary.details[0]?.reason, 'already_on_key_id');

    const liveSummary = await service.rotateTenantSecrets({
      tenantId: 'tenant-a',
      keyId: 'k-current',
    });
    assert.equal(liveSummary.rotated, 0);
    assert.equal(liveSummary.skipped, 1);
    assert.equal(liveSummary.details[0]?.reason, 'already_on_key_id');

    const after = await service.getSecretMeta('tenant-a', created.id);
    assert.equal(after?.key_id, 'k-current');
  } finally {
    restore();
  }
});
