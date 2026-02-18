// IMPORTANT: tracing must be initialized before importing the rest of the app
// so that auto-instrumentation can patch modules early.
require('./observability/tracing').startTracingIfEnabled();

const { logger } = require('./observability/logger');

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'unhandledRejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaughtException');
  // Fail fast - the process is in an unknown state.
  process.exit(1);
});

require('./legacy-app');
