const express = require('express');
const {
  idParamSchema,
  resourceKindParamSchema,
  getResourceCreateSchema,
  getResourcePatchSchema,
} = require('../../contracts/schemas');
const { success, failure } = require('../../contracts/envelope');
const { parseListQuery, applyListQuery, asyncHandler } = require('./helpers');

function createResourcesRoutes({ repositories }) {
  const router = express.Router();

  router.get(
    '/:kind',
    asyncHandler(async (req, res) => {
      const parsedKind = resourceKindParamSchema.safeParse(req.params);
      if (!parsedKind.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid resource kind', parsedKind.error.flatten()));
      }

      const { kind } = parsedKind.data;
      const repo = repositories[kind] || null;
      if (!repo) {
        return res.status(404).json(failure('NOT_FOUND', `Unknown resource kind: ${kind}`));
      }

      const parsedQuery = parseListQuery(req.query);
      if (!parsedQuery.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid query parameters', parsedQuery.error.flatten()));
      }

      const items = await repo.list();
      const result = applyListQuery(items, parsedQuery.data);

      return res.json(success(result.items, {
        total: result.total,
        page: result.page,
        limit: result.limit,
      }));
    })
  );

  router.get(
    '/:kind/:id',
    asyncHandler(async (req, res) => {
      const parsedKind = resourceKindParamSchema.safeParse(req.params);
      if (!parsedKind.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid resource kind', parsedKind.error.flatten()));
      }

      const { kind } = parsedKind.data;
      const repo = repositories[kind] || null;
      if (!repo) {
        return res.status(404).json(failure('NOT_FOUND', `Unknown resource kind: ${kind}`));
      }

      const parsedId = idParamSchema.safeParse(req.params);
      if (!parsedId.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid resource id', parsedId.error.flatten()));
      }

      const resource = await repo.getById(parsedId.data.id);
      if (!resource) {
        return res.status(404).json(failure('NOT_FOUND', 'Resource not found'));
      }

      return res.json(success(resource));
    })
  );

  router.post(
    '/:kind',
    asyncHandler(async (req, res) => {
      const parsedKind = resourceKindParamSchema.safeParse(req.params);
      if (!parsedKind.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid resource kind', parsedKind.error.flatten()));
      }

      const { kind } = parsedKind.data;
      const repo = repositories[kind] || null;
      if (!repo) {
        return res.status(404).json(failure('NOT_FOUND', `Unknown resource kind: ${kind}`));
      }

      const parsedBody = getResourceCreateSchema(kind).safeParse(req.body || {});
      if (!parsedBody.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid request body', parsedBody.error.flatten()));
      }

      const explicitId = typeof req.body?.id === 'string' ? req.body.id.trim() : '';
      const created = await repo.create(parsedBody.data, explicitId || undefined);

      return res.status(201).json(success(created));
    })
  );

  router.patch(
    '/:kind/:id',
    asyncHandler(async (req, res) => {
      const parsedKind = resourceKindParamSchema.safeParse(req.params);
      if (!parsedKind.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid resource kind', parsedKind.error.flatten()));
      }

      const { kind } = parsedKind.data;
      const repo = repositories[kind] || null;
      if (!repo) {
        return res.status(404).json(failure('NOT_FOUND', `Unknown resource kind: ${kind}`));
      }

      const parsedId = idParamSchema.safeParse(req.params);
      if (!parsedId.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid resource id', parsedId.error.flatten()));
      }

      const parsedBody = getResourcePatchSchema(kind).safeParse(req.body || {});
      if (!parsedBody.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid request body', parsedBody.error.flatten()));
      }

      const updated = await repo.patch(parsedId.data.id, parsedBody.data);
      if (!updated) {
        return res.status(404).json(failure('NOT_FOUND', 'Resource not found'));
      }

      return res.json(success(updated));
    })
  );

  router.delete(
    '/:kind/:id',
    asyncHandler(async (req, res) => {
      const parsedKind = resourceKindParamSchema.safeParse(req.params);
      if (!parsedKind.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid resource kind', parsedKind.error.flatten()));
      }

      const { kind } = parsedKind.data;
      const repo = repositories[kind] || null;
      if (!repo) {
        return res.status(404).json(failure('NOT_FOUND', `Unknown resource kind: ${kind}`));
      }

      const parsedId = idParamSchema.safeParse(req.params);
      if (!parsedId.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid resource id', parsedId.error.flatten()));
      }

      const deleted = await repo.remove(parsedId.data.id);
      if (!deleted) {
        return res.status(404).json(failure('NOT_FOUND', 'Resource not found'));
      }

      return res.json(success({ id: parsedId.data.id, deleted: true }));
    })
  );

  return router;
}

module.exports = {
  createResourcesRoutes,
};
