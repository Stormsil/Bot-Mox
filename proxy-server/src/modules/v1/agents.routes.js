const express = require('express');
const { success, failure } = require('../../contracts/envelope');
const {
  agentPairingSchema,
  agentRegisterSchema,
  agentQuickPairSchema,
  agentHeartbeatSchema,
  agentRevokeSchema,
  agentListQuerySchema,
} = require('../../contracts/schemas');
const { asyncHandler } = require('./helpers');
const { AgentServiceError } = require('../agents/service');

function withAgentErrors(handler) {
  return asyncHandler(async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      if (error instanceof AgentServiceError) {
        return res.status(error.status).json(failure(error.code, error.message, error.details));
      }
      throw error;
    }
  });
}

function normalizeHeaderValue(value) {
  if (Array.isArray(value)) return String(value[0] || '').trim();
  return String(value || '').trim();
}

function inferServerBaseUrl(req, env) {
  const envBase = String(env?.agentPairingPublicUrl || '').trim();
  if (envBase) return envBase.replace(/\/+$/, '');

  const forwardedProto = normalizeHeaderValue(req?.headers?.['x-forwarded-proto']).split(',')[0]?.trim();
  const forwardedHost = normalizeHeaderValue(req?.headers?.['x-forwarded-host']).split(',')[0]?.trim();
  const proto = forwardedProto || req?.protocol || 'http';
  const host = forwardedHost || req?.get?.('host') || '';
  if (!host) return '';
  return `${proto}://${host}`.replace(/\/+$/, '');
}

