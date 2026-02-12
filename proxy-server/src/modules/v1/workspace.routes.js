const express = require('express');
const {
  idParamSchema,
  workspaceKindParamSchema,
  getWorkspaceCreateSchema,
  getWorkspacePatchSchema,
} = require('../../contracts/schemas');
const { success, failure } = require('../../contracts/envelope');
const { RtdbCollectionRepository } = require('../../repositories/rtdb/rtdb-repository');
const { RTDB_PATHS } = require('../../repositories/rtdb/paths');
const { parseListQuery, applyListQuery, asyncHandler } = require('./helpers');

const WORKSPACE_PATHS = {
  notes: RTDB_PATHS.workspace.notes,
  calendar: RTDB_PATHS.workspace.calendar,
  kanban: RTDB_PATHS.workspace.kanban,
};

function getRepository(admin, kind) {
  const path = WORKSPACE_PATHS[kind];
  if (!path) return null;
  return new RtdbCollectionRepository(admin, path);
}

function createWorkspaceRoutes({ admin }) {
  const router = express.Router();

  router.get(
    '/:kind',
    asyncHandler(async (req, res) => {
      const parsedKind = workspaceKindParamSchema.safeParse(req.params);
      if (!parsedKind.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid workspace kind', parsedKind.error.flatten()));
      }

      const { kind } = parsedKind.data;
      const repo = getRepository(admin, kind);
      if (!repo) {
        return res.status(404).json(failure('NOT_FOUND', `Unknown workspace kind: ${kind}`));
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
      const parsedKind = workspaceKindParamSchema.safeParse(req.params);
      if (!parsedKind.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid workspace kind', parsedKind.error.flatten()));
      }

      const { kind } = parsedKind.data;
      const repo = getRepository(admin, kind);
      if (!repo) {
        return res.status(404).json(failure('NOT_FOUND', `Unknown workspace kind: ${kind}`));
      }

      const parsedId = idParamSchema.safeParse(req.params);
      if (!parsedId.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid workspace id', parsedId.error.flatten()));
      }

      const entity = await repo.getById(parsedId.data.id);
      if (!entity) {
        return res.status(404).json(failure('NOT_FOUND', 'Workspace entity not found'));
      }

      return res.json(success(entity));
    })
  );

  router.post(
    '/:kind',
    asyncHandler(async (req, res) => {
      const parsedKind = workspaceKindParamSchema.safeParse(req.params);
      if (!parsedKind.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid workspace kind', parsedKind.error.flatten()));
      }

      const { kind } = parsedKind.data;
      const repo = getRepository(admin, kind);
      if (!repo) {
        return res.status(404).json(failure('NOT_FOUND', `Unknown workspace kind: ${kind}`));
      }

      const parsedBody = getWorkspaceCreateSchema(kind).safeParse(req.body || {});
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
      const parsedKind = workspaceKindParamSchema.safeParse(req.params);
      if (!parsedKind.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid workspace kind', parsedKind.error.flatten()));
      }

      const { kind } = parsedKind.data;
      const repo = getRepository(admin, kind);
      if (!repo) {
        return res.status(404).json(failure('NOT_FOUND', `Unknown workspace kind: ${kind}`));
      }

      const parsedId = idParamSchema.safeParse(req.params);
      if (!parsedId.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid workspace id', parsedId.error.flatten()));
      }

      const parsedBody = getWorkspacePatchSchema(kind).safeParse(req.body || {});
      if (!parsedBody.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid request body', parsedBody.error.flatten()));
      }

      const updated = await repo.patch(parsedId.data.id, parsedBody.data);
      if (!updated) {
        return res.status(404).json(failure('NOT_FOUND', 'Workspace entity not found'));
      }

      return res.json(success(updated));
    })
  );

  router.delete(
    '/:kind/:id',
    asyncHandler(async (req, res) => {
      const parsedKind = workspaceKindParamSchema.safeParse(req.params);
      if (!parsedKind.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid workspace kind', parsedKind.error.flatten()));
      }

      const { kind } = parsedKind.data;
      const repo = getRepository(admin, kind);
      if (!repo) {
        return res.status(404).json(failure('NOT_FOUND', `Unknown workspace kind: ${kind}`));
      }

      const parsedId = idParamSchema.safeParse(req.params);
      if (!parsedId.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid workspace id', parsedId.error.flatten()));
      }

      const deleted = await repo.remove(parsedId.data.id);
      if (!deleted) {
        return res.status(404).json(failure('NOT_FOUND', 'Workspace entity not found'));
      }

      return res.json(success({ id: parsedId.data.id, deleted: true }));
    })
  );

  return router;
}

module.exports = {
  createWorkspaceRoutes,
};
