function requestLogger(req, res, next) {
  const startedAt = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    const timestamp = new Date().toISOString();
    const correlationId = req.correlationId || '-';

    console.log(
      `[${timestamp}] [${correlationId}] ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`
    );
  });

  next();
}

module.exports = {
  requestLogger,
};
