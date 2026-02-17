const { parseBearerToken } = require('../utils/auth-token');
const { createSupabaseServiceClient } = require('../repositories/supabase/client');
const { verifyAgentToken } = require('../utils/agent-token');

const API_ROLES_ALLOWLIST = ['api', 'admin', 'infra'];

function toSupabaseRoles(user = {}, env = {}) {
  const roles = ['api'];

  const email = typeof user.email === 'string' ? user.email.trim().toLowerCase() : '';
  const userId = typeof user.id === 'string' ? user.id.trim() : '';

  const adminEmails = Array.isArray(env?.supabaseAdminEmails) ? env.supabaseAdminEmails : [];
  const adminUserIds = Array.isArray(env?.supabaseAdminUserIds) ? env.supabaseAdminUserIds : [];

  const normalizedAdminEmails = adminEmails
    .map((value) => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
    .filter(Boolean);
  const isAdmin =
    (email && normalizedAdminEmails.includes(email)) ||
    (userId && adminUserIds.some((entry) => String(entry || '').trim() === userId));

  if (isAdmin) {
    roles.push('admin', 'infra');
  }

  const appMetadataRoles = user?.app_metadata?.roles;
  if (Array.isArray(appMetadataRoles)) {
    for (const role of appMetadataRoles) {
      if (typeof role !== 'string') continue;
      const normalized = role.trim();
      if (!normalized) continue;
      if (API_ROLES_ALLOWLIST.includes(normalized)) {
        roles.push(normalized);
      }
    }
  }

  return [...new Set(roles)];
}

function pickTenantIdFromSupabaseUser(user = {}, fallbackTenantId = 'default') {
  const candidates = [
    user?.app_metadata?.tenant_id,
    user?.app_metadata?.tenantId,
    fallbackTenantId,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return 'default';
}

function isLikelyJwt(token) {
  const parts = String(token || '').trim().split('.');
  return parts.length === 3 && parts.every((part) => Boolean(part));
}

function parseTokenFromRequest(req, { allowQueryToken = false } = {}) {
  const headerToken = parseBearerToken(req?.headers?.authorization);
  if (headerToken) return headerToken;

  if (!allowQueryToken) return '';

  const queryTokenRaw = req?.query?.access_token;
  if (typeof queryTokenRaw === 'string' && queryTokenRaw.trim()) {
    return queryTokenRaw.trim();
  }

  const rawUrl = String(req?.url || req?.originalUrl || '').trim();
  if (rawUrl.includes('?')) {
    try {
      const parsedUrl = new URL(rawUrl, 'http://localhost');
      const token = parsedUrl.searchParams.get('access_token');
      if (token) return token.trim();
    } catch {
      // Continue to referer parsing fallback below.
    }
  }

  const referer = String(req?.headers?.referer || req?.headers?.referrer || '').trim();
  if (!referer) return '';
  try {
    const refererUrl = new URL(referer);
    const token = refererUrl.searchParams.get('access_token');
    return token ? token.trim() : '';
  } catch {
    return '';
  }
}

function makeAuthError(status, message, details) {
  const payload = {
    success: false,
    error: {
      code: status === 403 ? 'FORBIDDEN' : 'UNAUTHORIZED',
      message: String(message || 'Authorization failed'),
    },
  };

  if (details !== undefined) {
    payload.error.details = details;
  }

  return {
    ok: false,
    status: Number(status || 401),
    payload,
  };
}

function hasRole(auth, role) {
  const roles = Array.isArray(auth?.roles) ? auth.roles : [];
  return roles.includes(role);
}

function createAuthMiddleware({ env }) {
  const defaultTenantId = String(env?.defaultTenantId || 'default').trim() || 'default';

  async function authenticateSupabaseToken(token) {
    if (!env?.supabaseUrl || !env?.supabaseServiceRoleKey) {
      return null;
    }

    if (!isLikelyJwt(token)) {
      return null;
    }

    const clientResult = createSupabaseServiceClient(env);
    if (!clientResult.ok || !clientResult.client) {
      return null;
    }

    try {
      const { data, error } = await clientResult.client.auth.getUser(token);
      if (error || !data?.user) {
        return null;
      }

      const tenantId = pickTenantIdFromSupabaseUser(data.user, defaultTenantId);

      return {
        ok: true,
        status: 200,
        auth: {
          source: 'supabase',
          uid: data.user.id,
          email: data.user.email || null,
          roles: toSupabaseRoles(data.user, env),
          claims: {
            supabase: data.user,
          },
          tenant_id: tenantId,
        },
      };
    } catch (error) {
      return null;
    }
  }

  function authenticateAgentToken(token) {
    const verified = verifyAgentToken(token, env?.agentAuthSecret);
    if (!verified) {
      return null;
    }

    return {
      ok: true,
      status: 200,
      auth: {
        source: 'agent',
        uid: `agent:${verified.agentId}`,
        email: null,
        roles: ['agent'],
        tenant_id: verified.tenantId,
        agent_id: verified.agentId,
        claims: {
          agent: verified.claims,
        },
      },
    };
  }

  async function authenticateToken(token) {
    if (!token) {
      return makeAuthError(401, 'Bearer token is required');
    }

    const supabaseResult = await authenticateSupabaseToken(token);
    if (supabaseResult?.ok) {
      return supabaseResult;
    }

    const agentResult = authenticateAgentToken(token);
    if (agentResult?.ok) {
      return agentResult;
    }

    return makeAuthError(401, 'Token verification failed');
  }

  async function authenticateRequest(req, options = {}) {
    const token = parseTokenFromRequest(req, options);
    return authenticateToken(token);
  }

  function writeAuthError(res, result) {
    const status = Number(result?.status || 401);
    const payload = result?.payload || makeAuthError(status, 'Authorization failed').payload;
    return res.status(status).json(payload);
  }

  async function authenticate(req, res, next) {
    const result = await authenticateRequest(req, { allowQueryToken: false });
    if (!result.ok) {
      return writeAuthError(res, result);
    }

    req.auth = result.auth;
    return next();
  }

  function requireRole(role) {
    return (req, res, next) => {
      if (hasRole(req.auth, role)) {
        return next();
      }
      return writeAuthError(res, makeAuthError(403, `Role '${role}' is required for this endpoint`));
    };
  }

  function requireAnyRole(roles) {
    const list = Array.isArray(roles) ? roles.filter(Boolean) : [];
    return (req, res, next) => {
      const hasAnyRole = list.some((role) => hasRole(req.auth, role));
      if (hasAnyRole) {
        return next();
      }
      return writeAuthError(res, makeAuthError(403, `One of roles is required: ${list.join(', ')}`));
    };
  }

  return {
    authenticate,
    requireRole,
    requireAnyRole,
    hasRole,
    authenticateRequest,
    writeAuthError,
    makeAuthError,
  };
}

module.exports = {
  createAuthMiddleware,
};
