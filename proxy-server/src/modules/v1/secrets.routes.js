const express = require('express');
const { success, failure } = require('../../contracts/envelope');
const {
  secretCreateSchema,
  secretRotateSchema,
  secretBindingCreateSchema,
} = require('../../contracts/schemas');
const { asyncHandler } = require('./helpers');
const { SecretsServiceError } = require('../secrets/service');

function withSecretsErrors(handler) {
  return asyncHandler(async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      if (error instanceof SecretsServiceError) {
        return res.status(error.status).json(failure(error.code, error.message, error.details));
      }
      throw error;
    }
  });
}

function createSecretsRoutes({ secretsService, authMiddleware }) {
  const router = express.Router();

  // POST /api/v1/secrets — store a new ciphertext secret (never returns plaintext)
  router.post(
    '/',
    withSecretsErrors(async (req, res) => {
      const parsed = secretCreateSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid request body', parsed.error.flatten()));
      }

      const auth = req.auth || {};
      const data = await secretsService.createSecret({
        tenantId: auth.tenant_id,
        label: parsed.data.label,
        ciphertext: parsed.data.ciphertext,
        alg: parsed.data.alg,
        keyId: parsed.data.key_id,
        nonce: parsed.data.nonce,
        aadMeta: parsed.data.aad_meta,
        createdBy: auth.uid,
      });

      return res.status(201).json(success(data));
    })
  );

  // GET /api/v1/secrets/:id/meta — get secret metadata only (no ciphertext)
  router.get(
    '/:id/meta',
    withSecretsErrors(async (req, res) => {
      const secretId = String(req.params.id || '').trim();
      if (!secretId) {
        return res.status(400).json(failure('BAD_REQUEST', 'Secret ID is required'));
      }

      const auth = req.auth || {};
      const data = await secretsService.getSecretMeta({
        tenantId: auth.tenant_id,
        secretId,
      });

      return res.json(success(data));
    })
  );

  // POST /api/v1/secrets/:id/rotate — rotate secret material
  router.post(
    '/:id/rotate',
    withSecretsErrors(async (req, res) => {
      const secretId = String(req.params.id || '').trim();
      if (!secretId) {
        return res.status(400).json(failure('BAD_REQUEST', 'Secret ID is required'));
      }

      const parsed = secretRotateSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid request body', parsed.error.flatten()));
      }

      const auth = req.auth || {};
      const data = await secretsService.rotateSecret({
        tenantId: auth.tenant_id,
        secretId,
        ciphertext: parsed.data.ciphertext,
        alg: parsed.data.alg,
        keyId: parsed.data.key_id,
        nonce: parsed.data.nonce,
        aadMeta: parsed.data.aad_meta,
      });

      return res.json(success(data));
    })
  );

  // POST /api/v1/secrets/bindings — bind a secret to a scope
  router.post(
    '/bindings',
    withSecretsErrors(async (req, res) => {
      const parsed = secretBindingCreateSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid request body', parsed.error.flatten()));
      }

      const auth = req.auth || {};
      const data = await secretsService.createBinding({
        tenantId: auth.tenant_id,
        scopeType: parsed.data.scope_type,
        scopeId: parsed.data.scope_id,
        secretRef: parsed.data.secret_ref,
        fieldName: parsed.data.field_name,
      });

      return res.status(201).json(success(data));
    })
  );

  // GET /api/v1/secrets/bindings — list bindings for a scope
  router.get(
    '/bindings',
    withSecretsErrors(async (req, res) => {
      const auth = req.auth || {};
      const data = await secretsService.listBindings({
        tenantId: auth.tenant_id,
        scopeType: req.query.scope_type,
        scopeId: req.query.scope_id,
      });

      return res.json(success(data));
    })
  );

  return router;
}

module.exports = {
  createSecretsRoutes,
};
