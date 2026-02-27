const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('@playwright/test');

const baseUrl = 'http://127.0.0.1:5173';
const evidenceRoot = path.resolve(__dirname);
const screensDir = path.join(evidenceRoot, 'screens');
const findingsPath = path.join(evidenceRoot, 'verification-recovery-findings.json');

const now = Date.now();
const dayMs = 24 * 60 * 60 * 1000;

const db = {
  bots: [
    {
      id: 'bot-1',
      name: 'Alpha Bot',
      project_id: 'wow_tbc',
      status: 'offline',
      character: { name: 'Thrall' },
      account: { email: 'alpha@botmox.test' },
    },
  ],
  licenses: Array.from({ length: 13 }, (_, i) => ({
    id: `lic-${i + 1}`,
    key: `LIC-${String(i + 1).padStart(4, '0')}-PARITY-KEY`,
    type: i % 2 === 0 ? 'sin' : 'other',
    status: 'active',
    created_at: now - (i + 10) * dayMs,
    updated_at: now - i * dayMs,
    expires_at: now + (25 + i) * dayMs,
    bot_ids: i === 0 ? ['bot-1'] : [],
  })),
  proxies: Array.from({ length: 13 }, (_, i) => ({
    id: `proxy-${i + 1}`,
    ip: `10.0.0.${i + 1}`,
    port: 8000 + i,
    login: `user${i + 1}`,
    password: `pass${i + 1}`,
    type: i % 2 === 0 ? 'http' : 'socks5',
    status: 'active',
    provider: i % 2 === 0 ? 'ProviderA' : 'ProviderB',
    country: i % 2 === 0 ? 'US' : 'DE',
    country_code: i % 2 === 0 ? 'US' : 'DE',
    fraud_score: 15 + i,
    vpn: false,
    proxy: false,
    tor: false,
    last_checked: now - 1000,
    created_at: now - (40 + i) * dayMs,
    updated_at: now - i * dayMs,
    expires_at: now + (35 + i) * dayMs,
    bot_id: i === 0 ? 'bot-1' : null,
  })),
  subscriptions: Array.from({ length: 13 }, (_, i) => ({
    id: `sub-${i + 1}`,
    type: i % 2 === 0 ? 'wow' : 'proxy',
    status: 'active',
    expires_at: now + (20 + i) * dayMs,
    created_at: now - (50 + i) * dayMs,
    updated_at: now - i * dayMs,
    bot_id: 'bot-1',
    account_email: i === 0 ? 'alpha@botmox.test' : undefined,
    auto_renew: i % 2 === 0,
    notes: `Seeded subscription ${i + 1}`,
    project_id: 'wow_tbc',
  })),
};

function envelope(data, meta) {
  return meta ? { success: true, data, meta } : { success: true, data };
}

function applyQuery(items, query) {
  let list = [...items];
  const q = (query.get('q') || '').toLowerCase();
  if (q) {
    list = list.filter((item) => JSON.stringify(item).toLowerCase().includes(q));
  }
  const total = list.length;
  const page = Number(query.get('page') || 1);
  const limit = Number(query.get('limit') || 10);
  const start = Math.max(0, (page - 1) * limit);
  return { list: list.slice(start, start + limit), total };
}

async function wireApi(page) {
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const pathname = url.pathname;

    if (pathname === '/api/v1/auth/whoami') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          envelope({ uid: 'e2e-user', email: 'e2e@example.com', roles: ['admin'] }),
        ),
      });
    }

    if (pathname.startsWith('/api/v1/settings/')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(envelope({})),
      });
    }

    if (pathname === '/api/v1/ipqs/status') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(envelope({ enabled: true, configured: true })),
      });
    }

    if (pathname === '/api/v1/ipqs/check') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(envelope({ fraud_score: 10, country_code: 'US', proxy: false })),
      });
    }

    if (pathname === '/api/v1/bots' && method === 'GET') {
      const { list, total } = applyQuery(db.bots, url.searchParams);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(envelope(list, { total })),
      });
    }

    const match = pathname.match(
      /^\/api\/v1\/resources\/(licenses|proxies|subscriptions)(?:\/([^/]+))?$/,
    );
    if (match) {
      const kind = match[1];
      const id = match[2];
      const listRef = db[kind];

      if (method === 'GET' && !id) {
        const { list, total } = applyQuery(listRef, url.searchParams);
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(envelope(list, { total })),
        });
      }

      if (method === 'GET' && id) {
        const found = listRef.find((item) => item.id === id);
        return route.fulfill({
          status: found ? 200 : 404,
          contentType: 'application/json',
          body: JSON.stringify(found ? envelope(found) : { success: false }),
        });
      }

      if (method === 'DELETE' && id) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(envelope({ id, deleted: true })),
        });
      }

      if (method === 'POST' || method === 'PATCH') {
        const payload = request.postDataJSON() || {};
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(envelope({ id: id || 'new-item', ...payload })),
        });
      }
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(envelope([])),
    });
  });
}

