// Launch the dev environment with OpenTelemetry enabled (backend + frontend context propagation).
// This is intentionally implemented as a node script (not cross-env) to be portable across shells/OS.

const { spawn } = require('node:child_process');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');
const startScript = path.join(rootDir, 'start-dev.js');

const backendPort = Number.parseInt(String(process.env.BOTMOX_BACKEND_PORT || '3002'), 10) || 3002;

const env = {
  ...process.env,
  BOTMOX_BACKEND_PORT: String(backendPort),

  // Backend OTel
  BOTMOX_OTEL_ENABLED: process.env.BOTMOX_OTEL_ENABLED || '1',
  OTEL_SERVICE_NAME: process.env.OTEL_SERVICE_NAME || 'botmox-backend',
  OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',

  // Optional: allow the backend to proxy OTLP traces from browser -> Jaeger (helps visualize "click -> DB").
  BOTMOX_OTEL_PROXY_ENABLED: process.env.BOTMOX_OTEL_PROXY_ENABLED || '1',
  BOTMOX_DIAGNOSTICS_ENABLED: process.env.BOTMOX_DIAGNOSTICS_ENABLED || '1',

  // Frontend OTel (context propagation + user interaction spans)
  VITE_OTEL_ENABLED: process.env.VITE_OTEL_ENABLED || '1',
  VITE_OTEL_SERVICE_NAME: process.env.VITE_OTEL_SERVICE_NAME || 'botmox-frontend',
  VITE_API_BASE_URL: process.env.VITE_API_BASE_URL || `http://localhost:${backendPort}`,
  VITE_WS_BASE_URL: process.env.VITE_WS_BASE_URL || `ws://localhost:${backendPort}`,

  // Export frontend spans through the backend proxy (avoids Jaeger CORS issues).
  // This is safe to disable by setting it to empty string.
  VITE_OTEL_EXPORTER_OTLP_ENDPOINT:
    process.env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT ||
    `http://localhost:${backendPort}/api/v1/otel/v1/traces`,
};

const child = spawn(process.execPath, [startScript], {
  cwd: rootDir,
  env,
  stdio: 'inherit',
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
