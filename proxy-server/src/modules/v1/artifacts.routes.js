const express = require('express');
const { success, failure } = require('../../contracts/envelope');
const {
  artifactReleaseCreateSchema,
  artifactAssignSchema,
  artifactResolveDownloadSchema,
} = require('../../contracts/schemas');
const { asyncHandler } = require('./helpers');
const { ArtifactsServiceError } = require('../artifacts/service');

function withArtifactsErrors(handler) {
  return asyncHandler(async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      if (error instanceof ArtifactsServiceError) {
        return res.status(error.status).json(failure(error.code, error.message, error.details));
      }
      throw error;
    }
  });
}

function extractClientIp(req) {
  const xff = String(req?.headers?.['x-forwarded-for'] || '').trim();
  if (xff) {
    return xff.split(',')[0].trim();
  }
  return String(req?.ip || req?.socket?.remoteAddress || '').trim();
}

function createArtifactsRoutes({ artifactsService, authMiddleware }) {
  const router = express.Router();
  const { requireAnyRole } = authMiddleware;

  if (!artifactsService?.enabled) {
    const reason = artifactsService?.reason || 'Artifacts service is not configured';
    router.use((_req, res) => {
      return res.status(503).json(failure('ARTIFACTS_CONFIG_ERROR', reason));
    });
    return router;
  }

  router.post(
    '/releases',
    requireAnyRole(['infra', 'admin']),
    withArtifactsErrors(async (req, res) => {
      const parsedBody = artifactReleaseCreateSchema.safeParse(req.body || {});
      if (!parsedBody.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid request body', parsedBody.error.flatten()));
      }

      const auth = req.auth || {};
      const release = await artifactsService.createRelease({
        tenantId: auth.tenant_id,
        actorId: auth.uid,
        payload: parsedBody.data,
      });

      return res.status(201).json(success(release));
    })
  );

  router.post(
    '/assign',
    requireAnyRole(['infra', 'admin']),
    withArtifactsErrors(async (req, res) => {
      const parsedBody = artifactAssignSchema.safeParse(req.body || {});
      if (!parsedBody.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid request body', parsedBody.error.flatten()));
      }

      const auth = req.auth || {};
      const assignment = await artifactsService.upsertAssignment({
        tenantId: auth.tenant_id,
        actorId: auth.uid,
        payload: parsedBody.data,
      });

      return res.status(201).json(success(assignment));
    })
  );

  router.get(
    '/assign/:userId/:module',
    requireAnyRole(['infra', 'admin']),
    withArtifactsErrors(async (req, res) => {
      const userId = String(req.params?.userId || '').trim();
      const module = String(req.params?.module || '').trim();
      const platform = String(req.query?.platform || '').trim() || 'windows';
      const channel = String(req.query?.channel || '').trim() || 'stable';

      if (!userId || !module) {
        return res.status(400).json(
          failure('BAD_REQUEST', 'userId and module path params are required')
        );
      }

      const auth = req.auth || {};
      const assignment = await artifactsService.getEffectiveAssignment({
        tenantId: auth.tenant_id,
        userId,
        module,
        platform,
        channel,
      });

      return res.json(success(assignment));
    })
  );

  router.post(
    '/resolve-download',
    withArtifactsErrors(async (req, res) => {
      const parsedBody = artifactResolveDownloadSchema.safeParse(req.body || {});
      if (!parsedBody.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid request body', parsedBody.error.flatten()));
      }

      const auth = req.auth || {};
      const payload = await artifactsService.resolveDownload({
        tenantId: auth.tenant_id,
        actorId: auth.uid,
        leaseToken: parsedBody.data.lease_token,
        vmUuid: parsedBody.data.vm_uuid,
        module: parsedBody.data.module,
        platform: parsedBody.data.platform,
        channel: parsedBody.data.channel,
        requestIp: extractClientIp(req),
      });

      return res.json(success(payload));
    })
  );

  return router;
}

module.exports = {
  createArtifactsRoutes,
};
