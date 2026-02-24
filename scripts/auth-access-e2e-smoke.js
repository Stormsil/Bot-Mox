#!/usr/bin/env node
const crypto = require('node:crypto');

if (typeof fetch !== 'function') {
  console.error('[auth-access-e2e] This script requires Node.js 18+ (global fetch).');
  process.exit(1);
}

function readEnv(name, fallback = '') {
  const value = process.env[name];
  if (value === undefined || value === null) {
    return fallback;
  }
  return String(value).trim();
}

function readRequiredEnv(name) {
  const value = readEnv(name, '');
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
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

async function requestJson({ baseUrl, method, endpoint, token, body, extraHeaders }) {
  const headers = {
    Accept: 'application/json',
    ...(extraHeaders || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const requestBody = body !== undefined ? JSON.stringify(body) : undefined;

  let lastError = null;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method,
        headers,
        body: requestBody,
      });

      const text = await response.text();
      let payload = null;
      if (text) {
        try {
          payload = JSON.parse(text);
        } catch {
          payload = null;
        }
      }

      return {
        status: response.status,
        ok: response.ok,
        payload,
        raw: text,
      };
    } catch (error) {
      lastError = error;
      if (attempt >= 5) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError || 'fetch failed'));
}

function getErrorCode(result) {
  const payload = result && typeof result.payload === 'object' ? result.payload : null;
  const code = payload?.error?.code ? String(payload.error.code) : '';
  return code.trim();
}

function ensureSuccess(result, expectedStatus, label) {
  const expectedStatuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
  if (!expectedStatuses.includes(result.status)) {
    throw new Error(
      `${label} failed: expected ${expectedStatuses.join(' or ')}, got ${result.status}. body=${result.raw}`,
    );
  }
  if (!result.payload || result.payload.success !== true) {
    throw new Error(`${label} failed: expected success envelope`);
  }
  return result.payload.data;
}

function ensureError(result, status, code, label) {
  if (result.status !== status) {
    throw new Error(
      `${label} failed: expected ${status}, got ${result.status}. body=${result.raw}`,
    );
  }
  if (!result.payload || result.payload.success !== false) {
    throw new Error(`${label} failed: expected error envelope`);
  }
  const actualCode = getErrorCode(result);
  if (actualCode !== code) {
    throw new Error(`${label} failed: expected error code=${code}, got=${actualCode || 'EMPTY'}`);
  }
}

async function signIn(baseUrl, login, password) {
  const result = await requestJson({
    baseUrl,
    method: 'POST',
    endpoint: '/api/v1/auth/signin',
    body: {
      login,
      password,
    },
  });
  const data = ensureSuccess(result, [200, 201], 'auth/signin');
  return String(data.access_token || '').trim();
}

async function tryWriteSettings(baseUrl, token, payload) {
  return requestJson({
    baseUrl,
    method: 'PUT',
    endpoint: '/api/v1/settings/ui/resource_tree',
    token,
    body: payload,
  });
}

