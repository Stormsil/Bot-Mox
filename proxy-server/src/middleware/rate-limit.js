function createSimpleRateLimiter(options = {}) {
  const windowMs = Number(options.windowMs) || 15 * 60 * 1000;
  const max = Number(options.max) || 100;
  const skip = typeof options.skip === 'function' ? options.skip : () => false;
  const keyGenerator =
    typeof options.keyGenerator === 'function'
      ? options.keyGenerator
      : (req) => req.ip || req.socket?.remoteAddress || 'unknown';

  const store = new Map();

  const cleanupTimer = setInterval(
    () => {
      const now = Date.now();
      for (const [key, bucket] of store.entries()) {
        if (!bucket || bucket.expiresAt <= now) {
          store.delete(key);
        }
      }
    },
    Math.max(10_000, Math.floor(windowMs / 2)),
  );

  if (typeof cleanupTimer.unref === 'function') {
    cleanupTimer.unref();
  }

  return function rateLimiter(req, res, next) {
    if (skip(req)) return next();

    const now = Date.now();
    const key = keyGenerator(req);

    const current = store.get(key);
    if (!current || current.expiresAt <= now) {
      store.set(key, { count: 1, expiresAt: now + windowMs });
      return next();
    }

    current.count += 1;
    if (current.count > max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.expiresAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please try again later.',
        },
      });
    }

    return next();
  };
}

module.exports = {
  createSimpleRateLimiter,
};
