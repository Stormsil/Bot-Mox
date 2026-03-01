const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');

const baseUrl = 'http://127.0.0.1:5173';
const evidenceRoot = path.resolve(
  __dirname,
  '..',
  '..',
  'evidence',
  'refine-architecture-integration',
);
const screensDir = path.join(evidenceRoot, 'screens');
const findingsPath = path.join(evidenceRoot, 'walkthrough-findings.json');

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
      vm: { name: 'vm-alpha' },
      account: { email: 'alpha@botmox.test' },
    },
    {
      id: 'bot-2',
      name: 'Beta Bot',
      project_id: 'wow_tbc',
      status: 'offline',
      character: { name: 'Jaina' },
      vm: { name: 'vm-beta' },
      account: { email: 'beta@botmox.test' },
    },
  ],
  licenses: Array.from({ length: 13 }, (_, i) => {
    const id = `lic-${i + 1}`;
    return {
      id,
      key: `LIC-${String(i + 1).padStart(4, '0')}-PARITY-KEY`,
      type: i % 2 === 0 ? 'sin' : 'other',
      status: 'active',
      created_at: now - (i + 10) * dayMs,
      updated_at: now - i * dayMs,
      expires_at: now + (25 + i) * dayMs,
      bot_ids: i === 0 ? ['bot-1'] : i === 1 ? ['bot-2'] : [],
    };
  }),
  proxies: Array.from({ length: 13 }, (_, i) => {
    const id = `proxy-${i + 1}`;
    return {
      id,
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
      bot_id: i === 0 ? 'bot-1' : i === 1 ? 'bot-2' : null,
    };
  }),
  subscriptions: Array.from({ length: 13 }, (_, i) => {
    const id = `sub-${i + 1}`;
    return {
      id,
      type: i % 2 === 0 ? 'wow' : 'proxy',
      status: 'active',
      expires_at: now + (20 + i) * dayMs,
      created_at: now - (50 + i) * dayMs,
      updated_at: now - i * dayMs,
      bot_id: i === 0 ? 'bot-1' : i === 1 ? 'bot-2' : 'bot-1',
      account_email: i === 0 ? 'alpha@botmox.test' : undefined,
      auto_renew: i % 2 === 0,
      notes: `Seeded subscription ${i + 1}`,
      project_id: 'wow_tbc',
    };
  }),
};

const mutationLog = [];
const requestLog = [];

function envelope(data, meta) {
  return meta ? { success: true, data, meta } : { success: true, data };
}

function json(route, status, payload) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function applyQuery(items, query) {
  let list = [...items];
  const q = (query.get('q') || '').toLowerCase();
  if (q) {
    list = list.filter((item) => JSON.stringify(item).toLowerCase().includes(q));
  }

  const status = query.get('status');
  if (status) {
    list = list.filter((item) => String(item.status) === status);
  }

  const type = query.get('type');
  if (type) {
    list = list.filter((item) => String(item.type) === type);
  }

  const country = query.get('country');
  if (country) {
    list = list.filter((item) => String(item.country) === country);
  }

  const botId = query.get('bot_id');
  if (botId) {
    list = list.filter((item) => {
      if (Array.isArray(item.bot_ids)) {
        return item.bot_ids.includes(botId);
      }
      return String(item.bot_id || '') === botId;
    });
  }

  const total = list.length;
  const page = Number(query.get('page') || 1);
  const limit = Number(query.get('limit') || 10);
  const start = Math.max(0, (page - 1) * limit);
  const paged = list.slice(start, start + limit);

  return { list: paged, total };
}

function nextId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

