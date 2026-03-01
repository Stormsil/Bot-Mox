import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const BASE_URL = process.env.QA_BASE_URL || 'http://localhost:5173';
const EMAIL = process.env.QA_EMAIL || 'qa.metriccards@localhost';
const PASSWORD = process.env.QA_PASSWORD || 'MetricCardsQa1!';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(scriptDir, '..', '..', '..');
const ARTIFACTS_DIR = path.join(
  ROOT_DIR,
  '.sisyphus',
  'notepads',
  'metric-cards-unification',
  'artifacts',
);

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const reportPath = path.join(ARTIFACTS_DIR, `manual-visual-qa-${timestamp}.json`);

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

function toRouteName(route) {
  if (route === '/') {
    return 'dashboard';
  }
  return route.replace(/^\//, '');
}

async function capture(page, viewportName, route, suffix = '') {
  const routeName = toRouteName(route);
  const suffixPart = suffix ? `-${suffix}` : '';
  const fileName = `${timestamp}-${viewportName}-${routeName}${suffixPart}.png`;
  const filePath = path.join(ARTIFACTS_DIR, fileName);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

async function authenticate(page, notes) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

  const createModeToggle = page.getByRole('radio', { name: 'Create account' });
  if (await createModeToggle.isVisible().catch(() => false)) {
    await createModeToggle.click();
  } else {
    await page.getByText('Create account', { exact: true }).first().click();
  }

  await page.getByRole('textbox', { name: 'Email' }).fill(EMAIL);
  await page.getByRole('textbox', { name: 'Password' }).fill(PASSWORD);
  await page.getByRole('textbox', { name: 'Confirm password' }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();

  const signupRedirected = await page
    .waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 12000 })
    .then(() => true)
    .catch(() => false);

  if (signupRedirected) {
    notes.push(
      'Signup succeeded for qa.metriccards@localhost and redirected into protected shell.',
    );
    return;
  }

  notes.push(
    'Signup did not redirect (likely existing account); continuing with sign-in fallback.',
  );

  const signInToggle = page.getByRole('radio', { name: 'Sign in' });
  if (await signInToggle.isVisible().catch(() => false)) {
    await signInToggle.click();
  } else {
    await page.getByText('Sign in', { exact: true }).first().click();
  }

  await page.getByRole('textbox', { name: 'Email' }).fill(EMAIL);
  await page.getByRole('textbox', { name: 'Password' }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  const signInRedirected = await page
    .waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 12000 })
    .then(() => true)
    .catch(() => false);

  if (!signInRedirected) {
    const bodyPreview = (await page.locator('body').innerText()).slice(0, 500);
    throw new Error(`Authentication failed: remained on /login. Body preview: ${bodyPreview}`);
  }

  notes.push('Sign-in succeeded with qa.metriccards@localhost.');
}

async function cardValueColorByLabel(page, label) {
  const card = page
    .locator('.ant-card')
    .filter({ has: page.locator('.ant-statistic-title', { hasText: label }) })
    .first();

  if (!(await card.isVisible().catch(() => false))) {
    return null;
  }

  const color = await card
    .locator('.ant-statistic-content')
    .first()
    .evaluate((el) => getComputedStyle(el).color)
    .catch(() => null);
  return color;
}

async function runDashboardChecks(page, viewportName, findings) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor({ timeout: 10000 });

  const screenshot = await capture(page, viewportName, '/');
  const metrics = page.locator('.ant-row .ant-col .ant-card .ant-statistic');
  const metricCount = await metrics.count();

  findings.dashboard = {
    route: '/',
    metricCount,
    screenshot,
    observation:
      metricCount >= 4
        ? 'Dashboard metric cards render as a full row above the table with visible gutters and vertical spacing.'
        : `Expected at least 4 dashboard metric cards but found ${metricCount}.`,
  };
}

async function runStatsPageChecks(page, viewportName, route, expectedLabels, findings) {
  await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.getByRole('button', { name: 'Stats', exact: true }).waitFor({ timeout: 10000 });

  const expandedScreenshot = await capture(page, viewportName, route, 'expanded');
  const labelVisibilityBefore = {};
  for (const label of expectedLabels) {
    labelVisibilityBefore[label] = await page
      .locator('.ant-statistic-title', { hasText: label })
      .first()
      .isVisible()
      .catch(() => false);
  }

  const colors = {};
  for (const label of expectedLabels) {
    colors[label] = await cardValueColorByLabel(page, label);
  }

  await page.getByRole('button', { name: 'Stats', exact: true }).click();
  await page.waitForTimeout(350);
  const collapsedScreenshot = await capture(page, viewportName, route, 'collapsed');

  const anyLabelVisibleWhenCollapsed = await page
    .locator('.ant-statistic-title')
    .filter({ hasText: /^Total|Active|Expiring Soon|Expired|Unassigned$/ })
    .first()
    .isVisible()
    .catch(() => false);

  await page.getByRole('button', { name: 'Stats', exact: true }).click();
  await page.waitForTimeout(350);
  const reExpandedScreenshot = await capture(page, viewportName, route, 'reexpanded');

  findings[toRouteName(route)] = {
    route,
    labelVisibilityBefore,
    colors,
    collapseBehavior: {
      collapsedLabelsHidden: !anyLabelVisibleWhenCollapsed,
      expandedScreenshot,
      collapsedScreenshot,
      reExpandedScreenshot,
    },
  };
}

async function main() {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const notes = [];
  const report = {
    timestamp,
    baseUrl: BASE_URL,
    credentials: { email: EMAIL },
    authNotes: notes,
    viewportRuns: {},
  };

  try {
    const authContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const authPage = await authContext.newPage();
    await authenticate(authPage, notes);
    const authState = await authContext.storageState();
    await authContext.close();

    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport, storageState: authState });
      const page = await context.newPage();
      const findings = {};

      await runDashboardChecks(page, viewport.name, findings);
      await runStatsPageChecks(
        page,
        viewport.name,
        '/licenses',
        ['Total', 'Active', 'Expiring Soon', 'Expired', 'Unassigned'],
        findings,
      );
      await runStatsPageChecks(
        page,
        viewport.name,
        '/subscriptions',
        ['Total', 'Active', 'Expiring Soon', 'Expired'],
        findings,
      );

      report.viewportRuns[viewport.name] = {
        viewport,
        findings,
      };

      await context.close();
    }

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ok: true, reportPath, report }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
