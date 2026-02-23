const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const command = ['scripts/check-migration-flags.js', '--strict'];

function runWithEnv(env) {
  return spawnSync(process.execPath, command, {
    env: {
      ...process.env,
      ...env,
    },
    encoding: 'utf8',
  });
}

test('strict mode fails when vault env is missing for enforced secrets mode', () => {
  const result = runWithEnv({
    AUTH_MODE: 'enforced',
    AGENT_TRANSPORT: 'ws',
    SECRETS_VAULT_MODE: 'enforced',
    ADMIN_ORIGIN_ENFORCEMENT: 'true',
    ADMIN_ORIGIN_STRICT: 'true',
    ADMIN_CORS_ORIGIN: 'https://admin.example.com',
    SUPABASE_URL: '',
    SUPABASE_SERVICE_ROLE_KEY: '',
    SUPABASE_VAULT_RPC_NAME: '',
    SUPABASE_VAULT_ROTATE_RPC_NAME: '',
  });

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /SUPABASE_URL is required when SECRETS_VAULT_MODE=enforced in strict mode/,
  );
});

test('strict mode passes when required vault env is present', () => {
  const result = runWithEnv({
    AUTH_MODE: 'enforced',
    AGENT_TRANSPORT: 'ws',
    SECRETS_VAULT_MODE: 'enforced',
    ADMIN_ORIGIN_ENFORCEMENT: 'true',
    ADMIN_ORIGIN_STRICT: 'true',
    ADMIN_CORS_ORIGIN: 'https://admin.example.com',
    BILLING_STUB_SELF_ACTIVATE: 'false',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    SUPABASE_VAULT_RPC_NAME: 'vault',
    SUPABASE_VAULT_ROTATE_RPC_NAME: 'vault_rotate',
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /runtime migration flags are valid \(strict mode\)/);
});

test('strict mode fails when admin origin enforcement is disabled', () => {
  const result = runWithEnv({
    AUTH_MODE: 'enforced',
    AGENT_TRANSPORT: 'ws',
    SECRETS_VAULT_MODE: 'enforced',
    ADMIN_ORIGIN_ENFORCEMENT: 'false',
    ADMIN_ORIGIN_STRICT: 'true',
    ADMIN_CORS_ORIGIN: 'https://admin.example.com',
    BILLING_STUB_SELF_ACTIVATE: 'false',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    SUPABASE_VAULT_RPC_NAME: 'vault',
    SUPABASE_VAULT_ROTATE_RPC_NAME: 'vault_rotate',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ADMIN_ORIGIN_ENFORCEMENT must be true in strict mode/);
});

test('strict mode fails when ADMIN_CORS_ORIGIN is missing', () => {
  const result = runWithEnv({
    AUTH_MODE: 'enforced',
    AGENT_TRANSPORT: 'ws',
    SECRETS_VAULT_MODE: 'enforced',
    ADMIN_ORIGIN_ENFORCEMENT: 'true',
    ADMIN_ORIGIN_STRICT: 'true',
    ADMIN_CORS_ORIGIN: '',
    BILLING_STUB_SELF_ACTIVATE: 'false',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    SUPABASE_VAULT_RPC_NAME: 'vault',
    SUPABASE_VAULT_ROTATE_RPC_NAME: 'vault_rotate',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ADMIN_CORS_ORIGIN is required in strict mode/);
});

test('strict mode fails when BILLING_STUB_SELF_ACTIVATE is enabled', () => {
  const result = runWithEnv({
    AUTH_MODE: 'enforced',
    AGENT_TRANSPORT: 'ws',
    SECRETS_VAULT_MODE: 'enforced',
    ADMIN_ORIGIN_ENFORCEMENT: 'true',
    ADMIN_ORIGIN_STRICT: 'true',
    ADMIN_CORS_ORIGIN: 'https://admin.example.com',
    BILLING_STUB_SELF_ACTIVATE: 'true',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    SUPABASE_VAULT_RPC_NAME: 'vault',
    SUPABASE_VAULT_ROTATE_RPC_NAME: 'vault_rotate',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /BILLING_STUB_SELF_ACTIVATE must be false in strict mode/);
});

test('strict mode fails when APP_DOMAIN equals ADMIN_DOMAIN', () => {
  const result = runWithEnv({
    AUTH_MODE: 'enforced',
    AGENT_TRANSPORT: 'ws',
    SECRETS_VAULT_MODE: 'enforced',
    ADMIN_ORIGIN_ENFORCEMENT: 'true',
    ADMIN_ORIGIN_STRICT: 'true',
    ADMIN_CORS_ORIGIN: 'https://admin.example.com',
    BILLING_STUB_SELF_ACTIVATE: 'false',
    APP_DOMAIN: 'example.com',
    ADMIN_DOMAIN: 'example.com',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    SUPABASE_VAULT_RPC_NAME: 'vault',
    SUPABASE_VAULT_ROTATE_RPC_NAME: 'vault_rotate',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /APP_DOMAIN and ADMIN_DOMAIN must be different in strict mode/);
});

test('strict mode fails when ADMIN_CORS_ORIGIN misses ADMIN_DOMAIN', () => {
  const result = runWithEnv({
    AUTH_MODE: 'enforced',
    AGENT_TRANSPORT: 'ws',
    SECRETS_VAULT_MODE: 'enforced',
    ADMIN_ORIGIN_ENFORCEMENT: 'true',
    ADMIN_ORIGIN_STRICT: 'true',
    ADMIN_CORS_ORIGIN: 'https://panel.example.com',
    BILLING_STUB_SELF_ACTIVATE: 'false',
    APP_DOMAIN: 'app.example.com',
    ADMIN_DOMAIN: 'admin.example.com',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    SUPABASE_VAULT_RPC_NAME: 'vault',
    SUPABASE_VAULT_ROTATE_RPC_NAME: 'vault_rotate',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ADMIN_CORS_ORIGIN must include ADMIN_DOMAIN host in strict mode/);
});

test('strict mode fails when TRIAL_DURATION_HOURS is not 24', () => {
  const result = runWithEnv({
    AUTH_MODE: 'enforced',
    AGENT_TRANSPORT: 'ws',
    SECRETS_VAULT_MODE: 'enforced',
    ADMIN_ORIGIN_ENFORCEMENT: 'true',
    ADMIN_ORIGIN_STRICT: 'true',
    ADMIN_CORS_ORIGIN: 'https://admin.example.com',
    BILLING_STUB_SELF_ACTIVATE: 'false',
    TRIAL_DURATION_HOURS: '48',
    APP_DOMAIN: 'app.example.com',
    ADMIN_DOMAIN: 'admin.example.com',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    SUPABASE_VAULT_RPC_NAME: 'vault',
    SUPABASE_VAULT_ROTATE_RPC_NAME: 'vault_rotate',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /TRIAL_DURATION_HOURS must be exactly 24 in strict mode/);
});
