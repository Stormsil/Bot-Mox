// IMPORTANT: tracing must be initialized before importing the rest of the app
// so that auto-instrumentation can patch modules early.
require('./observability/tracing').startTracingIfEnabled();

require('./legacy-app');