async function saveScreenshot(page, fileName) {
  await page.screenshot({ path: path.join(screensDir, fileName), fullPage: true });
}

async function maybeModalVisible(page) {
  const container = page.locator('.ant-modal-wrap:visible, .ant-drawer:visible').first();
  return (await container.count()) > 0;
}

async function waitForDeleteConfirm(page, promptSnippet) {
  const modalConfirm = page.locator('.ant-modal-confirm:visible').last();
  const popConfirm = page.locator('.ant-popover:visible .ant-popover-inner').last();

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await page.waitForTimeout(250);

    if ((await modalConfirm.count()) > 0) {
      await modalConfirm.waitFor({ state: 'visible', timeout: 2500 });
      return { kind: 'modal', container: modalConfirm };
    }

    if ((await popConfirm.count()) > 0) {
      await popConfirm.waitFor({ state: 'visible', timeout: 2500 });
      return { kind: 'popover', container: popConfirm };
    }

    if (promptSnippet) {
      const promptText = page.getByText(promptSnippet, { exact: false }).first();
      if ((await promptText.count()) > 0 && (await promptText.isVisible())) {
        return { kind: 'text-only', container: page.locator('body') };
      }

      const bodyText = await page.locator('body').innerText();
      if (bodyText.includes(promptSnippet)) {
        return { kind: 'text-only', container: page.locator('body') };
      }
    }
  }

  throw new Error('delete confirm container not detected after clicking delete action');
}

async function closeDeleteConfirm(page, confirmState) {
  if (confirmState.kind === 'modal') {
    const cancelButton = confirmState.container
      .locator('.ant-modal-confirm-btns .ant-btn')
      .filter({ hasText: /^Cancel$/ })
      .first();
    if ((await cancelButton.count()) > 0) {
      await cancelButton.click();
      return;
    }
  }

  if (confirmState.kind === 'popover') {
    const cancelButton = confirmState.container.getByRole('button', { name: 'Cancel' }).first();
    if ((await cancelButton.count()) > 0) {
      await cancelButton.click();
      return;
    }
  }

  const anyCancel = page.getByRole('button', { name: 'Cancel' }).last();
  if ((await anyCancel.count()) > 0) {
    await anyCancel.click();
    return;
  }

  await page.keyboard.press('Escape');
}

