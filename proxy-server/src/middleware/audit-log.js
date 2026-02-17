const { logger } = require('../observability/logger');

function normalizeActor(req) {
  const auth = req?.auth || {};
  const roles = Array.isArray(auth.roles)
    ? auth.roles.filter((role) => typeof role === 'string' && role.trim())
    : [];

  return {
    source: auth.source || 'unknown',
    uid: auth.uid || 'anonymous',
    email: auth.email || null,
    roles,
  };
}

function getBodyShape(body) {
  if (body === null || body === undefined) {
    return null;
  }

  if (Array.isArray(body)) {
    return {
      type: 'array',
      length: body.length,
    };
  }

  if (typeof body === 'object') {
    return {
      type: 'object',
      keys: Object.keys(body).slice(0, 20),
    };
  }

  return {
    type: typeof body,
  };
}

function createAuditLogMiddleware(options = {}) {
  const scope = String(options.scope || 'api.audit');
  const methods = Array.isArray(options.methods) && options.methods.length > 0
    ? new Set(options.methods.map((method) => String(method).toUpperCase()))
    : null;

  return function auditLogMiddleware(req, res, next) {
    const method = String(req.method || '').toUpperCase();
    if (methods && !methods.has(method)) {
      return next();
    }

    const startedAt = Date.now();

    res.on('finish', () => {
      const event = {
        timestamp: new Date().toISOString(),
        scope,
        correlationId: req.correlationId || null,
        method,
        path: req.originalUrl || req.url || '',
        statusCode: Number(res.statusCode || 0),
        durationMs: Date.now() - startedAt,
        actor: normalizeActor(req),
        bodyShape: getBodyShape(req.body),
      };

      logger.info({ audit: event }, 'audit');
    });

    return next();
  };
}

module.exports = {
  createAuditLogMiddleware,
};
