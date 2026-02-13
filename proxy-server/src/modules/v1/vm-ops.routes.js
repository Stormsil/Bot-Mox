const express = require('express');
const { success, failure } = require('../../contracts/envelope');
const {
  vmOpsCommandSchema,
  agentCommandCreateSchema,
  agentCommandUpdateSchema,
} = require('../../contracts/schemas');
const { asyncHandler } = require('./helpers');
const { VmOpsServiceError } = require('../vm-ops/service');

function withVmOpsErrors(handler) {
  return asyncHandler(async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      if (error instanceof VmOpsServiceError) {
        return res.status(error.status).json(failure(error.code, error.message, error.details));
      }
      throw error;
    }
  });
}

function createVmOpsRoutes({ vmOpsService, authMiddleware }) {
  const router = express.Router();
  const { requireAnyRole } = authMiddleware;

  // POST /api/v1/vm-ops/proxmox/:action — dispatch proxmox command through agent
  router.post(
    '/proxmox/:action',
    withVmOpsErrors(async (req, res) => {
      const action = String(req.params.action || '').trim();
      if (!action) {
        return res.status(400).json(failure('BAD_REQUEST', 'Action is required'));
      }

      const parsed = vmOpsCommandSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid request body', parsed.error.flatten()));
      }

      const auth = req.auth || {};
      const data = await vmOpsService.dispatchCommand({
        tenantId: auth.tenant_id,
        agentId: parsed.data.agent_id,
        commandType: `proxmox.${action}`,
        payload: parsed.data.params,
        createdBy: auth.uid,
      });

      return res.status(202).json(success(data));
    })
  );

  // POST /api/v1/vm-ops/syncthing/:action — dispatch syncthing command through agent
  router.post(
    '/syncthing/:action',
    withVmOpsErrors(async (req, res) => {
      const action = String(req.params.action || '').trim();
      if (!action) {
        return res.status(400).json(failure('BAD_REQUEST', 'Action is required'));
      }

      const parsed = vmOpsCommandSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid request body', parsed.error.flatten()));
      }

      const auth = req.auth || {};
      const data = await vmOpsService.dispatchCommand({
        tenantId: auth.tenant_id,
        agentId: parsed.data.agent_id,
        commandType: `syncthing.${action}`,
        payload: parsed.data.params,
        createdBy: auth.uid,
      });

      return res.status(202).json(success(data));
    })
  );

  // POST /api/v1/vm-ops/commands — dispatch arbitrary command (admin/infra only)
  router.post(
    '/commands',
    requireAnyRole(['admin', 'infra']),
    withVmOpsErrors(async (req, res) => {
      const parsed = agentCommandCreateSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid request body', parsed.error.flatten()));
      }

      const auth = req.auth || {};
      const data = await vmOpsService.dispatchCommand({
        tenantId: auth.tenant_id,
        agentId: parsed.data.agent_id,
        commandType: parsed.data.command_type,
        payload: parsed.data.payload,
        expiresInSeconds: parsed.data.expires_in_seconds,
        createdBy: auth.uid,
      });

      return res.status(202).json(success(data));
    })
  );

  // GET /api/v1/vm-ops/commands/:id — get command status
  router.get(
    '/commands/:id',
    withVmOpsErrors(async (req, res) => {
      const commandId = String(req.params.id || '').trim();
      if (!commandId) {
        return res.status(400).json(failure('BAD_REQUEST', 'Command ID is required'));
      }

      const auth = req.auth || {};
      const data = await vmOpsService.getCommandStatus({
        tenantId: auth.tenant_id,
        commandId,
      });

      return res.json(success(data));
    })
  );

  // PATCH /api/v1/vm-ops/commands/:id — update command status (from agent)
  router.patch(
    '/commands/:id',
    withVmOpsErrors(async (req, res) => {
      const commandId = String(req.params.id || '').trim();
      if (!commandId) {
        return res.status(400).json(failure('BAD_REQUEST', 'Command ID is required'));
      }

      const parsed = agentCommandUpdateSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid request body', parsed.error.flatten()));
      }

      const auth = req.auth || {};
      const data = await vmOpsService.updateCommandStatus({
        tenantId: auth.tenant_id,
        commandId,
        status: parsed.data.status,
        result: parsed.data.result,
        errorMessage: parsed.data.error_message,
      });

      return res.json(success(data));
    })
  );

  // GET /api/v1/vm-ops/commands — list commands
  router.get(
    '/commands',
    withVmOpsErrors(async (req, res) => {
      const auth = req.auth || {};
      const data = await vmOpsService.listAgentCommands({
        tenantId: auth.tenant_id,
        agentId: req.query.agent_id,
        status: req.query.status,
      });

      return res.json(success(data));
    })
  );

  return router;
}

module.exports = {
  createVmOpsRoutes,
};
