#!/usr/bin/env node
if (typeof fetch !== 'function') {
  console.error('[admin-origin-e2e] This script requires Node.js 18+ (global fetch).');
  process.exit(1);
}

function readEnv(name, fallback = '') {
  const value = process.env[name];
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
}

function isTruthy(value) {
  return /^(1|true|yes|on)$/i.test(String(value || '').trim());
}

function normalizeBaseUrl(value) {
  const normalized = String(value || '')
    .trim()
    .replace(/\/+$/, '');
  if (!normalized) {
    throw new Error('API base URL is required');
  }
  return normalized;
}

async function requestJson({ baseUrl, endpoint, headers, method = 'GET', body }) {
  const requestHeaders = {
    Accept: 'application/json',
    ...(headers || {}),
  };
  if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json';
  }
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers: requestHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const raw = await response.text();
  let payload = null;
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = null;
    }
  }

  return { status: response.status, payload, raw };
}

async function signInAdmin(baseUrl, login, password, origin) {
  const response = await fetch(`${baseUrl}/api/v1/auth/admin/signin`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(origin ? { Origin: origin, Referer: `${origin}/` } : {}),
    },
    body: JSON.stringify({ login, password }),
  });
  const raw = await response.text();
  let payload = null;
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = null;
    }
  }

  if (response.status !== 200 && response.status !== 201) {
    throw new Error(
      `auth/admin/signin failed: expected 200/201, got=${response.status}. body=${raw}`,
    );
  }
  if (!payload || payload.success !== true) {
    throw new Error('auth/admin/signin failed: expected success envelope');
  }
  const token = String(payload?.data?.access_token || '').trim();
  if (!token) {
    throw new Error('auth/admin/signin failed: empty access_token');
  }
  return token;
}

function assertErrorCode(result, expectedStatus, expectedCode, label) {
  if (result.status !== expectedStatus) {
    throw new Error(
      `${label} failed: expected status=${expectedStatus}, got=${result.status}. body=${result.raw}`,
    );
  }
  if (!result.payload || result.payload.success !== false) {
    throw new Error(`${label} failed: expected error envelope`);
  }
  const code = String(result.payload?.error?.code || '').trim();
  if (code !== expectedCode) {
    throw new Error(`${label} failed: expected code=${expectedCode}, got=${code || 'EMPTY'}`);
  }
}

async function run() {
  const baseUrl = normalizeBaseUrl(readEnv('API_BASE_URL', 'http://localhost'));
  const allowedOrigin = readEnv('ADMIN_ORIGIN_ALLOWED_FOR_SMOKE', 'http://admin.localhost');
  const allowNonStrict = isTruthy(readEnv('ADMIN_ORIGIN_SMOKE_ALLOW_NON_STRICT', 'false'));
  const adminEmail = readEnv('BOTMOX_ADMIN_EMAIL', '');
  const adminPassword = readEnv('BOTMOX_ADMIN_PASSWORD', '');
  const endpoint = '/api/v1/admin/projects/catalog/releases';
  const dataEncryptionScopes = [
    'workspace',
    'finance',
    'settings',
    'resources',
    'playbooks',
    'bots',
    'provisioning',
    'infra',
    'vmops',
    'theme',
    'license',
    'artifacts',
  ];

  console.log(`[admin-origin-e2e] API=${baseUrl}`);
  const adminToken =
    adminEmail && adminPassword
      ? await signInAdmin(baseUrl, adminEmail, adminPassword, allowedOrigin)
      : '';
  const authHeader = adminToken ? { Authorization: `Bearer ${adminToken}` } : {};

  const noOrigin = await requestJson({
    baseUrl,
    endpoint,
    headers: authHeader,
  });
  if (allowNonStrict && noOrigin.status === 401) {
    assertErrorCode(
      noOrigin,
      401,
      'INVALID_OR_MISSING_BEARER_TOKEN',
      'admin endpoint without origin (non-strict fallback)',
    );
  } else {
    assertErrorCode(noOrigin, 403, 'ADMIN_ORIGIN_REQUIRED', 'admin endpoint without origin');
  }

  const badOrigin = await requestJson({
    baseUrl,
    endpoint,
    headers: {
      ...authHeader,
      Origin: 'https://evil.example',
    },
  });
  if (allowNonStrict && badOrigin.status === 401) {
    assertErrorCode(
      badOrigin,
      401,
      'INVALID_OR_MISSING_BEARER_TOKEN',
      'admin endpoint from foreign origin (non-strict fallback)',
    );
  } else {
    assertErrorCode(badOrigin, 403, 'ADMIN_ORIGIN_FORBIDDEN', 'admin endpoint from foreign origin');
  }

  for (const scope of dataEncryptionScopes) {
    const encryptionEndpoint = `/api/v1/admin/data-encryption/rotate-${scope}-tenant`;
    const encryptionNoOrigin = await requestJson({
      baseUrl,
      endpoint: encryptionEndpoint,
      method: 'POST',
      headers: authHeader,
      body: {
        tenant_id: 'tenant-smoke',
        dry_run: true,
      },
    });
    if (allowNonStrict && encryptionNoOrigin.status === 401) {
      assertErrorCode(
        encryptionNoOrigin,
        401,
        'INVALID_OR_MISSING_BEARER_TOKEN',
        `admin data-encryption ${scope} endpoint without origin (non-strict fallback)`,
      );
    } else {
      assertErrorCode(
        encryptionNoOrigin,
        403,
        'ADMIN_ORIGIN_REQUIRED',
        `admin data-encryption ${scope} endpoint without origin`,
      );
    }

    const encryptionBadOrigin = await requestJson({
      baseUrl,
      endpoint: encryptionEndpoint,
      method: 'POST',
      headers: {
        ...authHeader,
        Origin: 'https://evil.example',
      },
      body: {
        tenant_id: 'tenant-smoke',
        dry_run: true,
      },
    });
    if (allowNonStrict && encryptionBadOrigin.status === 401) {
      assertErrorCode(
        encryptionBadOrigin,
        401,
        'INVALID_OR_MISSING_BEARER_TOKEN',
        `admin data-encryption ${scope} endpoint from foreign origin (non-strict fallback)`,
      );
    } else {
      assertErrorCode(
        encryptionBadOrigin,
        403,
        'ADMIN_ORIGIN_FORBIDDEN',
        `admin data-encryption ${scope} endpoint from foreign origin`,
      );
    }
  }

  const allowedOriginResult = await requestJson({
    baseUrl,
    endpoint,
    headers: {
      ...authHeader,
      Origin: allowedOrigin,
    },
  });

  if (adminToken) {
    if (allowedOriginResult.status === 403) {
      throw new Error(
        `admin endpoint from allowed origin with auth failed: expected non-403, got=403. body=${allowedOriginResult.raw}`,
      );
    }
  } else {
    // Origin should pass. Then request must fail by auth layer (no bearer token).
    assertErrorCode(
      allowedOriginResult,
      401,
      'INVALID_OR_MISSING_BEARER_TOKEN',
      'admin endpoint from allowed origin without auth',
    );
  }

  console.log('[admin-origin-e2e] PASS');
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    '[admin-origin-e2e] FAIL',
    `${message} (hint: strict expectation requires backend with ADMIN_ORIGIN_STRICT=true)`,
  );
  process.exit(1);
});
