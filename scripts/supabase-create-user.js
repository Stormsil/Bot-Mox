#!/usr/bin/env node
/* eslint-disable no-console */
const { randomUUID } = require('node:crypto');

function readArg(name) {
  const argv = process.argv.slice(2);
  const prefix = `--${name}=`;
  for (const arg of argv) {
    if (arg.startsWith(prefix)) return arg.slice(prefix.length);
  }

  const index = argv.indexOf(`--${name}`);
  if (index !== -1 && argv[index + 1]) return argv[index + 1];
  return '';
}

function required(name, value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    throw new Error(`Missing required ${name}.`);
  }
  return trimmed;
}

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function isTruthy(value) {
  return /^(1|true|yes|on)$/i.test(String(value || '').trim());
}

function normalizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function normalizeTenant(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function parseRoles(value) {
  return Array.from(
    new Set(
      String(value || '')
        .split(',')
        .map((entry) =>
          String(entry || '')
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean),
    ),
  );
}

function extractExistingTenantId(user) {
  if (!user || typeof user !== 'object') {
    return '';
  }

  const appMetadata =
    user.app_metadata && typeof user.app_metadata === 'object'
      ? user.app_metadata
      : user.raw_app_meta_data && typeof user.raw_app_meta_data === 'object'
        ? user.raw_app_meta_data
        : null;
  if (!appMetadata) {
    return '';
  }

  return normalizeTenant(appMetadata.tenant_id);
}

function extractExistingRoles(user) {
  if (!user || typeof user !== 'object') {
    return [];
  }

  const appMetadata =
    user.app_metadata && typeof user.app_metadata === 'object'
      ? user.app_metadata
      : user.raw_app_meta_data && typeof user.raw_app_meta_data === 'object'
        ? user.raw_app_meta_data
        : null;
  if (!appMetadata || !Array.isArray(appMetadata.roles)) {
    return [];
  }

  return Array.from(
    new Set(
      appMetadata.roles
        .map((entry) =>
          String(entry || '')
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean),
    ),
  );
}

function parseErrorMessage(payload, fallbackMessage) {
  return String(
    payload?.msg || payload?.error_description || payload?.error || fallbackMessage || '',
  )
    .trim()
    .toLowerCase();
}

async function adminRequest(baseUrl, serviceRoleKey, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

async function findUserByEmail(baseUrl, serviceRoleKey, email) {
  const targetEmail = normalizeEmail(email);
  const perPage = 200;
  for (let page = 1; page <= 25; page += 1) {
    const { response, payload } = await adminRequest(
      baseUrl,
      serviceRoleKey,
      `/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
      { method: 'GET' },
    );
    if (!response.ok) {
      const message = parseErrorMessage(payload, response.statusText);
      throw new Error(`Supabase admin users list failed (${response.status}): ${message}`);
    }

    const users = Array.isArray(payload?.users)
      ? payload.users
      : Array.isArray(payload)
        ? payload
        : [];
    const match = users.find((user) => normalizeEmail(user?.email) === targetEmail);
    if (match) {
      return match;
    }

    if (users.length < perPage) {
      return null;
    }
  }

  return null;
}

async function upsertUser({
  baseUrl,
  serviceRoleKey,
  email,
  password,
  tenantId,
  roles,
  rolesProvided,
  allowUpsert,
}) {
  const existing = await findUserByEmail(baseUrl, serviceRoleKey, email);
  if (existing?.id && !allowUpsert) {
    throw new Error('User already exists and --upsert is disabled');
  }

  const resolvedTenantId =
    normalizeTenant(tenantId) || extractExistingTenantId(existing) || `t_${randomUUID()}`;
  const existingRoles = extractExistingRoles(existing);
  const resolvedRoles = rolesProvided
    ? roles.length > 0
      ? roles
      : ['user']
    : existingRoles.length > 0
      ? existingRoles
      : ['user'];

  const userBody = {
    email,
    password,
    email_confirm: true,
    app_metadata: {
      tenant_id: resolvedTenantId,
      tenant_type: 'user',
      roles: resolvedRoles,
    },
  };

  if (existing?.id) {
    const update = await adminRequest(
      baseUrl,
      serviceRoleKey,
      `/auth/v1/admin/users/${existing.id}`,
      {
        method: 'PUT',
        body: JSON.stringify(userBody),
      },
    );
    if (!update.response.ok) {
      const updateMessage = parseErrorMessage(update.payload, update.response.statusText);
      throw new Error(`Supabase user update failed (${update.response.status}): ${updateMessage}`);
    }
    const user = update.payload?.user || update.payload;
    return { mode: 'updated', user, tenantId: resolvedTenantId };
  }

  const create = await adminRequest(baseUrl, serviceRoleKey, '/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify(userBody),
  });

  if (create.response.ok) {
    const user = create.payload?.user || create.payload;
    return { mode: 'created', user, tenantId: resolvedTenantId };
  }

  const createMessage = parseErrorMessage(create.payload, create.response.statusText);
  throw new Error(`Supabase user create failed (${create.response.status}): ${createMessage}`);
}

async function main() {
  const supabasePublicUrl = required(
    'env SUPABASE_PUBLIC_URL',
    process.env.SUPABASE_PUBLIC_URL || process.env.SUPABASE_URL,
  );
  const serviceRoleKey = required(
    'env SUPABASE_SERVICE_ROLE_KEY',
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const email = normalizeEmail(required('arg --email', readArg('email')));
  const password = required('arg --password', readArg('password'));
  const tenantId = normalizeTenant(readArg('tenant') || process.env.DEFAULT_TENANT_ID || '');
  const rolesArg = String(readArg('roles') || process.env.DEFAULT_USER_ROLES || '').trim();
  const rolesProvided = rolesArg.length > 0;
  const roles = rolesProvided ? parseRoles(rolesArg) : [];

  const allowUpsertRaw = String(
    readArg('upsert') || process.env.SUPABASE_CREATE_USER_UPSERT || 'true',
  ).trim();
  const allowUpsert = isTruthy(allowUpsertRaw);

  const baseUrl = trimTrailingSlash(supabasePublicUrl);
  const result = await upsertUser({
    baseUrl,
    serviceRoleKey,
    email,
    password,
    tenantId,
    roles,
    rolesProvided,
    allowUpsert,
  });

  console.log('[supabase-create-user] OK');
  console.log(`mode=${result.mode}`);
  console.log(`id=${result.user?.id || ''}`);
  console.log(`email=${result.user?.email || email}`);
  console.log(`tenant_id=${result.tenantId || ''}`);
}

main().catch((error) => {
  console.error('[supabase-create-user] ERROR');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
