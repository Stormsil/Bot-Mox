function createStartupBanner({ port, corsOptions }) {
  const origins = Array.isArray(corsOptions?.origin)
    ? corsOptions.origin
    : [corsOptions?.origin || 'unknown'];
  const renderedOrigins = origins.map((origin) => String(origin)).join(', ');

  return `
╔══════════════════════════════════════════════════════════════╗
║           Bot-Mox Proxy Server                               ║
╠══════════════════════════════════════════════════════════════╣
║  Server running on: http://localhost:${port}                  ║
║  Health endpoint:   http://localhost:${port}/api/v1/health    ║
║  Liveness:          http://localhost:${port}/api/v1/health/live║
║  Readiness:         http://localhost:${port}/api/v1/health/ready║
║  API v1 root:       http://localhost:${port}/api/v1/*          ║
║  Infra API:         http://localhost:${port}/api/v1/infra/*    ║
║  WebSocket:         ws://localhost:${port}/ws/vm-operations    ║
║  WebSocket v1:      ws://localhost:${port}/ws/v1/vm-operations ║
╠══════════════════════════════════════════════════════════════╣
║  CORS enabled for: ${renderedOrigins}    ║
╚══════════════════════════════════════════════════════════════╝
  `;
}

function logInfo(logger, message, fields) {
  if (logger && typeof logger.info === 'function') {
    if (fields) {
      logger.info(fields, message);
      return;
    }
    logger.info(message);
    return;
  }

  if (logger && typeof logger.log === 'function') {
    logger.log(message);
    return;
  }

  // eslint-disable-next-line no-console
  console.log(message);
}

function registerShutdownHandlers({ server, logger = console }) {
  const shutdown = (signal) => {
    logInfo(logger, `${signal} received, shutting down...`);
    server.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

function startServerRuntime({
  app,
  port,
  corsOptions,
  attachUiProxyUpgradeHandler,
  attachUiProxyUpgradeParams,
  attachVmOperationsWebSocket,
  attachVmOperationsParams,
  logger = console,
}) {
  const server = app.listen(port, () => {
    logInfo(logger, 'server_started', {
      port,
      cors: {
        origin: corsOptions?.origin ?? null,
      },
    });
    // Keep the human-readable banner in dev consoles only (it is still a single JSON log entry if logger is pino).
    logInfo(
      logger,
      createStartupBanner({
        port,
        corsOptions,
      }),
    );
  });

  attachUiProxyUpgradeHandler({
    server,
    ...attachUiProxyUpgradeParams,
  });
  attachVmOperationsWebSocket({
    server,
    ...attachVmOperationsParams,
  });
  registerShutdownHandlers({ server, logger });

  return server;
}

module.exports = {
  startServerRuntime,
};
