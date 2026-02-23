#!/usr/bin/env node

const allowed = {
  AUTH_MODE: new Set(['shadow', 'enforced']),
  AGENT_TRANSPORT: new Set(['longpoll', 'ws', 'hybrid']),
  SECRETS_VAULT_MODE: new Set(['shadow', 'enforced']),
};

const strictAllowed = {
  AUTH_MODE: new Set(['enforced']),
  AGENT_TRANSPORT: new Set(['ws']),
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
  'SUPABASE_VAULT_ROTATE_RPC_NAME',
];
const requiredAdminOriginEnvNames = ['ADMIN_CORS_ORIGIN'];

function parseBooleanFlag(value, fallback = false) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
}

function normalizeHostLike(value) {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!raw) {
    return '';
  }

  if (raw.includes('://')) {
    try {
      const url = new URL(raw);
      return String(url.host || '')
        .trim()
        .toLowerCase();
    } catch {
      return raw;
    }
  }

  return raw;
}

function normalizeOriginHostSet(csvValue) {
  const raw = String(csvValue ?? '').trim();
  if (!raw) {
    return new Set();
  }

  const result = new Set();
  for (const part of raw.split(',')) {
    const host = normalizeHostLike(part);
    if (host) {
      result.add(host);
    }
  }
  return result;
}

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

if (strictMode) {
  const adminOriginEnforcement = parseBooleanFlag(process.env.ADMIN_ORIGIN_ENFORCEMENT, true);
  const adminOriginStrict = parseBooleanFlag(process.env.ADMIN_ORIGIN_STRICT, true);
  const billingStubSelfActivate = parseBooleanFlag(process.env.BILLING_STUB_SELF_ACTIVATE, false);
  const appDomain = normalizeHostLike(process.env.APP_DOMAIN);
  const adminDomain = normalizeHostLike(process.env.ADMIN_DOMAIN);
  const adminCorsOriginHosts = normalizeOriginHostSet(process.env.ADMIN_CORS_ORIGIN);
  const trialDurationHoursRaw = String(process.env.TRIAL_DURATION_HOURS ?? '').trim();
  const trialDurationHours = Number(trialDurationHoursRaw || '24');

  if (!adminOriginEnforcement) {
    // eslint-disable-next-line no-console
    console.error('[migration:check] ADMIN_ORIGIN_ENFORCEMENT must be true in strict mode');
    failed = true;
  }
  if (!adminOriginStrict) {
    // eslint-disable-next-line no-console
    console.error('[migration:check] ADMIN_ORIGIN_STRICT must be true in strict mode');
    failed = true;
  }

  for (const envName of requiredAdminOriginEnvNames) {
    const envValue = String(process.env[envName] ?? '').trim();
    if (!envValue) {
      // eslint-disable-next-line no-console
      console.error(`[migration:check] ${envName} is required in strict mode`);
      failed = true;
    }
  }

  if (billingStubSelfActivate) {
    // eslint-disable-next-line no-console
    console.error('[migration:check] BILLING_STUB_SELF_ACTIVATE must be false in strict mode');
    failed = true;
  }

  if (!Number.isFinite(trialDurationHours) || Math.trunc(trialDurationHours) !== 24) {
    // eslint-disable-next-line no-console
    console.error('[migration:check] TRIAL_DURATION_HOURS must be exactly 24 in strict mode');
    failed = true;
  }

  if (appDomain && adminDomain && appDomain === adminDomain) {
    // eslint-disable-next-line no-console
    console.error(
      `[migration:check] APP_DOMAIN and ADMIN_DOMAIN must be different in strict mode (both are "${appDomain}")`,
    );
    failed = true;
  }

  if (adminDomain && !adminCorsOriginHosts.has(adminDomain)) {
    // eslint-disable-next-line no-console
    console.error(
      `[migration:check] ADMIN_CORS_ORIGIN must include ADMIN_DOMAIN host in strict mode (missing "${adminDomain}")`,
    );
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

// eslint-disable-next-line no-console
console.log(
  `[migration:check] runtime migration flags are valid${strictMode ? ' (strict mode)' : ''}`,
);
