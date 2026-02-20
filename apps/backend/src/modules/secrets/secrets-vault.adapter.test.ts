export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { SecretsVaultAdapter } = require('./secrets-vault.adapter.ts');

const ORIGINAL_ENV = {
  SECRETS_VAULT_MODE: process.env.SECRETS_VAULT_MODE,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_VAULT_RPC_NAME: process.env.SUPABASE_VAULT_RPC_NAME,
};

function restoreEnv() {
  process.env.SECRETS_VAULT_MODE = ORIGINAL_ENV.SECRETS_VAULT_MODE;
  process.env.SUPABASE_URL = ORIGINAL_ENV.SUPABASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = ORIGINAL_ENV.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_VAULT_RPC_NAME = ORIGINAL_ENV.SUPABASE_VAULT_RPC_NAME;
}

function clearVaultConfig() {
  process.env.SUPABASE_URL = '';
  process.env.SUPABASE_SERVICE_ROLE_KEY = '';
  process.env.SUPABASE_VAULT_RPC_NAME = '';
}

const BASE_INPUT = {
  tenantId: 'tenant-a',
  secretId: 'sec-1',
  ciphertext: 'cipher',
  nonce: 'nonce',
  keyId: 'key-1',
  alg: 'aes',
};

test('SecretsVaultAdapter shadow mode fails when RPC config missing', async () => {
  process.env.SECRETS_VAULT_MODE = 'shadow';
  clearVaultConfig();

  try {
    const adapter = new SecretsVaultAdapter();
    await assert.rejects(
      () => adapter.storeMaterial(BASE_INPUT),
      /Supabase Vault configuration missing/,
    );
  } finally {
    restoreEnv();
  }
});

test('SecretsVaultAdapter enforced mode fails fast when RPC config missing', async () => {
  process.env.SECRETS_VAULT_MODE = 'enforced';
  clearVaultConfig();

  try {
    const adapter = new SecretsVaultAdapter();
    await assert.rejects(
      () => adapter.storeMaterial(BASE_INPUT),
      /Supabase Vault configuration missing/,
    );
  } finally {
    restoreEnv();
  }
});

test('SecretsVaultAdapter stores via Supabase RPC when config exists', async () => {
  process.env.SECRETS_VAULT_MODE = 'enforced';
  process.env.SUPABASE_URL = 'http://localhost:54321';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  process.env.SUPABASE_VAULT_RPC_NAME = 'vault_store_secret';

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ vault_ref: 'vault://tenant-a/sec-1', material_version: 5 }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch;

  try {
    const adapter = new SecretsVaultAdapter();
    const stored = await adapter.storeMaterial(BASE_INPUT);
    assert.equal(stored.vaultRef, 'vault://tenant-a/sec-1');
    assert.equal(stored.materialVersion, 5);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv();
  }
});