async function run() {
  const baseUrl = normalizeBaseUrl(readEnv('API_BASE_URL', 'http://localhost'));
  const adminEmail = readRequiredEnv('BOTMOX_ADMIN_EMAIL');
  const adminPassword = readRequiredEnv('BOTMOX_ADMIN_PASSWORD');
  const billingMode = readEnv('BILLING_MODE', 'stub').toLowerCase();
  const adminOrigin = readEnv('ADMIN_ORIGIN_ALLOWED_FOR_SMOKE', 'http://admin.localhost');
  const billingStubSelfActivate = ['1', 'true', 'yes', 'on'].includes(
    readEnv('BILLING_STUB_SELF_ACTIVATE', 'false').toLowerCase(),
  );
  if (billingMode !== 'stub') {
    throw new Error('BILLING_MODE must be stub for this smoke scenario');
  }

  const runId = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const userEmail = `smoke.auth.${runId}@example.local`;
  const userPassword = `S${crypto.randomBytes(12).toString('hex')}!9`;

  console.log(`[auth-access-e2e] API=${baseUrl}`);
  console.log(`[auth-access-e2e] signup user=${userEmail}`);

  const signUpResult = await requestJson({
    baseUrl,
    method: 'POST',
    endpoint: '/api/v1/auth/signup',
    body: {
      email: userEmail,
      password: userPassword,
    },
  });
  const signUpData = ensureSuccess(signUpResult, [200, 201], 'auth/signup');
  const tenantId = String(signUpData.tenant_id || '')
    .trim()
    .toLowerCase();
  const userToken = String(signUpData.access_token || '').trim();
  if (!tenantId || !userToken) {
    throw new Error('auth/signup returned empty tenant_id or access_token');
  }

  const whoamiTrial = await requestJson({
    baseUrl,
    method: 'GET',
    endpoint: '/api/v1/auth/whoami',
    token: userToken,
  });
  const whoamiTrialData = ensureSuccess(whoamiTrial, 200, 'auth/whoami (trial)');
  const trialTier = String(whoamiTrialData?.access?.accessTier || '')
    .trim()
    .toLowerCase();
  if (trialTier !== 'trial') {
    throw new Error(`Expected accessTier=trial after signup, got=${trialTier || 'EMPTY'}`);
  }
  console.log(`[auth-access-e2e] trial granted (tenant=${tenantId})`);

  const writeTrial = await tryWriteSettings(baseUrl, userToken, {
    collapsed: false,
    run_id: runId,
    stage: 'trial',
  });
  ensureSuccess(writeTrial, 200, 'settings/ui/resource_tree write (trial)');
  console.log('[auth-access-e2e] write allowed during trial');

  const adminToken = await signIn(baseUrl, adminEmail, adminPassword);
  const revokeResult = await requestJson({
    baseUrl,
    method: 'POST',
    endpoint: '/api/v1/admin/access/revoke-premium',
    token: adminToken,
    extraHeaders: {
      Origin: adminOrigin,
    },
    body: {
      tenant_id: tenantId,
    },
  });
  ensureSuccess(revokeResult, [200, 201], 'admin/access/revoke-premium');
  console.log('[auth-access-e2e] trial/premium revoked by admin');

  const writeAfterRevoke = await tryWriteSettings(baseUrl, userToken, {
    collapsed: true,
    run_id: runId,
    stage: 'after_revoke',
  });
  ensureError(writeAfterRevoke, 403, 'PREMIUM_REQUIRED', 'write after revoke');
  console.log('[auth-access-e2e] write blocked after revoke (PREMIUM_REQUIRED)');

  if (!billingStubSelfActivate) {
    const selfActivateAttempt = await requestJson({
      baseUrl,
      method: 'POST',
      endpoint: '/api/v1/billing/mock/activate',
      token: userToken,
      body: {
        days: 30,
      },
    });
    ensureError(
      selfActivateAttempt,
      403,
      'BILLING_MOCK_SELF_ACTIVATE_DISABLED',
      'billing/mock/activate (self activation disabled)',
    );
    console.log('[auth-access-e2e] self activate is disabled as expected');
  }

  const activateStubByAdmin = await requestJson({
    baseUrl,
    method: 'POST',
    endpoint: '/api/v1/billing/admin/mock-payment',
    token: adminToken,
    extraHeaders: {
      Origin: adminOrigin,
    },
    body: {
      tenant_id: tenantId,
      days: 30,
      payment_ref: `smoke-${runId}`,
    },
  });
  ensureSuccess(activateStubByAdmin, [200, 201], 'billing/admin/mock-payment');
  console.log('[auth-access-e2e] stub premium activated via admin mock-payment');

  const whoamiPremium = await requestJson({
    baseUrl,
    method: 'GET',
    endpoint: '/api/v1/auth/whoami',
    token: userToken,
  });
  const whoamiPremiumData = ensureSuccess(whoamiPremium, 200, 'auth/whoami (premium)');
  const premiumTier = String(whoamiPremiumData?.access?.accessTier || '')
    .trim()
    .toLowerCase();
  if (premiumTier !== 'premium') {
    throw new Error(`Expected accessTier=premium after activation, got=${premiumTier || 'EMPTY'}`);
  }

  const writePremium = await tryWriteSettings(baseUrl, userToken, {
    collapsed: false,
    run_id: runId,
    stage: 'premium',
  });
  ensureSuccess(writePremium, 200, 'settings/ui/resource_tree write (premium)');
  console.log('[auth-access-e2e] write allowed after premium activation');

  console.log('[auth-access-e2e] PASS');
}

run().catch((error) => {
  console.error('[auth-access-e2e] FAIL', error instanceof Error ? error.message : error);
  process.exit(1);
});
