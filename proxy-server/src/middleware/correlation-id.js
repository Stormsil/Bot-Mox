const { randomUUID } = require('crypto');

function correlationIdMiddleware(req, res, next) {
  const existing = req.headers['x-correlation-id'];
  const correlationId = String(existing || randomUUID());

  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);

  next();
}

module.exports = {
  correlationIdMiddleware,
};
