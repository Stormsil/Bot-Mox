#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

if (typeof fetch !== 'function') {
  console.error('[artifacts-e2e] This script requires Node.js 18+ (global fetch).');
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
  const normalized = String(value || '').trim().replace(/\/+$/, '');
  if (!normalized) {
    throw new Error('API_BASE_URL is required');
  }
  return normalized;
}

function ensureReleaseId(value) {
  if (!value) return null;
  const parsed = Number.parseInt(String(value).trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('E2E_RELEASE_ID must be a positive integer');
  }
  return parsed;
}

function buildAuthHeaders(token, hasBody = false) {
  const headers = {
    Authorization: `Bearer ${token}`,
  };
  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

async function requestJson({ baseUrl, token, method, endpoint, body }) {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers: buildAuthHeaders(token, body !== undefined),
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

  return {
    status: response.status,
    ok: response.ok,
    payload,
    raw,
  };
}

function toErrorSnippet(result) {
  const code = result?.payload?.error?.code || 'UNKNOWN_ERROR';
  const message = result?.payload?.error?.message || result?.raw || 'unknown error';
  return `${code}: ${message}`;
}

function expectSuccess(result, expectedStatus, label) {
  if (result.status !== expectedStatus) {
    throw new Error(`${label} failed (${result.status}), expected ${expectedStatus}. ${toErrorSnippet(result)}`);
  }
  if (!result.payload || result.payload.success !== true) {
    throw new Error(`${label} failed: response envelope is not success=true`);
  }
  return result.payload.data;
}

function expectFailure(result, expectedStatus, expectedCode, label) {
  if (result.status !== expectedStatus) {
    throw new Error(`${label} failed (${result.status}), expected ${expectedStatus}. ${toErrorSnippet(result)}`);
  }
  if (!result.payload || result.payload.success !== false) {
    throw new Error(`${label} failed: expected error envelope`);
  }
  const actualCode = String(result.payload?.error?.code || '').trim();
  if (actualCode !== expectedCode) {
    throw new Error(`${label} failed: expected code=${expectedCode}, got=${actualCode || 'EMPTY'}`);
  }
}

function mutateVmUuid(vmUuid) {
  if (vmUuid.length < 8) {
    return `${vmUuid}x`;
  }
  const lastChar = vmUuid.slice(-1);
  const replacement = lastChar === 'a' ? 'b' : 'a';
  return `${vmUuid.slice(0, -1)}${replacement}`;
}

function createRandomVmUuid() {
  return `e2e-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`.toLowerCase();
}

async function downloadToFile(url, targetPath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Artifact download failed (${response.status})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(targetPath, buffer);
  return buffer.length;
}

function computeSha256(filePath) {
  const hash = crypto.createHash('sha256');
  const content = fs.readFileSync(filePath);
  hash.update(content);
  return hash.digest('hex');
}

async function run() {
  const baseUrl = normalizeBaseUrl(readEnv('API_BASE_URL', 'http://localhost:3001'));
  const token = readRequiredEnv('API_BEARER_TOKEN');
  const userId = readRequiredEnv('E2E_USER_ID');
  const vmUuid = (readEnv('E2E_VM_UUID', createRandomVmUuid()) || createRandomVmUuid()).toLowerCase();
  const moduleName = readEnv('E2E_MODULE', 'runner-installer');
  const platform = readEnv('E2E_PLATFORM', 'windows');
  const channel = readEnv('E2E_CHANNEL', 'stable');
  const agentId = readEnv('E2E_AGENT_ID', 'e2e-agent');
  const runnerId = readEnv('E2E_RUNNER_ID', 'e2e-runner');
  const releaseId = ensureReleaseId(readEnv('E2E_RELEASE_ID', ''));
  const revokeReason = readEnv('E2E_REVOKE_REASON', 'artifacts-e2e-smoke');

  console.log(`[artifacts-e2e] API=${baseUrl}`);
  console.log(`[artifacts-e2e] user=${userId}, vm=${vmUuid}, module=${moduleName}, platform=${platform}, channel=${channel}`);

  const registerResult = await requestJson({
    baseUrl,
    token,
    method: 'POST',
    endpoint: '/api/v1/vm/register',
    body: {
      vm_uuid: vmUuid,
      user_id: userId,
      vm_name: readEnv('E2E_VM_NAME', 'Bot-Mox E2E VM'),
      status: 'active',
    },
  });
  expectSuccess(registerResult, 201, 'vm/register');
  console.log('[artifacts-e2e] vm/register OK');

  const leaseResult = await requestJson({
    baseUrl,
    token,
    method: 'POST',
    endpoint: '/api/v1/license/lease',
    body: {
      vm_uuid: vmUuid,
      user_id: userId,
      agent_id: agentId,
      runner_id: runnerId,
      module: moduleName,
      version: readEnv('E2E_RUNNER_VERSION', 'e2e'),
    },
  });
  const lease = expectSuccess(leaseResult, 201, 'license/lease');
  console.log(`[artifacts-e2e] license/lease OK (lease_id=${lease.lease_id})`);

  if (releaseId) {
    const assignResult = await requestJson({
      baseUrl,
      token,
      method: 'POST',
      endpoint: '/api/v1/artifacts/assign',
      body: {
        user_id: userId,
        module: moduleName,
        platform,
        channel,
        release_id: releaseId,
      },
    });
    expectSuccess(assignResult, 201, 'artifacts/assign');
    console.log(`[artifacts-e2e] artifacts/assign OK (release_id=${releaseId})`);
  } else {
    console.log('[artifacts-e2e] E2E_RELEASE_ID is not set, using existing assignment');
  }

  const resolveResult = await requestJson({
    baseUrl,
    token,
    method: 'POST',
    endpoint: '/api/v1/artifacts/resolve-download',
    body: {
      lease_token: lease.token,
      vm_uuid: vmUuid,
      module: moduleName,
      platform,
      channel,
    },
  });
  const resolved = expectSuccess(resolveResult, 200, 'artifacts/resolve-download');
  if (!resolved || !resolved.download_url || !resolved.sha256) {
    throw new Error('artifacts/resolve-download returned incomplete payload');
  }
  console.log(`[artifacts-e2e] artifacts/resolve-download OK (release_id=${resolved.release_id}, version=${resolved.version})`);

  const tempFile = path.join(os.tmpdir(), `bot-mox-artifact-${Date.now()}.bin`);
  try {
    const bytes = await downloadToFile(resolved.download_url, tempFile);
    const actualSha = computeSha256(tempFile);
    const expectedSha = String(resolved.sha256 || '').trim().toLowerCase();
    if (actualSha !== expectedSha) {
      throw new Error(`sha256 mismatch, expected=${expectedSha}, actual=${actualSha}`);
    }
    console.log(`[artifacts-e2e] download+sha256 OK (${bytes} bytes)`);
  } finally {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }

  const wrongVmResult = await requestJson({
    baseUrl,
    token,
    method: 'POST',
    endpoint: '/api/v1/artifacts/resolve-download',
    body: {
      lease_token: lease.token,
      vm_uuid: mutateVmUuid(vmUuid),
      module: moduleName,
      platform,
      channel,
    },
  });
  expectFailure(wrongVmResult, 403, 'VM_UUID_MISMATCH', 'artifacts/resolve-download wrong vm');
  console.log('[artifacts-e2e] negative VM_UUID_MISMATCH OK');

  const wrongModule = `${moduleName}-mismatch`;
  const wrongModuleResult = await requestJson({
    baseUrl,
    token,
    method: 'POST',
    endpoint: '/api/v1/artifacts/resolve-download',
    body: {
      lease_token: lease.token,
      vm_uuid: vmUuid,
      module: wrongModule,
      platform,
      channel,
    },
  });
  expectFailure(wrongModuleResult, 403, 'MODULE_MISMATCH', 'artifacts/resolve-download wrong module');
  console.log('[artifacts-e2e] negative MODULE_MISMATCH OK');

  const revokeResult = await requestJson({
    baseUrl,
    token,
    method: 'POST',
    endpoint: '/api/v1/license/revoke',
    body: {
      lease_id: lease.lease_id,
      reason: revokeReason,
    },
  });
  expectSuccess(revokeResult, 200, 'license/revoke');
  console.log('[artifacts-e2e] license/revoke OK');

  const revokedLeaseResult = await requestJson({
    baseUrl,
    token,
    method: 'POST',
    endpoint: '/api/v1/artifacts/resolve-download',
    body: {
      lease_token: lease.token,
      vm_uuid: vmUuid,
      module: moduleName,
      platform,
      channel,
    },
  });
  expectFailure(revokedLeaseResult, 409, 'LEASE_INACTIVE', 'artifacts/resolve-download revoked lease');
  console.log('[artifacts-e2e] negative LEASE_INACTIVE OK');

  console.log('[artifacts-e2e] SUCCESS');
}

run().catch((error) => {
  console.error(`[artifacts-e2e] FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
