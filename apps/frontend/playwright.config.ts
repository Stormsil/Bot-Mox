import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);
const frontendPort = Number.parseInt(String(process.env.E2E_FRONTEND_PORT || '4173'), 10) || 4173;
const baseURL =
  String(process.env.E2E_BASE_URL || `http://localhost:${frontendPort}`).trim() ||
  `http://localhost:${frontendPort}`;
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
  ...(noWebServer
    ? {}
    : {
        webServer: {
          command: `pnpm exec vite --port ${frontendPort} --strictPort`,
          url: baseURL,
          reuseExistingServer: false,
          timeout: 180_000,
        },
      }),
});
