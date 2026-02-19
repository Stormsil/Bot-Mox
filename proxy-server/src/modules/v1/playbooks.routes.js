const express = require('express');
const { success, failure } = require('../../contracts/envelope');
const {
  idParamSchema,
  playbookCreateSchema,
  playbookUpdateSchema,
  playbookValidateBodySchema,
} = require('../../contracts/schemas');
const { asyncHandler } = require('./helpers');
const { PlaybookServiceError } = require('../playbooks/service');

function withPlaybookErrors(handler) {
  return asyncHandler(async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      if (error instanceof PlaybookServiceError) {
        return res.status(error.status).json(failure(error.code, error.message, error.details));
      }
      throw error;
    }
  });
}

function createPlaybookRoutes({ playbookService }) {
  const router = express.Router();

  // GET /api/v1/playbooks
  router.get(
    '/',
    withPlaybookErrors(async (req, res) => {
      const auth = req.auth || {};
      const data = await playbookService.listPlaybooks({
        tenantId: auth.tenant_id,
        userId: auth.uid,
      });
      return res.json(success(data));
    }),
  );

  // GET /api/v1/playbooks/:id
  router.get(
    '/:id',
    withPlaybookErrors(async (req, res) => {
      const paramParsed = idParamSchema.safeParse(req.params);
      if (!paramParsed.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid playbook ID'));
      }

      const auth = req.auth || {};
      const data = await playbookService.getPlaybook({
        tenantId: auth.tenant_id,
        userId: auth.uid,
        playbookId: paramParsed.data.id,
      });
      return res.json(success(data));
    }),
  );

  // POST /api/v1/playbooks
  router.post(
    '/',
    withPlaybookErrors(async (req, res) => {
      const parsed = playbookCreateSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res
          .status(400)
          .json(failure('BAD_REQUEST', 'Invalid request body', parsed.error.flatten()));
      }

      const auth = req.auth || {};

      // Validate YAML content
      const validation = playbookService.validatePlaybookContent(parsed.data.content);
      if (!validation.valid) {
        return res.status(422).json(
          failure('INVALID_PLAYBOOK', 'Playbook YAML validation failed', {
            errors: validation.errors,
            warnings: validation.warnings,
          }),
        );
      }

      const data = await playbookService.createPlaybook({
        tenantId: auth.tenant_id,
        userId: auth.uid,
        name: parsed.data.name,
        isDefault: parsed.data.is_default,
        content: parsed.data.content,
      });

      return res.status(201).json(success(data));
    }),
  );

  // PUT /api/v1/playbooks/:id
  router.put(
    '/:id',
    withPlaybookErrors(async (req, res) => {
      const paramParsed = idParamSchema.safeParse(req.params);
      if (!paramParsed.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid playbook ID'));
      }

      const parsed = playbookUpdateSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res
          .status(400)
          .json(failure('BAD_REQUEST', 'Invalid request body', parsed.error.flatten()));
      }

      // Validate YAML if content is being updated
      if (parsed.data.content !== undefined) {
        const validation = playbookService.validatePlaybookContent(parsed.data.content);
        if (!validation.valid) {
          return res.status(422).json(
            failure('INVALID_PLAYBOOK', 'Playbook YAML validation failed', {
              errors: validation.errors,
              warnings: validation.warnings,
            }),
          );
        }
      }

      const auth = req.auth || {};
      const data = await playbookService.updatePlaybook({
        tenantId: auth.tenant_id,
        userId: auth.uid,
        playbookId: paramParsed.data.id,
        updates: parsed.data,
      });

      return res.json(success(data));
    }),
  );

  // DELETE /api/v1/playbooks/:id
  router.delete(
    '/:id',
    withPlaybookErrors(async (req, res) => {
      const paramParsed = idParamSchema.safeParse(req.params);
      if (!paramParsed.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid playbook ID'));
      }

      const auth = req.auth || {};
      await playbookService.deletePlaybook({
        tenantId: auth.tenant_id,
        userId: auth.uid,
        playbookId: paramParsed.data.id,
      });

      return res.json(success({ deleted: true }));
    }),
  );

  // POST /api/v1/playbooks/validate
  router.post(
    '/validate',
    withPlaybookErrors(async (req, res) => {
      const parsed = playbookValidateBodySchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res
          .status(400)
          .json(failure('BAD_REQUEST', 'Invalid request body', parsed.error.flatten()));
      }

      const result = playbookService.validatePlaybookContent(parsed.data.content);
      return res.json(success(result));
    }),
  );

  return router;
}

module.exports = {
  createPlaybookRoutes,
};
