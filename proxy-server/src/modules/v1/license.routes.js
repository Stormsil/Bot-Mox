const express = require('express');
const { success, failure } = require('../../contracts/envelope');
const {
  licenseLeaseRequestSchema,
  licenseHeartbeatSchema,
  licenseRevokeSchema,
} = require('../../contracts/schemas');
const { asyncHandler } = require('./helpers');
const { LicenseServiceError } = require('../license/service');

function hasPrivilegedUserOverrideRole(auth, hasRole) {
  return hasRole(auth, 'infra') || hasRole(auth, 'admin') || hasRole(auth, 'api');
}

function resolveActingUserId(auth, requestedUserId, hasRole) {
  const authUserId = String(auth?.uid || '').trim();
  const explicitUserId = String(requestedUserId || '').trim();

  if (!explicitUserId) {
    if (!authUserId) {
      throw new LicenseServiceError(400, 'BAD_REQUEST', 'user_id is required');
    }
    return authUserId;
  }

  if (!authUserId) {
    return explicitUserId;
  }

  if (explicitUserId === authUserId) {
    return explicitUserId;
  }

  if (!hasPrivilegedUserOverrideRole(auth, hasRole)) {
    throw new LicenseServiceError(403, 'FORBIDDEN', 'user_id override is not allowed');
  }

  return explicitUserId;
}

function withLicenseErrors(handler) {
  return asyncHandler(async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      if (error instanceof LicenseServiceError) {
        return res.status(error.status).json(failure(error.code, error.message, error.details));
      }
      throw error;
    }
  });
}

function createLicenseRoutes({ licenseService, authMiddleware }) {
  const router = express.Router();
  const { requireAnyRole, hasRole } = authMiddleware;

  router.post(
    '/lease',
    withLicenseErrors(async (req, res) => {
      const parsedBody = licenseLeaseRequestSchema.safeParse(req.body || {});
      if (!parsedBody.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid request body', parsedBody.error.flatten()));
      }

      const auth = req.auth || {};
      const actingUserId = resolveActingUserId(auth, parsedBody.data.user_id, hasRole);
      const lease = await licenseService.issueExecutionLease({
        tenantId: auth.tenant_id,
        userId: actingUserId,
        vmUuid: parsedBody.data.vm_uuid,
        agentId: parsedBody.data.agent_id,
        runnerId: parsedBody.data.runner_id,
        moduleName: parsedBody.data.module,
        version: parsedBody.data.version,
      });

      return res.status(201).json(success(lease));
    })
  );

  router.post(
    '/heartbeat',
    withLicenseErrors(async (req, res) => {
      const parsedBody = licenseHeartbeatSchema.safeParse(req.body || {});
      if (!parsedBody.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid request body', parsedBody.error.flatten()));
      }

      const auth = req.auth || {};
      const heartbeat = await licenseService.heartbeatLease({
        tenantId: auth.tenant_id,
        leaseId: parsedBody.data.lease_id,
        userId: auth.uid,
      });

      return res.json(success(heartbeat));
    })
  );

  router.post(
    '/revoke',
    requireAnyRole(['infra', 'admin']),
    withLicenseErrors(async (req, res) => {
      const parsedBody = licenseRevokeSchema.safeParse(req.body || {});
      if (!parsedBody.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid request body', parsedBody.error.flatten()));
      }

      const auth = req.auth || {};
      const revoked = await licenseService.revokeLease({
        tenantId: auth.tenant_id,
        leaseId: parsedBody.data.lease_id,
        actorId: auth.uid,
        reason: parsedBody.data.reason,
      });

      return res.json(success(revoked));
    })
  );

  return router;
}

module.exports = {
  createLicenseRoutes,
};