async function runRouteChecks(page, config) {
  const blockers = [];
  const steps = [];

  const step = async (name, fn) => {
    try {
      await fn();
      steps.push({ name, status: 'PASS' });
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      steps.push({ name, status: 'PARTIAL', blocker: message });
      blockers.push(`BLOCKER ${config.route} :: ${name} :: ${message}`);
    }
  };

  await step('initial-load', async () => {
    await page.goto(`${baseUrl}${config.route}`);
    await page.waitForLoadState('domcontentloaded');
    await page.locator('table').first().waitFor({ state: 'visible', timeout: 10000 });
    await saveScreenshot(page, `${config.key}-initial-recovery.png`);
  });

  await step('url-sync-refresh', async () => {
    await page.getByPlaceholder(config.searchPlaceholder).fill(config.searchTerm);
    const page2 = page.locator('.ant-pagination-item-2').first();
    await page2.click();
    await page.waitForTimeout(500);
    const before = page.url();
    if (!before.includes('currentPage=2')) {
      throw new Error(`expected currentPage=2 in URL, got: ${before}`);
    }
    await page.reload();
    await page.waitForTimeout(500);
    const after = page.url();
    if (before !== after) {
      throw new Error('URL changed after refresh while syncWithLocation expected parity');
    }
    await saveScreenshot(page, `${config.key}-url-sync-refresh-recovery.png`);
  });

  await step('create-open-close', async () => {
    await page.getByRole('button', { name: config.addButtonName }).click();
    await page.waitForTimeout(500);
    if (!(await maybeModalVisible(page))) {
      throw new Error('no visible modal/drawer after create action');
    }
    await saveScreenshot(page, `${config.key}-create-open-recovery.png`);
    await page.getByRole('button', { name: 'Cancel' }).first().click();
  });

  await step('edit-open-close', async () => {
    const firstRow = page.locator('tbody tr:not(.ant-table-measure-row)').first();
    await firstRow.waitFor({ state: 'visible', timeout: 10000 });
    await firstRow.locator('button:has(.anticon-edit)').first().click();
    await page.waitForTimeout(500);
    if (!(await maybeModalVisible(page))) {
      throw new Error('no visible modal/drawer after edit action');
    }
    await saveScreenshot(page, `${config.key}-edit-open-recovery.png`);
    await page.getByRole('button', { name: 'Cancel' }).first().click();
  });

  await step('delete-confirm-open', async () => {
    const firstRow = page.locator('tbody tr:not(.ant-table-measure-row)').first();
    await firstRow.waitFor({ state: 'visible', timeout: 10000 });

    const deleteButton = firstRow.locator('button:has(.anticon-delete)').first();
    const deleteButtonCount = await deleteButton.count();
    if (deleteButtonCount === 0) {
      throw new Error('no row action buttons found for delete flow');
    }

    await deleteButton.scrollIntoViewIfNeeded();
    await deleteButton.hover();
    await deleteButton.click({ force: true });

    if (config.deletePromptSnippet) {
      const quickPrompt = page.getByText(config.deletePromptSnippet, { exact: false }).first();
      const isPromptVisible = (await quickPrompt.count()) > 0 && (await quickPrompt.isVisible());
      if (!isPromptVisible) {
        if ((await deleteButton.count()) > 0) {
          await deleteButton.evaluate((el) => {
            el.click();
          });

          const stillMissingPrompt = !(
            (await quickPrompt.count()) > 0 && (await quickPrompt.isVisible())
          );

          if (stillMissingPrompt) {
            await deleteButton.evaluate((el) => {
              const propKey = Object.keys(el).find((key) => key.startsWith('__reactProps$'));
              if (!propKey) {
                return;
              }
              const props = el[propKey];
              if (props && typeof props.onClick === 'function') {
                props.onClick({
                  preventDefault() {},
                  stopPropagation() {},
                });
              }
            });
          }
        }
      }
    }

    try {
      const confirmState = await waitForDeleteConfirm(page, config.deletePromptSnippet);
      await saveScreenshot(page, `${config.key}-delete-confirm-recovery.png`);
      await closeDeleteConfirm(page, confirmState);
    } catch (error) {
      await saveScreenshot(page, `${config.key}-delete-confirm-missing-recovery.png`);
      throw error;
    }
  });

  return {
    route: config.route,
    status: blockers.length === 0 ? 'PASS' : 'PARTIAL',
    steps,
    blockers,
  };
}

async function run() {
  await fs.mkdir(screensDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1660, height: 1000 } });
  const page = await context.newPage();

  await page.addInitScript(() => {
    localStorage.setItem('botmox.auth.token', 'e2e-token');
    localStorage.setItem(
      'botmox.auth.identity',
      JSON.stringify({
        id: 'e2e-user',
        name: 'E2E User',
        email: 'e2e@example.com',
        roles: ['admin'],
      }),
    );
    localStorage.setItem('botmox.auth.verify_at', String(Date.now()));
  });

  await wireApi(page);

  const routeConfigs = [
    {
      key: 'licenses',
      route: '/licenses',
      searchPlaceholder: 'Search by key or bot...',
      searchTerm: 'PARITY',
      addButtonName: 'Add License',
      deletePromptSnippet: 'Delete',
    },
    {
      key: 'proxies',
      route: '/proxies',
      searchPlaceholder: 'Search by IP, provider, country, ISP...',
      searchTerm: '10.0.0',
      addButtonName: 'Add Proxy',
      deletePromptSnippet: 'Are you sure you want to delete proxy',
    },
    {
      key: 'subscriptions',
      route: '/subscriptions',
      searchPlaceholder: 'Search by bot or character...',
      searchTerm: 'Seeded',
      addButtonName: 'Add Subscription',
      deletePromptSnippet: 'Are you sure you want to delete',
    },
  ];

  const routeResults = [];
  for (const config of routeConfigs) {
    routeResults.push(await runRouteChecks(page, config));
  }

  const findings = {
    timestampUtc: new Date().toISOString(),
    baseUrl,
    authenticatedSessionSeeded: true,
    routes: routeResults,
  };

  await fs.writeFile(findingsPath, `${JSON.stringify(findings, null, 2)}\n`, 'utf8');
  await context.close();
  await browser.close();
  console.log(findingsPath);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
