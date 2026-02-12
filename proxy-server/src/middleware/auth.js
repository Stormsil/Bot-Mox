const { parseBearerToken } = require('../utils/auth-token');

function toRoles(decodedToken = {}) {
  const roles = [];

  if (typeof decodedToken.role === 'string' && decodedToken.role.trim()) {
    roles.push(decodedToken.role.trim());
  }

  if (Array.isArray(decodedToken.roles)) {
    for (const role of decodedToken.roles) {
      if (typeof role === 'string' && role.trim()) {
        roles.push(role.trim());
      }
    }
  }

  return [...new Set(roles)];
}

function pickTenantId(decodedToken = {}, fallbackTenantId = 'default') {
  const candidates = [
    decodedToken.tenant_id,
    decodedToken.tenantId,
    decodedToken?.claims?.tenant_id,
    fallbackTenantId,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return 'default';
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

function createAuthMiddleware({ admin, env, isFirebaseReady }) {
  const defaultTenantId = String(env?.defaultTenantId || 'default').trim() || 'default';

  async function authenticateToken(token) {
    if (!token) {
      return makeAuthError(401, 'Bearer token is required');
    }

    if (env.internalInfraToken && token === env.internalInfraToken) {
      return {
        ok: true,
        status: 200,
        auth: {
          source: 'internal',
          uid: 'internal-infra',
          email: 'infra@internal',
          roles: ['infra', 'admin'],
          tenant_id: defaultTenantId,
        },
      };
    }

    if (env.internalApiToken && token === env.internalApiToken) {
      return {
        ok: true,
        status: 200,
        auth: {
          source: 'internal',
          uid: 'internal-api',
          email: 'api@internal',
          roles: ['api'],
          tenant_id: defaultTenantId,
        },
      };
    }

    if (!isFirebaseReady()) {
      return makeAuthError(401, 'Firebase Auth is not available for token verification');
    }

    try {
      const decoded = await admin.auth().verifyIdToken(token);
      const tenantId = pickTenantId(decoded, defaultTenantId);

      return {
        ok: true,
        status: 200,
        auth: {
          source: 'firebase',
          uid: decoded.uid,
          email: decoded.email || null,
          roles: toRoles(decoded),
          claims: decoded,
          tenant_id: tenantId,
        },
      };
    } catch (error) {
      return makeAuthError(401, 'Token verification failed', error instanceof Error ? error.message : String(error));
    }
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
