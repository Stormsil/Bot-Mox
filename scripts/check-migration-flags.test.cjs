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
    AGENT_TRANSPORT: 'hybrid',
    SECRETS_VAULT_MODE: 'enforced',
    SUPABASE_URL: '',
    SUPABASE_SERVICE_ROLE_KEY: '',
    SUPABASE_VAULT_RPC_NAME: '',
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
    AGENT_TRANSPORT: 'hybrid',
    SECRETS_VAULT_MODE: 'enforced',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    SUPABASE_VAULT_RPC_NAME: 'vault',
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /runtime migration flags are valid \(strict mode\)/);
});
