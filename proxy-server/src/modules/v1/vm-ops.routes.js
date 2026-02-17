const express = require('express');
const { success, failure } = require('../../contracts/envelope');
const {
  vmOpsCommandSchema,
  agentCommandCreateSchema,
  agentCommandUpdateSchema,
} = require('../../contracts/schemas');
const { asyncHandler } = require('./helpers');
const { VmOpsServiceError } = require('../vm-ops/service');
const {
  subscribeVmOpsCommandEvents,
  listVmOpsCommandEventsSince,
} = require('../vm-ops/events-bus');

const SSE_HEARTBEAT_MS = 25_000;

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
  const { requireAnyRole, hasRole } = authMiddleware;

  function isAgentAuth(req) {
    return req?.auth?.source === 'agent';
  }

  function isPrivileged(auth) {
    return hasRole(auth, 'admin') || hasRole(auth, 'infra');
  }

  function normalizeQueryString(value) {
    return String(value || '').trim();
  }

  function normalizeLastEventId(value) {
    const parsed = Number.parseInt(String(value || '').trim(), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }
    return parsed;
  }

  function canReceiveVmOpsEvent({
    event,
    auth,
    privileged,
    requestSource,
    requestedAgentId,
    requestedCommandId,
  }) {
    if (!event || typeof event !== 'object') {
      return false;
    }

    const eventTenantId = String(event.tenant_id || '').trim() || 'default';
    if (eventTenantId !== String(auth.tenant_id || '').trim()) {
      return false;
    }

    const command = event.command && typeof event.command === 'object' ? event.command : null;
    if (!command) {
      return false;
    }

    const commandAgentId = String(command.agent_id || '').trim();
    if (requestedAgentId && commandAgentId !== requestedAgentId) {
      return false;
    }

    const commandId = String(command.id || '').trim();
    if (requestedCommandId && commandId !== requestedCommandId) {
      return false;
    }

    if (requestSource === 'agent') {
      return commandAgentId === String(auth.agent_id || '').trim();
    }

    if (privileged) {
      return true;
    }

    const createdBy = String(command.created_by || '').trim();
    const requesterUserId = String(auth.uid || '').trim();
    return Boolean(createdBy && requesterUserId && createdBy === requesterUserId);
  }

  // POST /api/v1/vm-ops/proxmox/:action — dispatch proxmox command through agent
  router.post(
    '/proxmox/:action',
    withVmOpsErrors(async (req, res) => {
      if (isAgentAuth(req)) {
        return res.status(403).json(failure('FORBIDDEN', 'Agent token cannot dispatch commands'));
      }

      const action = String(req.params.action || '').trim();
      if (!action) {
        return res.status(400).json(failure('BAD_REQUEST', 'Action is required'));
      }

      const parsed = vmOpsCommandSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid request body', parsed.error.flatten()));
      }

      const auth = req.auth || {};
      const privileged = isPrivileged(auth);
      const data = await vmOpsService.dispatchCommand({
        tenantId: auth.tenant_id,
        agentId: parsed.data.agent_id,
        commandType: `proxmox.${action}`,
        payload: parsed.data.params,
        createdBy: auth.uid,
        requesterUserId: auth.uid,
        isPrivileged: privileged,
      });

      return res.status(202).json(success(data));
    })
  );

  // POST /api/v1/vm-ops/syncthing/:action — dispatch syncthing command through agent
  router.post(
    '/syncthing/:action',
    withVmOpsErrors(async (req, res) => {
      if (isAgentAuth(req)) {
        return res.status(403).json(failure('FORBIDDEN', 'Agent token cannot dispatch commands'));
      }

      const action = String(req.params.action || '').trim();
      if (!action) {
        return res.status(400).json(failure('BAD_REQUEST', 'Action is required'));
      }

      const parsed = vmOpsCommandSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid request body', parsed.error.flatten()));
      }

      const auth = req.auth || {};
      const privileged = isPrivileged(auth);
      const data = await vmOpsService.dispatchCommand({
        tenantId: auth.tenant_id,
        agentId: parsed.data.agent_id,
        commandType: `syncthing.${action}`,
        payload: parsed.data.params,
        createdBy: auth.uid,
        requesterUserId: auth.uid,
        isPrivileged: privileged,
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
      const privileged = isPrivileged(auth);
      const data = await vmOpsService.dispatchCommand({
        tenantId: auth.tenant_id,
        agentId: parsed.data.agent_id,
        commandType: parsed.data.command_type,
        payload: parsed.data.payload,
        expiresInSeconds: parsed.data.expires_in_seconds,
        createdBy: auth.uid,
        requesterUserId: auth.uid,
        isPrivileged: privileged,
      });

      return res.status(202).json(success(data));
    })
  );

  // GET /api/v1/vm-ops/commands/next — long-poll next queued command (agent only)
  router.get(
    '/commands/next',
    withVmOpsErrors(async (req, res) => {
      if (!isAgentAuth(req)) {
        return res.status(403).json(failure('FORBIDDEN', 'Only agent token can request next command'));
      }

      const auth = req.auth || {};
      const requestedAgentId = String(req.query.agent_id || '').trim() || String(auth.agent_id || '').trim();
      if (!requestedAgentId) {
        return res.status(400).json(failure('BAD_REQUEST', 'agent_id is required'));
      }
      if (requestedAgentId !== String(auth.agent_id || '').trim()) {
        return res.status(403).json(failure('FORBIDDEN', 'Agent token can only access its own command queue'));
      }

      const requestedTimeoutMs = Number.parseInt(String(req.query.timeout_ms || '').trim(), 10);
      const timeoutMs = Number.isFinite(requestedTimeoutMs)
        ? Math.max(1_000, Math.min(60_000, requestedTimeoutMs))
        : 25_000;

      const data = await vmOpsService.waitForNextAgentCommand({
        tenantId: auth.tenant_id,
        agentId: requestedAgentId,
        requesterUserId: auth.uid,
        requesterAgentId: auth.agent_id,
        requestSource: auth.source,
        isPrivileged: isPrivileged(auth),
        timeoutMs,
      });

      return res.json(success(data));
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
      const privileged = isPrivileged(auth);
      const data = await vmOpsService.getCommandStatus({
        tenantId: auth.tenant_id,
        commandId,
        agentId: isAgentAuth(req) ? auth.agent_id : undefined,
        requesterUserId: auth.uid,
        isPrivileged: privileged,
        requestSource: auth.source,
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
        agentId: isAgentAuth(req) ? auth.agent_id : undefined,
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
      const requestedAgentId = req.query.agent_id;
      if (isAgentAuth(req) && requestedAgentId && String(requestedAgentId).trim() !== String(auth.agent_id || '').trim()) {
        return res.status(403).json(failure('FORBIDDEN', 'Agent token can only access its own command queue'));
      }
      const effectiveAgentId = isAgentAuth(req) ? auth.agent_id : requestedAgentId;

      const data = await vmOpsService.listAgentCommands({
        tenantId: auth.tenant_id,
        agentId: effectiveAgentId,
        status: req.query.status,
        requesterUserId: auth.uid,
        isPrivileged: isPrivileged(auth),
        requestSource: auth.source,
      });

      return res.json(success(data));
    })
  );

  // GET /api/v1/vm-ops/events — SSE stream for VM command status updates
  router.get(
    '/events',
    withVmOpsErrors(async (req, res) => {
      const auth = req.auth || {};
      const privileged = isPrivileged(auth);
      const requestedAgentId = normalizeQueryString(req.query.agent_id);
      const requestedCommandId = normalizeQueryString(req.query.command_id);
      const lastEventId = normalizeLastEventId(req.query.last_event_id);
      const requestSource = String(auth.source || 'user').trim() || 'user';

      if (isAgentAuth(req) && requestedAgentId && requestedAgentId !== String(auth.agent_id || '').trim()) {
        return res.status(403).json(failure('FORBIDDEN', 'Agent token can only access its own command queue'));
      }

      if (requestedAgentId) {
        await vmOpsService.ensureAgentAccess({
          tenantId: auth.tenant_id,
          agentId: requestedAgentId,
          requesterUserId: auth.uid,
          requesterAgentId: auth.agent_id,
          isPrivileged: privileged,
          requestSource,
        });
      }

      const writeSseEvent = (event) => {
        const payload = JSON.stringify({
          event_id: event.event_id,
          event_type: event.event_type,
          tenant_id: event.tenant_id,
          command: event.command,
          server_time: event.server_time,
        });
        res.write(`id: ${event.event_id}\n`);
        res.write('event: vm-command\n');
        res.write(`data: ${payload}\n\n`);
      };

      const writeSseComment = (comment) => {
        res.write(`: ${String(comment || '').replace(/\r?\n/g, ' ')}\n\n`);
      };

      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
      }

      writeSseComment('connected');

      if (lastEventId) {
        const replay = listVmOpsCommandEventsSince(lastEventId);
        for (const event of replay) {
          if (!canReceiveVmOpsEvent({
            event,
            auth,
            privileged,
            requestSource,
            requestedAgentId,
            requestedCommandId,
          })) {
            continue;
          }
          writeSseEvent(event);
        }
      }

      const unsubscribe = subscribeVmOpsCommandEvents((event) => {
        if (!canReceiveVmOpsEvent({
          event,
          auth,
          privileged,
          requestSource,
          requestedAgentId,
          requestedCommandId,
        })) {
          return;
        }
        writeSseEvent(event);
      });

      const heartbeat = setInterval(() => {
        writeSseComment('heartbeat');
      }, SSE_HEARTBEAT_MS);

      const cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };

      req.on('close', cleanup);
      req.on('aborted', cleanup);
      res.on('close', cleanup);
      res.on('finish', cleanup);
    })
  );

  return router;
}

module.exports = {
  createVmOpsRoutes,
};
