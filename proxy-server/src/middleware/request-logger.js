const { logger } = require('../observability/logger');

function requestLogger(req, res, next) {
  const startedAt = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    const timestamp = new Date().toISOString();
    const correlationId = req.correlationId || '-';

    logger.info(
      {
        timestamp,
        correlation_id: correlationId,
        method: req.method,
        path: req.originalUrl,
        status_code: res.statusCode,
        duration_ms: durationMs,
      },
      'request',
    );
  });

  next();
}

module.exports = {
  requestLogger,
};
