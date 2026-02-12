const express = require('express');
const { success, failure } = require('../../contracts/envelope');
const { asyncHandler } = require('./helpers');

function toFailurePayload(error, fallbackCode = 'INTERNAL_ERROR', fallbackMessage = 'Internal server error') {
  const status = Number(error?.status || 500);
  const code = String(error?.code || fallbackCode);
  const message = String(error?.message || fallbackMessage);
  const details = error?.details;
  return {
    status,
    payload: failure(code, message, details),
  };
}

function createIpqsRoutes({ ipqsService }) {
  const router = express.Router();

  router.get(
    '/status',
    asyncHandler(async (_req, res) => {
      const state = await ipqsService.getStatus();
      return res.json(success(state));
    })
  );

  router.post(
    '/check',
    asyncHandler(async (req, res) => {
      try {
        const ip = req.body?.ip;
        const data = await ipqsService.checkIp(ip);
        return res.json(success(data));
      } catch (error) {
        const normalized = toFailurePayload(error, 'IPQS_CHECK_FAILED', 'Failed to check IP');
        return res.status(normalized.status).json(normalized.payload);
      }
    })
  );

  router.post(
    '/check-batch',
    asyncHandler(async (req, res) => {
      try {
        const ips = req.body?.ips;
        const data = await ipqsService.checkIpBatch(ips);
        return res.json(success(data));
      } catch (error) {
        const normalized = toFailurePayload(error, 'IPQS_BATCH_FAILED', 'Failed to check IP batch');
        return res.status(normalized.status).json(normalized.payload);
      }
    })
  );

  return router;
}

module.exports = {
  createIpqsRoutes,
};
