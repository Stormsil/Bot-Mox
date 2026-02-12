const express = require('express');
const { success, failure } = require('../../contracts/envelope');
const { asyncHandler } = require('./helpers');

function createWowNamesRoutes({ wowNamesService }) {
  const router = express.Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      try {
        const payload = await wowNamesService.getWowNames({
          count: req.query?.count,
          batches: req.query?.batches,
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
          })
        );
      } catch (error) {
        const status = Number(error?.status || 500);
        return res
          .status(status)
          .json(failure(String(error?.code || 'WOW_NAMES_ERROR'), String(error?.message || 'Failed to fetch names')));
      }
    })
  );

  return router;
}

module.exports = {
  createWowNamesRoutes,
};
