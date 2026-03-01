const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const workspaceRequire = createRequire(path.join(process.cwd(), 'package.json'));

function resolvePlaywright() {
  try {
    return workspaceRequire('@playwright/test');
  } catch {
    const frontendRequire = createRequire(path.join(process.cwd(), 'apps/frontend/package.json'));
    return frontendRequire('@playwright/test');
  }
}

const { chromium } = resolvePlaywright();

const BASE_URL = 'http://localhost:5173';
const ARTIFACTS_DIR = path.resolve(__dirname);
const REPORT_PATH = path.join(ARTIFACTS_DIR, 'visual-qa-report.json');

const AUTH_IDENTITY = {
  id: 'e2e-user',
  name: 'E2E User',
  email: 'e2e@example.com',
  roles: ['admin'],
};

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
];

function asSerializableError(error) {
  return {
    message: String(error && error.message ? error.message : error),
    stack: error && error.stack ? String(error.stack) : null,
  };
}

async function isRuntimeReachable(page) {
  try {
    const response = await page.goto(`${BASE_URL}/login`, {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    });
    return Boolean(response);
  } catch {
    return false;
  }
}

async function seedAuth(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.evaluate((identity) => {
    localStorage.setItem('botmox.auth.token', 'e2e-token');
    localStorage.setItem('botmox.auth.identity', JSON.stringify(identity));
    localStorage.setItem('botmox.auth.verify_at', String(Date.now()));
  }, AUTH_IDENTITY);
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
}

async function snapshotCardLayout(page) {
  return page.evaluate(() => {
    const metrics = Array.from(document.querySelectorAll('.ant-statistic')).slice(0, 8);
    const boxes = metrics.map((node) => {
      const card = node.closest('.ant-card');
      const rect = card ? card.getBoundingClientRect() : node.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };
    });
    let overlaps = 0;
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i];
        const b = boxes[j];
        const horizontal = a.x < b.x + b.width && a.x + a.width > b.x;
        const vertical = a.y < b.y + b.height && a.y + a.height > b.y;
        if (horizontal && vertical) overlaps += 1;
      }
    }
    return {
      metricCount: metrics.length,
      overlapPairs: overlaps,
    };
  });
}

async function colorSemantics(page) {
  return page.evaluate(() => {
    const labels = ['Active', 'Expiring Soon', 'Expired'];
    const byLabel = {};
    const stats = Array.from(document.querySelectorAll('.ant-statistic'));

    for (const stat of stats) {
      const title = stat.querySelector('.ant-statistic-title');
      const value = stat.querySelector('.ant-statistic-content-value');
      const titleText = title ? (title.textContent || '').trim().toLowerCase() : '';
      if (!value) continue;

      for (const label of labels) {
        if (titleText === label.toLowerCase()) {
          byLabel[label] = window.getComputedStyle(value).color;
        }
      }
    }

    const colors = labels.map((label) => byLabel[label]).filter(Boolean);
    const distinct = new Set(colors).size;

    return {
      byLabel,
      hasAllLabels: labels.every((label) => Boolean(byLabel[label])),
      distinctCount: distinct,
      semanticsOk: labels.every((label) => Boolean(byLabel[label])) && distinct >= 3,
    };
  });
}

async function toggleStats(page) {
  const statsButton = page.getByRole('button', { name: 'Stats' });
  await statsButton.waitFor({ state: 'visible', timeout: 10000 });

  const before = await page.locator('.ant-statistic').count();
  await statsButton.click();
  await page.waitForTimeout(250);
  const afterCollapse = await page.locator('.ant-statistic').count();
  await statsButton.click();
  await page.waitForTimeout(250);
  const afterExpand = await page.locator('.ant-statistic').count();

  return {
    before,
    afterCollapse,
    afterExpand,
    collapseWorked: before > 0 && afterCollapse < before,
    restoreWorked: afterExpand >= before,
  };
}

