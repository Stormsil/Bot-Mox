import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);
const proxyPort = Number.parseInt(String(process.env.BOTMOX_PROXY_PORT || '3101'), 10) || 3101;
const baseURL = String(process.env.E2E_BASE_URL || 'http://localhost:5173').trim() || 'http://localhost:5173';
const noWebServer = String(process.env.E2E_NO_WEB_SERVER || '').trim() === '1';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  retries: isCI ? 2 : 0,
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/playwright-report.json' }],
  ],
  use: {
    baseURL,
    trace: isCI ? 'on-first-retry' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  outputDir: 'test-results',
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: noWebServer
    ? undefined
    : {
        command: 'node ../start-dev.js',
        url: 'http://localhost:5173',
        reuseExistingServer: !isCI,
        timeout: 120_000,
        env: {
          ...process.env,
          BOTMOX_PROXY_PORT: String(proxyPort),
          VITE_API_BASE_URL: `http://localhost:${proxyPort}`,
          VITE_WS_BASE_URL: `ws://localhost:${proxyPort}`,
        },
      },
});
