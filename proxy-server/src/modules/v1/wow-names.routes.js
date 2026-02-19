const express = require('express');
const { success, failure } = require('../../contracts/envelope');
const { wowNamesQuerySchema } = require('../../contracts/schemas');
const { asyncHandler } = require('./helpers');

function createWowNamesRoutes({ wowNamesService }) {
  const router = express.Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const parsedQuery = wowNamesQuerySchema.safeParse(req.query || {});
      if (!parsedQuery.success) {
        return res
          .status(400)
          .json(failure('BAD_REQUEST', 'Invalid query', parsedQuery.error.flatten()));
      }

      try {
        const payload = await wowNamesService.getWowNames({
          count: parsedQuery.data.count,
          batches: parsedQuery.data.batches,
        });

        if (Number(payload.count || 0) > 0) {
          return res.json(success({ names: payload.names }));
        }

        return res.json(
          success({
            random: payload.random,
            names: payload.names,
            batches: payload.batches,
            source: payload.source,
          }),
        );
      } catch (error) {
        const status = Number(error?.status || 500);
        return res
          .status(status)
          .json(
            failure(
              String(error?.code || 'WOW_NAMES_ERROR'),
              String(error?.message || 'Failed to fetch names'),
            ),
          );
      }
    }),
  );

  return router;
}

module.exports = {
  createWowNamesRoutes,
};