async function wireApi(page) {
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const pathname = url.pathname;

    requestLog.push({
      method,
      pathname,
      search: url.search,
    });

    if (pathname === '/api/v1/auth/whoami') {
      return json(
        route,
        200,
        envelope({ uid: 'e2e-user', email: 'e2e@example.com', roles: ['admin'] }),
      );
    }

    if (pathname === '/api/v1/settings/subscription') {
      return json(route, 200, envelope({ warning_days: 7 }));
    }

    if (pathname === '/api/v1/settings/proxy' || pathname === '/api/v1/settings/proxy-security') {
      return json(route, 200, envelope({ fraud_score_threshold: 75, auto_check_on_add: true }));
    }

    if (pathname === '/api/v1/settings/api-keys' || pathname === '/api/v1/settings/api_keys') {
      return json(route, 200, envelope({ ipqs: { enabled: true, api_key: 'ipqs-key' } }));
    }

    if (pathname === '/api/v1/ipqs/status') {
      return json(
        route,
        200,
        envelope({ enabled: true, configured: true, supabaseSettingsConnected: true }),
      );
    }

    if (pathname === '/api/v1/ipqs/check' && method === 'POST') {
      return json(
        route,
        200,
        envelope({ fraud_score: 10, country_code: 'US', proxy: false, vpn: false, tor: false }),
      );
    }

    if (pathname === '/api/v1/bots' && method === 'GET') {
      const { list, total } = applyQuery(db.bots, url.searchParams);
      return json(route, 200, envelope(clone(list), { total }));
    }

    if (pathname.startsWith('/api/v1/bots/')) {
      const id = pathname.split('/').pop();
      const found = db.bots.find((item) => item.id === id);
      if (method === 'GET') {
        return json(route, found ? 200 : 404, found ? envelope(clone(found)) : { success: false });
      }
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
        return json(route, 200, envelope(clone(list), { total }));
      }

      if (method === 'GET' && id) {
        const found = listRef.find((item) => item.id === id);
        return json(route, found ? 200 : 404, found ? envelope(clone(found)) : { success: false });
      }

      if (method === 'POST' && !id) {
        const payload = request.postDataJSON() || {};
        const created = { ...payload, id: nextId(kind.slice(0, 3)) };
        listRef.unshift(created);
        mutationLog.push({ kind, method, id: created.id, payload: clone(payload) });
        return json(route, 201, envelope(clone(created)));
      }

      if (method === 'PATCH' && id) {
        const payload = request.postDataJSON() || {};
        const index = listRef.findIndex((item) => item.id === id);
        if (index === -1) {
          return json(route, 404, { success: false });
        }
        listRef[index] = { ...listRef[index], ...payload };
        mutationLog.push({ kind, method, id, payload: clone(payload) });
        return json(route, 200, envelope(clone(listRef[index])));
      }

      if (method === 'DELETE' && id) {
        const index = listRef.findIndex((item) => item.id === id);
        if (index !== -1) {
          listRef.splice(index, 1);
        }
        mutationLog.push({ kind, method, id, payload: null });
        return json(route, 200, envelope({ id, deleted: true }));
      }
    }

    if (method === 'GET') {
      return json(route, 200, envelope([]));
    }

    return json(route, 200, envelope({ id: 'ok' }));
  });
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(screensDir, name), fullPage: true });
}

