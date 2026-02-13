const express = require('express');
const {
  idParamSchema,
  financeOperationCreateSchema,
  financeOperationPatchSchema,
} = require('../../contracts/schemas');
const { success, failure } = require('../../contracts/envelope');
const { parseListQuery, applyListQuery, asyncHandler } = require('./helpers');

function createFinanceRoutes({ repo }) {
  const router = express.Router();

  router.get(
    '/operations',
    asyncHandler(async (req, res) => {
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
    '/operations/:id',
    asyncHandler(async (req, res) => {
      const parsedId = idParamSchema.safeParse(req.params);
      if (!parsedId.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid operation id', parsedId.error.flatten()));
      }

      const operation = await repo.getById(parsedId.data.id);
      if (!operation) {
        return res.status(404).json(failure('NOT_FOUND', 'Finance operation not found'));
      }

      return res.json(success(operation));
    })
  );

  router.post(
    '/operations',
    asyncHandler(async (req, res) => {
      const parsedBody = financeOperationCreateSchema.safeParse(req.body || {});
      if (!parsedBody.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid request body', parsedBody.error.flatten()));
      }

      const explicitId = typeof req.body?.id === 'string' ? req.body.id.trim() : '';
      const created = await repo.create(parsedBody.data, explicitId || undefined);
      return res.status(201).json(success(created));
    })
  );

  router.patch(
    '/operations/:id',
    asyncHandler(async (req, res) => {
      const parsedId = idParamSchema.safeParse(req.params);
      if (!parsedId.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid operation id', parsedId.error.flatten()));
      }

      const parsedBody = financeOperationPatchSchema.safeParse(req.body || {});
      if (!parsedBody.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid request body', parsedBody.error.flatten()));
      }

      const updated = await repo.patch(parsedId.data.id, parsedBody.data);
      if (!updated) {
        return res.status(404).json(failure('NOT_FOUND', 'Finance operation not found'));
      }

      return res.json(success(updated));
    })
  );

  router.delete(
    '/operations/:id',
    asyncHandler(async (req, res) => {
      const parsedId = idParamSchema.safeParse(req.params);
      if (!parsedId.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid operation id', parsedId.error.flatten()));
      }

      const removed = await repo.remove(parsedId.data.id);
      if (!removed) {
        return res.status(404).json(failure('NOT_FOUND', 'Finance operation not found'));
      }

      return res.json(success({ id: parsedId.data.id, deleted: true }));
    })
  );

  router.get(
    '/daily-stats',
    asyncHandler(async (_req, res) => {
      const stats = await repo.getDailyStats();
      return res.json(success(stats));
    })
  );

  router.get(
    '/gold-price-history',
    asyncHandler(async (_req, res) => {
      const history = await repo.getGoldPriceHistory();
      return res.json(success(history));
    })
  );

  return router;
}

module.exports = {
  createFinanceRoutes,
};
