const express = require('express');
const { success, failure } = require('../../contracts/envelope');
const { vmRegisterSchema, vmResolveParamSchema } = require('../../contracts/schemas');
const { asyncHandler } = require('./helpers');
const { VmRegistryServiceError } = require('../vm-registry/service');

function hasPrivilegedUserOverrideRole(auth) {
  const roles = Array.isArray(auth?.roles) ? auth.roles : [];
  return roles.includes('infra') || roles.includes('admin') || roles.includes('api');
}

function resolveActingUserId(auth, requestedUserId) {
  const authUserId = String(auth?.uid || '').trim();
  const explicitUserId = String(requestedUserId || '').trim();

  if (!explicitUserId) {
    if (!authUserId) {
      throw new VmRegistryServiceError(400, 'BAD_REQUEST', 'user_id is required');
    }
    return authUserId;
  }

  if (!authUserId) {
    return explicitUserId;
  }

  if (explicitUserId === authUserId) {
    return explicitUserId;
  }

  if (!hasPrivilegedUserOverrideRole(auth)) {
    throw new VmRegistryServiceError(403, 'FORBIDDEN', 'user_id override is not allowed');
  }

  return explicitUserId;
}

function withVmRegistryErrors(handler) {
  return asyncHandler(async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      if (error instanceof VmRegistryServiceError) {
        return res.status(error.status).json(failure(error.code, error.message, error.details));
      }
      throw error;
    }
  });
}

function createVmRoutes({ vmRegistryService }) {
  const router = express.Router();

  router.post(
    '/register',
    withVmRegistryErrors(async (req, res) => {
      const parsedBody = vmRegisterSchema.safeParse(req.body || {});
      if (!parsedBody.success) {
        return res
          .status(400)
          .json(failure('BAD_REQUEST', 'Invalid request body', parsedBody.error.flatten()));
      }

      const auth = req.auth || {};
      const actingUserId = resolveActingUserId(auth, parsedBody.data.user_id);
      const payload = await vmRegistryService.registerVm({
        tenantId: auth.tenant_id,
        userId: actingUserId,
        vmUuid: parsedBody.data.vm_uuid,
        vmName: parsedBody.data.vm_name,
        projectId: parsedBody.data.project_id,
        status: parsedBody.data.status || 'active',
        metadata: parsedBody.data.metadata,
      });

      return res.status(201).json(success(payload));
    }),
  );

  router.get(
    '/:uuid/resolve',
    withVmRegistryErrors(async (req, res) => {
      const parsedParams = vmResolveParamSchema.safeParse(req.params);
      if (!parsedParams.success) {
        return res
          .status(400)
          .json(failure('BAD_REQUEST', 'Invalid VM UUID', parsedParams.error.flatten()));
      }

      const auth = req.auth || {};
      const vm = await vmRegistryService.resolveVm({
        tenantId: auth.tenant_id,
        vmUuid: parsedParams.data.uuid,
      });

      if (!vm) {
        return res.status(404).json(failure('NOT_FOUND', 'VM UUID not found'));
      }

      return res.json(success(vm));
    }),
  );

  return router;
}

module.exports = {
  createVmRoutes,
};