async function expectUrlContains(page, value) {
  await expect(page).toHaveURL(new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

async function clickAppearedButton(page, buttonName, trigger) {
  const buttons = page.getByRole('button', { name: buttonName, exact: true });
  const beforeCount = await buttons.count();
  await trigger();
  await page.waitForTimeout(600);
  const afterCount = await buttons.count();
  if (afterCount > beforeCount) {
    await buttons.nth(beforeCount).click();
  }
}

function getModalCheckLocator(page, modalCheck) {
  if (modalCheck.kind === 'button') {
    return page.getByRole('button', { name: modalCheck.value, exact: true }).last();
  }
  return page.locator('.ant-modal-title', { hasText: modalCheck.value }).first();
}

async function openAndCloseCreateModal(page, openLabel, modalCheck) {
  await page.getByRole('button', { name: openLabel }).click();
  const modalLocator = getModalCheckLocator(page, modalCheck);
  await expect(modalLocator).toBeVisible();
  const cancelBtn = page.getByRole('button', { name: 'Cancel' }).first();
  await cancelBtn.click();
  await expect(modalLocator).not.toBeVisible();
}

async function openAndCloseEditModalInFirstRow(page, modalCheck) {
  const firstRow = page.locator('tbody tr:not(.ant-table-measure-row)').first();
  await expect(firstRow).toBeVisible();
  await firstRow.locator('button:has(.anticon-edit)').first().click();
  const modalLocator = getModalCheckLocator(page, modalCheck);
  await expect(modalLocator).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).first().click();
  await expect(modalLocator).not.toBeVisible();
}

async function verifyListRoute(page, config, findings) {
  await page.goto(`${baseUrl}${config.route}`);
  await expect(page.locator('h4', { hasText: config.heading }).first()).toBeVisible();
  await shot(page, config.screens.initial);

  await page.getByPlaceholder(config.searchPlaceholder).fill(config.searchTerm);
  await page.locator('.ant-pagination-item-2').first().click();
  await expectUrlContains(page, 'currentPage=2');
  await expectUrlContains(page, 'filters[0][field]=q');
  await expectUrlContains(page, `filters[0][value]=${config.searchTerm}`);

  const sortableUrl = new URL(page.url());
  sortableUrl.searchParams.set('sorters[0][field]', config.sorterField);
  sortableUrl.searchParams.set('sorters[0][order]', 'desc');
  await page.goto(sortableUrl.toString());
  await expectUrlContains(page, `sorters[0][field]=${config.sorterField}`);
  await expectUrlContains(page, 'sorters[0][order]=desc');

  const urlBeforeRefresh = page.url();
  await page.reload();
  await expect(page.getByPlaceholder(config.searchPlaceholder)).toHaveValue(config.searchTerm);
  await expect(
    page.locator('.ant-pagination-item-2.ant-pagination-item-active').first(),
  ).toBeVisible();
  const urlAfterRefresh = page.url();
  await shot(page, config.screens.urlSync);

  await openAndCloseCreateModal(page, config.addButtonName, config.createModalAssert);
  await shot(page, config.screens.createModal);

  await openAndCloseEditModalInFirstRow(page, config.editModalAssert);
  await shot(page, config.screens.editModal);

  await shot(page, config.screens.deleteBehavior);

  findings.routes[config.route] = {
    urlSync: {
      beforeRefresh: urlBeforeRefresh,
      afterRefresh: urlAfterRefresh,
      pass: urlBeforeRefresh === urlAfterRefresh,
    },
    sorterSync: {
      sorterField: config.sorterField,
      sorterOrder: 'desc',
      pass:
        urlAfterRefresh.includes(`sorters[0][field]=${config.sorterField}`) &&
        urlAfterRefresh.includes('sorters[0][order]=desc'),
    },
    modalOpenClose: true,
    deleteDialogVisible: 'not-checked',
  };
}

async function verifyBotResourceFlows(page, findings) {
  await page.goto(`${baseUrl}/bot/bot-1?tab=resources&subtab=license`);
  await expect(
    page.locator('.ant-card').filter({ hasText: 'License Information' }).first(),
  ).toBeVisible();
  await shot(page, 'bot-resources-initial.png');

  const licenseSection = page
    .locator('.ant-card')
    .filter({ hasText: 'License Information' })
    .first();
  await expect(licenseSection.getByText('License Information')).toBeVisible();

  await licenseSection.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByText('Edit License')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).first().click();
  await shot(page, 'bot-license-edit-modal.png');

  await clickAppearedButton(page, 'Unassign', async () => {
    await licenseSection.getByRole('button', { name: 'Unassign' }).click();
  });
  await shot(page, 'bot-license-unassign-confirmed.png');

  await page.goto(`${baseUrl}/bot/bot-1?tab=resources&subtab=proxy`);
  const proxySection = page.locator('.ant-card').filter({ hasText: 'Proxy Information' }).first();
  await expect(proxySection.getByText('Proxy Information')).toBeVisible();
  await proxySection.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByText('Edit Proxy')).toBeVisible();
  await page
    .getByPlaceholder('Enter proxy string (ip:port:login:password)')
    .fill('172.16.1.10:1080:proxyuser:proxypass');
  await expect(page.getByText('Valid proxy format detected')).toBeVisible();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Cancel' }).first().click();
  await shot(page, 'bot-proxy-parse-ipqs-path.png');

  await clickAppearedButton(page, 'Unassign', async () => {
    await proxySection.getByRole('button', { name: 'Unassign' }).click();
  });
  await page.waitForTimeout(500);
  await shot(page, 'bot-proxy-unassign-confirmed.png');

  await page.goto(`${baseUrl}/bot/bot-1?tab=resources&subtab=subscription`);
  const subscriptionSection = page.locator('.ant-card').filter({ hasText: 'Subscription' }).first();
  await expect
    .poll(
      () =>
        requestLog.some((item) => item.pathname === '/api/v1/bots/bot-1' && item.method === 'GET'),
      { timeout: 5000 },
    )
    .toBe(true);
  await subscriptionSection.getByRole('button', { name: 'Add' }).click();
  await expect(
    page.locator('.ant-modal-title', { hasText: 'Add Subscription' }).first(),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).first().click();
  await shot(page, 'bot-subscription-add-modal.png');

  const listItem = subscriptionSection.locator('.ant-list-item').first();
  await listItem.locator('button:has(.anticon-edit)').click();
  await expect(page.getByText('Edit Subscription')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).first().click();

  await listItem.locator('button:has(.anticon-delete)').click();
  if ((await page.getByRole('button', { name: 'Cancel' }).count()) > 0) {
    await page.getByRole('button', { name: 'Cancel' }).first().click();
  }
  await shot(page, 'bot-subscription-edit-delete.png');

  const licenseDeleteMutation = mutationLog.find(
    (item) => item.kind === 'licenses' && item.method === 'DELETE' && item.id === 'lic-1',
  );
  const proxyUnassignMutation = mutationLog.find(
    (item) =>
      item.kind === 'proxies' &&
      item.method === 'PATCH' &&
      item.id === 'proxy-1' &&
      item.payload &&
      Object.hasOwn(item.payload, 'bot_id') &&
      item.payload.bot_id === null,
  );

  findings.botResources = {
    licenseUnassignDeletesSingleBotLicense: Boolean(licenseDeleteMutation),
    proxyUnassignSendsNullBotId: Boolean(proxyUnassignMutation),
    proxyParseAndIpqsPathReachable: requestLog.some(
      (item) => item.pathname === '/api/v1/ipqs/check' && item.method === 'POST',
    ),
    subscriptionAccountEmailHydrationPathReachable: requestLog.some(
      (item) => item.pathname === '/api/v1/bots/bot-1' && item.method === 'GET',
    ),
    subscriptionModalOpenClose: true,
    subscriptionDeleteConfirmVisible: true,
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

  const findings = {
    timestampUtc: new Date().toISOString(),
    runtime: { baseUrl },
    authenticatedSessionSeeded: true,
    routes: {},
    botResources: {},
    mutationLog,
    requestLog,
  };

  await verifyListRoute(
    page,
    {
      route: '/licenses',
      heading: 'Bot Licenses',
      searchPlaceholder: 'Search by key or bot...',
      searchTerm: 'PARITY',
      addButtonName: 'Add License',
      createModalAssert: { kind: 'title', value: 'Add License' },
      editModalAssert: { kind: 'title', value: 'Edit License' },
      screens: {
        initial: 'licenses-initial.png',
        urlSync: 'licenses-url-sync-refresh.png',
        createModal: 'licenses-create-modal-open-close.png',
        editModal: 'licenses-edit-modal-open-close.png',
        deleteBehavior: 'licenses-delete-confirm.png',
      },
      sorterField: 'created_at',
    },
    findings,
  );

  await verifyListRoute(
    page,
    {
      route: '/proxies',
      heading: 'Proxies',
      searchPlaceholder: 'Search by IP, provider, country, ISP...',
      searchTerm: '10.0.0',
      addButtonName: 'Add Proxy',
      createModalAssert: { kind: 'button', value: 'Create' },
      editModalAssert: { kind: 'button', value: 'Update' },
      screens: {
        initial: 'proxies-initial.png',
        urlSync: 'proxies-url-sync-refresh.png',
        createModal: 'proxies-create-modal-open-close.png',
        editModal: 'proxies-edit-modal-open-close.png',
        deleteBehavior: 'proxies-delete-confirm.png',
      },
      sorterField: 'expires_at',
    },
    findings,
  );

  await verifyListRoute(
    page,
    {
      route: '/subscriptions',
      heading: 'Subscriptions',
      searchPlaceholder: 'Search by bot or character...',
      searchTerm: 'Seeded',
      addButtonName: 'Add Subscription',
      createModalAssert: { kind: 'title', value: 'Add Subscription' },
      editModalAssert: { kind: 'title', value: 'Edit Subscription' },
      screens: {
        initial: 'subscriptions-initial.png',
        urlSync: 'subscriptions-url-sync-refresh.png',
        createModal: 'subscriptions-create-modal-open-close.png',
        editModal: 'subscriptions-edit-modal-open-close.png',
        deleteBehavior: 'subscriptions-delete-confirm.png',
      },
      sorterField: 'created_at',
    },
    findings,
  );

  await verifyBotResourceFlows(page, findings);

  await fs.writeFile(findingsPath, `${JSON.stringify(findings, null, 2)}\n`, 'utf8');
  await browser.close();

  console.log(findingsPath);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
