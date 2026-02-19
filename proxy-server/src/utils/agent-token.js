const crypto = require('node:crypto');

function base64UrlEncode(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'utf8');
  return buffer.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(value) {
  const normalized = String(value || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padLen = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(normalized + '='.repeat(padLen), 'base64').toString('utf8');
}

function hmacSha256Base64Url(message, secret) {
  return base64UrlEncode(crypto.createHmac('sha256', secret).update(message).digest());
}

function safeJsonParse(text) {
  try {
    return JSON.parse(String(text || ''));
  } catch {
    return null;
  }
}

function signAgentToken({ secret, agentId, tenantId, expiresInSeconds = 60 * 60 * 24 * 30 }) {
  const normalizedSecret = String(secret || '').trim();
  const normalizedAgentId = String(agentId || '').trim();
  const normalizedTenantId = String(tenantId || '').trim() || 'default';
  const ttl = Number.isFinite(Number(expiresInSeconds))
    ? Number(expiresInSeconds)
    : 60 * 60 * 24 * 30;

  if (!normalizedSecret) {
    throw new Error('AGENT_AUTH_SECRET is required');
  }
  if (!normalizedAgentId) {
    throw new Error('agentId is required');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const payload = {
    typ: 'agent',
    sub: `agent:${normalizedAgentId}`,
    aid: normalizedAgentId,
    tid: normalizedTenantId,
    iat: nowSec,
    exp: nowSec + Math.max(60, ttl),
  };
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = hmacSha256Base64Url(signingInput, normalizedSecret);

  return {
    token: `${signingInput}.${signature}`,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
    payload,
  };
}

function verifyAgentToken(token, secret) {
  const normalizedToken = String(token || '').trim();
  const normalizedSecret = String(secret || '').trim();
  if (!normalizedToken || !normalizedSecret) return null;

  const parts = normalizedToken.split('.');
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  if (!encodedHeader || !encodedPayload || !encodedSignature) return null;

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = hmacSha256Base64Url(signingInput, normalizedSecret);

  const sigA = Buffer.from(encodedSignature, 'utf8');
  const sigB = Buffer.from(expectedSignature, 'utf8');
  if (sigA.length !== sigB.length) return null;
  if (!crypto.timingSafeEqual(sigA, sigB)) return null;

  const header = safeJsonParse(base64UrlDecode(encodedHeader));
  const payload = safeJsonParse(base64UrlDecode(encodedPayload));
  if (!header || !payload) return null;
  if (header.alg !== 'HS256') return null;
  if (payload.typ !== 'agent') return null;

  const agentId = String(payload.aid || '').trim();
  const tenantId = String(payload.tid || '').trim();
  const exp = Number(payload.exp || 0);
  const iat = Number(payload.iat || 0);

  if (!agentId || !tenantId) return null;
  if (!Number.isFinite(exp) || !Number.isFinite(iat)) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  if (exp <= nowSec) return null;

  return {
    agentId,
    tenantId,
    iat,
    exp,
    claims: payload,
  };
}

module.exports = {
  signAgentToken,
  verifyAgentToken,
};
