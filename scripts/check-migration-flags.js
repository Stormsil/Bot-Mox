#!/usr/bin/env node

const allowed = {
  AUTH_MODE: new Set(['shadow', 'enforced']),
  AGENT_TRANSPORT: new Set(['longpoll', 'ws', 'hybrid']),
  SECRETS_VAULT_MODE: new Set(['shadow', 'enforced']),
};

const strictAllowed = {
  AUTH_MODE: new Set(['enforced']),
  AGENT_TRANSPORT: new Set(['hybrid', 'ws']),
  SECRETS_VAULT_MODE: new Set(['enforced']),
};

const args = new Set(process.argv.slice(2));
const strictMode = args.has('--strict');

let failed = false;
const resolvedFlags = {};

for (const [name, values] of Object.entries(allowed)) {
  const raw = String(process.env[name] ?? '')
    .trim()
    .toLowerCase();

  if (!raw) {
    if (strictMode) {
      // eslint-disable-next-line no-console
      console.error(`[migration:check] ${name} is required in strict mode`);
      failed = true;
    }
    continue;
  }

  resolvedFlags[name] = raw;

  if (!values.has(raw)) {
    // eslint-disable-next-line no-console
    console.error(
      `[migration:check] ${name}="${raw}" is invalid. Allowed: ${Array.from(values).join(', ')}`,
    );
    failed = true;
    continue;
  }

  if (strictMode) {
    const strictValues = strictAllowed[name];
    if (strictValues && !strictValues.has(raw)) {
      // eslint-disable-next-line no-console
      console.error(
        `[migration:check] ${name}="${raw}" is too weak for strict mode. Allowed strict values: ${Array.from(strictValues).join(', ')}`,
      );
      failed = true;
    }
  }
}

const requiredVaultEnvNames = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_VAULT_RPC_NAME',
];
if (strictMode && resolvedFlags.SECRETS_VAULT_MODE === 'enforced') {
  for (const envName of requiredVaultEnvNames) {
    const envValue = String(process.env[envName] ?? '').trim();
    if (!envValue) {
      // eslint-disable-next-line no-console
      console.error(
        `[migration:check] ${envName} is required when SECRETS_VAULT_MODE=enforced in strict mode`,
      );
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}

// eslint-disable-next-line no-console
console.log(
  `[migration:check] runtime migration flags are valid${strictMode ? ' (strict mode)' : ''}`,
);
