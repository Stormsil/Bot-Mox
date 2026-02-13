const express = require('express');
const { success, failure } = require('../../contracts/envelope');
const {
  agentPairingSchema,
  agentRegisterSchema,
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

function createAgentsRoutes({ agentService, authMiddleware }) {
  const router = express.Router();
  const { requireAnyRole } = authMiddleware;

  // POST /api/v1/agents/pairings — create a new pairing code (admin/infra only)
  router.post(
    '/pairings',
    requireAnyRole(['admin', 'infra']),
    withAgentErrors(async (req, res) => {
      const parsed = agentPairingSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid request body', parsed.error.flatten()));
      }

      const auth = req.auth || {};
      const data = await agentService.createPairing({
        tenantId: auth.tenant_id,
        name: parsed.data.name,
        expiresInMinutes: parsed.data.expires_in_minutes,
      });

      return res.status(201).json(success(data));
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
        version: parsed.data.version,
        platform: parsed.data.platform,
        capabilities: parsed.data.capabilities,
        pairedBy: auth.uid,
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
      const parsed = agentListQuerySchema.safeParse(req.query || {});
      if (!parsed.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid query', parsed.error.flatten()));
      }

      const auth = req.auth || {};
      const data = await agentService.listAgents({
        tenantId: auth.tenant_id,
        status: parsed.data.status,
      });

      return res.json(success(data));
    })
  );

  // GET /api/v1/agents/:id — get single agent
  router.get(
    '/:id',
    withAgentErrors(async (req, res) => {
      const agentId = String(req.params.id || '').trim();
      if (!agentId) {
        return res.status(400).json(failure('BAD_REQUEST', 'Agent ID is required'));
      }

      const auth = req.auth || {};
      const data = await agentService.getAgent({
        tenantId: auth.tenant_id,
        agentId,
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