function encodePairingBundle(payload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function sanitizeProxmoxDefaults(value) {
  if (!value || typeof value !== 'object') return null;
  const url = String(value.url || '').trim();
  const username = String(value.username || '').trim();
  const node = String(value.node || '').trim();
  const payload = {};
  if (url) payload.url = url;
  if (username) payload.username = username;
  if (node) payload.node = node;
  return Object.keys(payload).length > 0 ? payload : null;
}

function buildPairingHints({ req, env, pairingCode, proxmoxDefaults }) {
  const serverUrl = inferServerBaseUrl(req, env);
  const safeProxmoxDefaults = sanitizeProxmoxDefaults(proxmoxDefaults);
  const bundlePayload = {
    v: 1,
    pairing_code: String(pairingCode || '').trim(),
    server_url: serverUrl || null,
  };
  if (safeProxmoxDefaults) {
    bundlePayload.proxmox = safeProxmoxDefaults;
  }
  const pairing_bundle = encodePairingBundle(bundlePayload);
  const bundleParam = encodeURIComponent(pairing_bundle);

  const hints = {
    pairing_bundle,
    pairing_uri: `botmox://pair?bundle=${bundleParam}`,
  };

  if (serverUrl) {
    hints.pairing_url = `${serverUrl}/agent/pair?bundle=${bundleParam}`;
    hints.server_url = serverUrl;
  }
  if (safeProxmoxDefaults) {
    hints.proxmox_defaults = safeProxmoxDefaults;
  }

  return hints;
}

function createAgentsRoutes({ agentService, authMiddleware, env }) {
  const router = express.Router();
  const { requireAnyRole, hasRole } = authMiddleware;

  function isAgentAuth(req) {
    return req?.auth?.source === 'agent';
  }

  function isPrivileged(auth) {
    return hasRole(auth, 'admin') || hasRole(auth, 'infra');
  }

  // POST /api/v1/agents/pairings — create a new pairing code for current user (or explicit owner for admin/infra)
  router.post(
    '/pairings',
    requireAnyRole(['api', 'admin', 'infra']),
    withAgentErrors(async (req, res) => {
      const parsed = agentPairingSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid request body', parsed.error.flatten()));
      }

      const auth = req.auth || {};
      const privileged = isPrivileged(auth);
      const requestedOwnerUserId = String(parsed.data.owner_user_id || '').trim();
      if (requestedOwnerUserId && !privileged && requestedOwnerUserId !== String(auth.uid || '').trim()) {
        return res.status(403).json(failure('FORBIDDEN', 'owner_user_id override is not allowed'));
      }
      const defaultOwnerUserId = String(auth.uid || '').trim();
      const effectiveOwnerUserId = requestedOwnerUserId || defaultOwnerUserId || null;
      if (!effectiveOwnerUserId) {
        return res.status(400).json(failure(
          'BAD_REQUEST',
          'owner_user_id is required (or must be resolvable from authenticated user context)'
        ));
      }

      const data = await agentService.createPairing({
        tenantId: auth.tenant_id,
        name: parsed.data.name,
        expiresInMinutes: parsed.data.expires_in_minutes,
        ownerUserId: effectiveOwnerUserId,
      });

      const hints = buildPairingHints({
        req,
        env,
        pairingCode: data?.pairing_code,
        proxmoxDefaults: data?.proxmox_defaults,
      });

      return res.status(201).json(success({
        ...data,
        ...hints,
      }));
    })
  );

  // POST /api/v1/agents/register — register agent using pairing code
  router.post(
    '/register',
    withAgentErrors(async (req, res) => {
      const parsed = agentRegisterSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid request body', parsed.error.flatten()));
      }

      const auth = req.auth || {};
      const data = await agentService.registerAgent({
        pairingCode: parsed.data.pairing_code,
        machineName: parsed.data.machine_name,
        version: parsed.data.version,
        platform: parsed.data.platform,
        capabilities: parsed.data.capabilities,
        pairedBy: auth.uid,
      });

      return res.status(201).json(success(data));
    })
  );

  // POST /api/v1/agents/quick-pair — login/password -> hidden pairing + register
  router.post(
    '/quick-pair',
    withAgentErrors(async (req, res) => {
      const parsed = agentQuickPairSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid request body', parsed.error.flatten()));
      }

      const data = await agentService.quickPairWithCredentials({
        login: parsed.data.login,
        password: parsed.data.password,
        machineName: parsed.data.machine_name,
        version: parsed.data.version,
        platform: parsed.data.platform,
        capabilities: parsed.data.capabilities,
        name: parsed.data.name,
      });

      return res.status(201).json(success(data));
    })
  );

  // POST /api/v1/agents/heartbeat — agent heartbeat
  router.post(
    '/heartbeat',
    withAgentErrors(async (req, res) => {
      const parsed = agentHeartbeatSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid request body', parsed.error.flatten()));
      }

      const auth = req.auth || {};
      if (isAgentAuth(req) && String(parsed.data.agent_id).trim() !== String(auth.agent_id || '').trim()) {
        return res.status(403).json(failure('FORBIDDEN', 'Agent token can only heartbeat for itself'));
      }

      const data = await agentService.heartbeat({
        tenantId: auth.tenant_id,
        agentId: parsed.data.agent_id,
      });

      return res.json(success(data));
    })
  );

  // GET /api/v1/agents — list agents for tenant
  router.get(
    '/',
    withAgentErrors(async (req, res) => {
      if (isAgentAuth(req)) {
        return res.status(403).json(failure('FORBIDDEN', 'Agent token cannot list agents'));
      }

      const parsed = agentListQuerySchema.safeParse(req.query || {});
      if (!parsed.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid query', parsed.error.flatten()));
      }

      const auth = req.auth || {};
      const privileged = isPrivileged(auth);
      const data = await agentService.listAgents({
        tenantId: auth.tenant_id,
        status: parsed.data.status,
        requesterUserId: auth.uid,
        includeAll: privileged,
      });

      return res.json(success(data));
    })
  );

  // GET /api/v1/agents/:id — get single agent
  router.get(
    '/:id',
    withAgentErrors(async (req, res) => {
      if (isAgentAuth(req)) {
        return res.status(403).json(failure('FORBIDDEN', 'Agent token cannot read agent directory'));
      }

      const agentId = String(req.params.id || '').trim();
      if (!agentId) {
        return res.status(400).json(failure('BAD_REQUEST', 'Agent ID is required'));
      }

      const auth = req.auth || {};
      const privileged = isPrivileged(auth);
      const data = await agentService.getAgent({
        tenantId: auth.tenant_id,
        agentId,
        requesterUserId: auth.uid,
        includeAll: privileged,
      });

      return res.json(success(data));
    })
  );

  // POST /api/v1/agents/:id/revoke — revoke an agent (admin/infra only)
  router.post(
    '/:id/revoke',
    requireAnyRole(['admin', 'infra']),
    withAgentErrors(async (req, res) => {
      const agentId = String(req.params.id || '').trim();
      if (!agentId) {
        return res.status(400).json(failure('BAD_REQUEST', 'Agent ID is required'));
      }

      const parsed = agentRevokeSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid request body', parsed.error.flatten()));
      }

      const auth = req.auth || {};
      const data = await agentService.revokeAgent({
        tenantId: auth.tenant_id,
        agentId,
        revokedBy: auth.uid,
        reason: parsed.data.reason,
      });

      return res.json(success(data));
    })
  );

  return router;
}

module.exports = {
  createAgentsRoutes,
};