async function waitForRouteReady(page, route) {
  if (route.type === 'root-shell') {
    await page.waitForFunction(
      () => {
        const content = (document.body && document.body.innerText) || '';
        const hasPrimaryMarker = /Overview|Dashboard/i.test(content);
        const hasSecondaryMarker = /Summary|Bot List/i.test(content);
        return hasPrimaryMarker && hasSecondaryMarker;
      },
      { timeout: 12000 },
    );
    return;
  }

  if (route.type === 'licenses') {
    await page.getByRole('heading', { name: /Bot Licenses/i }).waitFor({
      state: 'visible',
      timeout: 12000,
    });
    await page.getByRole('button', { name: 'Stats' }).waitFor({ state: 'visible', timeout: 12000 });
    await page.getByRole('button', { name: /Add License/i }).waitFor({
      state: 'visible',
      timeout: 12000,
    });
    return;
  }

  if (route.type === 'subscriptions') {
    await page.getByRole('heading', { name: /Subscriptions/i }).waitFor({
      state: 'visible',
      timeout: 12000,
    });
    await page.getByRole('button', { name: 'Stats' }).waitFor({ state: 'visible', timeout: 12000 });
    await page.getByRole('button', { name: /Add Subscription/i }).waitFor({
      state: 'visible',
      timeout: 12000,
    });
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const report = {
    baseUrl: BASE_URL,
    startedAt: new Date().toISOString(),
    runtimeReachable: false,
    authSeeded: false,
    blocker: null,
    checks: [],
    errors: [],
  };

  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    report.runtimeReachable = await isRuntimeReachable(page);
    if (!report.runtimeReachable) {
      report.blocker = 'Frontend runtime is unreachable at http://localhost:5173/login';
      await context.close();
      fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
      return;
    }

    await seedAuth(page);
    report.authSeeded = true;
    await context.close();

    const routes = [
      { path: '/', type: 'root-shell' },
      { path: '/licenses', type: 'licenses' },
      { path: '/subscriptions', type: 'subscriptions' },
    ];

    for (const viewport of VIEWPORTS) {
      const viewContext = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      });
      const viewPage = await viewContext.newPage();

      await viewPage.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await viewPage.evaluate((identity) => {
        localStorage.setItem('botmox.auth.token', 'e2e-token');
        localStorage.setItem('botmox.auth.identity', JSON.stringify(identity));
        localStorage.setItem('botmox.auth.verify_at', String(Date.now()));
      }, AUTH_IDENTITY);

      for (const route of routes) {
        const entry = {
          viewport: viewport.name,
          route: route.path,
          pageType: route.type,
          screenshot: null,
          renderOk: false,
          layout: null,
          toggle: null,
          colors: null,
          notes: [],
        };

        try {
          await viewPage.goto(`${BASE_URL}${route.path}`, {
            waitUntil: 'domcontentloaded',
            timeout: 25000,
          });
          await waitForRouteReady(viewPage, route);

          if (route.type === 'root-shell') {
            const shellSnapshot = await viewPage.evaluate(() => {
              const content = (document.body && document.body.innerText) || '';
              return {
                hasOverview: /Overview/i.test(content),
                hasDashboard: /Dashboard/i.test(content),
                hasSummary: /Summary/i.test(content),
                hasBotList: /Bot List/i.test(content),
              };
            });
            entry.renderOk = Boolean(
              (shellSnapshot.hasOverview || shellSnapshot.hasDashboard) &&
                (shellSnapshot.hasSummary || shellSnapshot.hasBotList),
            );
            entry.notes.push(`Root shell markers: ${JSON.stringify(shellSnapshot)}`);
          }

          if (route.type === 'licenses' || route.type === 'subscriptions') {
            await viewPage
              .getByRole('button', { name: 'Stats' })
              .waitFor({ state: 'visible', timeout: 10000 });
            entry.toggle = await toggleStats(viewPage);
            entry.colors = await colorSemantics(viewPage);
            entry.renderOk = Boolean(
              entry.toggle.collapseWorked && entry.toggle.restoreWorked && entry.colors.semanticsOk,
            );
            if (!entry.toggle.collapseWorked || !entry.toggle.restoreWorked) {
              entry.notes.push('Stats collapse toggle did not collapse/restore as expected.');
            }
            if (!entry.colors.semanticsOk) {
              entry.notes.push(
                'Color semantics check failed (Active/Expiring Soon/Expired not uniquely colored).',
              );
            }
          }
        } catch (error) {
          entry.notes.push('Route validation failed.');
          entry.notes.push(String(error && error.message ? error.message : error));
          report.errors.push({
            viewport: viewport.name,
            route: route.path,
            error: asSerializableError(error),
          });
        } finally {
          const fileName = `${viewport.name}-${route.path.replace('/', '') || 'dashboard'}.png`;
          const shotPath = path.join(ARTIFACTS_DIR, fileName);
          try {
            await viewPage.screenshot({ path: shotPath, fullPage: true });
            entry.screenshot = shotPath;
          } catch (screenshotError) {
            entry.notes.push('Screenshot capture failed.');
            entry.notes.push(
              String(
                screenshotError && screenshotError.message
                  ? screenshotError.message
                  : screenshotError,
              ),
            );
            report.errors.push({
              viewport: viewport.name,
              route: route.path,
              stage: 'screenshot',
              error: asSerializableError(screenshotError),
            });
          }
        }

        report.checks.push(entry);
      }

      await viewContext.close();
    }
  } catch (error) {
    report.errors.push({ stage: 'run', error: asSerializableError(error) });
    if (!report.blocker) {
      report.blocker = 'Unexpected runtime error during visual QA execution.';
    }
  } finally {
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    await browser.close();
  }
}

run();
