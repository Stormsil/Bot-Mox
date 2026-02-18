import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost';
const EMAIL = process.env.BOTMOX_E2E_EMAIL || 'qa.frontend.refactor@example.com';
const PASSWORD = process.env.BOTMOX_E2E_PASSWORD || 'Qwerty123!';

const routes = [
  { key: 'overview', path: '/' },
  { key: 'finance', path: '/finance' },
  { key: 'settings', path: '/settings' },
  { key: 'notes', path: '/notes' },
  { key: 'calendar', path: '/workspace/calendar' },
  { key: 'kanban', path: '/workspace/kanban' },
  { key: 'licenses', path: '/licenses' },
  { key: 'proxies', path: '/proxies' },
  { key: 'subscriptions', path: '/subscriptions' },
  { key: 'vms', path: '/vms' },
];

const outputDir = path.resolve(process.cwd(), '../docs/audits/artifacts/frontend-baseline-2026-02-17');

async function ensureDir() {
  await fs.mkdir(outputDir, { recursive: true });
}

async function login(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
}

async function waitForStablePage(page) {
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(500);
}

async function captureRoute(page, routeKey, routePath, mode) {
  await page.goto(`${BASE_URL}${routePath}`, { waitUntil: 'domcontentloaded' });
  await waitForStablePage(page);

  const filePath = path.join(outputDir, `${routeKey}-${mode}.png`);
  await page.screenshot({ path: filePath, fullPage: true });

  const vars = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const body = getComputedStyle(document.body);
    return {
      theme: document.documentElement.getAttribute('data-theme') || 'unknown',
      canvas: root.getPropertyValue('--boxmox-color-bg-canvas').trim(),
      panel: root.getPropertyValue('--boxmox-color-surface-panel').trim(),
      text: root.getPropertyValue('--boxmox-color-text-primary').trim(),
      bodyBackgroundColor: body.backgroundColor,
      bodyColor: body.color,
      title: document.title,
      url: window.location.pathname + window.location.search,
    };
  });

  return { routeKey, routePath, mode, screenshot: filePath, vars };
}

async function toggleTheme(page, targetMode) {
  const switchEl = page.locator('.ant-switch').first();
  await switchEl.waitFor({ state: 'visible', timeout: 10_000 });
  const isChecked = (await switchEl.getAttribute('aria-checked')) === 'true';
  if ((targetMode === 'dark' && !isChecked) || (targetMode === 'light' && isChecked)) {
    await switchEl.click();
    await page.waitForTimeout(800);
  }
}

async function main() {
  await ensureDir();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  try {
    await login(page);
    await toggleTheme(page, 'light');

    const report = {
      generatedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      routes,
      light: [],
      dark: [],
    };

    for (const route of routes) {
      report.light.push(await captureRoute(page, route.key, route.path, 'light'));
    }

    await page.goto(`${BASE_URL}/settings`, { waitUntil: 'domcontentloaded' });
    await waitForStablePage(page);
    await toggleTheme(page, 'dark');

    for (const route of routes) {
      report.dark.push(await captureRoute(page, route.key, route.path, 'dark'));
    }

    const reportPath = path.join(outputDir, 'theme-propagation-report.json');
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    process.stdout.write(`Baseline captured: ${outputDir}\n`);
    process.stdout.write(`Theme report: ${reportPath}\n`);
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exit(1);
});
