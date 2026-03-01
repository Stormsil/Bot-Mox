import { expect, type Page, type Route, test } from '@playwright/test';

const e2eIdentity = {
  id: 'e2e-user',
  name: 'E2E User',
  email: 'e2e@example.com',
  roles: ['admin'],
  access: {
    access_tier: 'premium',
    write_access: true,
  },
};

type ApiEnvelope = {
  success: true;
  data: unknown;
  meta?: Record<string, unknown>;
};

type ResourceKind = 'licenses' | 'proxies' | 'subscriptions';

type ResourceRecord = {
  id: string;
  created_at: number;
  updated_at: number;
  [key: string]: unknown;
};

const MAX_BASELINE_LIST_GETS = 4;

function envelope(data: unknown, meta?: Record<string, unknown>): ApiEnvelope {
  if (meta) {
    return { success: true, data, meta };
  }
  return { success: true, data };
}

function toJsonResponse(
  payload: ApiEnvelope,
  status = 200,
): {
  status: number;
  contentType: string;
  body: string;
} {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  };
}

function seedAuthStorage(identity: typeof e2eIdentity) {
  localStorage.setItem('botmox.auth.token', 'e2e-token');
  localStorage.setItem('botmox.auth.identity', JSON.stringify(identity));
  localStorage.setItem('botmox.auth.verify_at', String(Date.now()));
}

function createBaselineFixture() {
  const now = Date.now();
  const bots = [
    {
      id: 'bot-1',
      name: 'Bot One',
      status: 'online',
      character: { name: 'Thrall' },
      vm: { name: 'VM-Alpha' },
      account: { email: 'bot-one@example.com' },
    },
  ];

  const data: Record<ResourceKind, ResourceRecord[]> = {
    licenses: [
      {
        id: 'lic-1',
        key: 'SIN-BASELINE-0001',
        type: 'sin',
        status: 'active',
        bot_ids: ['bot-1'],
        expires_at: now + 14 * 24 * 60 * 60 * 1000,
        created_at: now,
        updated_at: now,
      },
    ],
    proxies: [
      {
        id: 'proxy-1',
        ip: '1.1.1.1',
        port: 8080,
        login: 'user',
        password: 'pass',
        provider: 'IPRoyal',
        country: 'US',
        country_code: 'US',
        type: 'http',
        status: 'active',
        bot_id: 'bot-1',
        fraud_score: 10,
        vpn: false,
        proxy: true,
        tor: false,
        bot_status: false,
        isp: 'ISP',
        organization: 'Org',
        city: 'NY',
        region: 'NY',
        zip_code: '10001',
        timezone: 'UTC-5',
        latitude: 40.7128,
        longitude: -74.006,
        expires_at: now + 14 * 24 * 60 * 60 * 1000,
        last_checked: now,
        created_at: now,
        updated_at: now,
      },
    ],
    subscriptions: [
      {
        id: 'sub-1',
        bot_id: 'bot-1',
        type: 'wow',
        status: 'active',
        expires_at: now + 14 * 24 * 60 * 60 * 1000,
        created_at: now,
        updated_at: now,
      },
    ],
  };

  const counts = {
    listGet: {
      licenses: 0,
      proxies: 0,
      subscriptions: 0,
    },
    write: {
      licenses: { post: 0, patch: 0, delete: 0 },
      proxies: { post: 0, patch: 0, delete: 0 },
      subscriptions: { post: 0, patch: 0, delete: 0 },
    },
  };

  return { bots, data, counts };
}

async function mountCrudMockApi(page: Page) {
  const fixture = createBaselineFixture();

  await page.route('**/api/v1/**', async (route: Route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const pathname = url.pathname;

    if (pathname === '/api/v1/auth/whoami') {
      await route.fulfill(
        toJsonResponse(
          envelope({
            uid: e2eIdentity.id,
            email: e2eIdentity.email,
            roles: e2eIdentity.roles,
            access: {
              accessTier: 'premium',
              premiumActive: true,
              writeAccess: true,
            },
          }),
        ),
      );
      return;
    }

    if (pathname === '/api/v1/theme-assets') {
      await route.fulfill(toJsonResponse(envelope({ generated_at_ms: Date.now(), items: [] })));
      return;
    }

    if (pathname === '/api/v1/bots') {
      await route.fulfill(toJsonResponse(envelope(fixture.bots, { total: fixture.bots.length })));
      return;
    }

    if (pathname === '/api/v1/settings/alerts') {
      await route.fulfill(
        toJsonResponse(
          envelope({
            warning_days: 7,
            enabled: true,
            updated_at: Date.now(),
          }),
        ),
      );
      return;
    }

    if (pathname.startsWith('/api/v1/resources/')) {
      const parts = pathname.split('/').filter(Boolean);
      const kind = parts[3] as ResourceKind | undefined;
      const id = parts[4];

      if (!kind || !(kind in fixture.data)) {
        await route.fulfill(toJsonResponse(envelope([], { total: 0 })));
        return;
      }

      const collection = fixture.data[kind];

      if (method === 'GET' && !id) {
        fixture.counts.listGet[kind] += 1;
        await route.fulfill(toJsonResponse(envelope(collection, { total: collection.length })));
        return;
      }

      if (method === 'GET' && id) {
        const found = collection.find((item) => item.id === id);
        await route.fulfill(toJsonResponse(envelope(found ?? null), found ? 200 : 404));
        return;
      }

      if (method === 'POST' && !id) {
        fixture.counts.write[kind].post += 1;
        const body = request.postDataJSON() as Record<string, unknown>;
        const next: ResourceRecord = {
          ...body,
          id: `${kind}-created-${fixture.counts.write[kind].post}`,
          created_at: Number(body.created_at ?? Date.now()),
          updated_at: Number(body.updated_at ?? Date.now()),
        };
        collection.unshift(next);
        await route.fulfill(toJsonResponse(envelope(next), 201));
        return;
      }

      if (method === 'PATCH' && id) {
        fixture.counts.write[kind].patch += 1;
        const body = request.postDataJSON() as Record<string, unknown>;
        const index = collection.findIndex((item) => item.id === id);
        if (index >= 0) {
          const current = collection[index];
          if (!current) {
            await route.fulfill(toJsonResponse(envelope({ id })));
            return;
          }
          collection[index] = {
            ...current,
            ...body,
            id: String(current.id),
            created_at: Number(current.created_at ?? Date.now()),
            updated_at: Number(body.updated_at ?? Date.now()),
          };
        }
        await route.fulfill(toJsonResponse(envelope(collection[index] ?? { id })));
        return;
      }

      if (method === 'DELETE' && id) {
        fixture.counts.write[kind].delete += 1;
        const index = collection.findIndex((item) => item.id === id);
        if (index >= 0) {
          collection.splice(index, 1);
        }
        await route.fulfill(toJsonResponse(envelope({ id, deleted: true })));
        return;
      }
    }

    if (method === 'GET') {
      await route.fulfill(toJsonResponse(envelope([])));
      return;
    }

    await route.fulfill(toJsonResponse(envelope({ id: 'fallback-item' })));
  });

  return fixture;
}

function assertDeterministicListFetchBudget(kind: ResourceKind, count: number) {
  expect
    .soft(
      count,
      `Baseline invariant: ${kind} list GET count must stay within deterministic post-refactor budget (<= ${MAX_BASELINE_LIST_GETS}) to guard against mixed-source amplification regressions`,
    )
    .toBeLessThanOrEqual(MAX_BASELINE_LIST_GETS);
  expect
    .soft(count, `Baseline invariant: ${kind} list GET count must include initial table fetch`)
    .toBeGreaterThan(0);
}

function licenseDialogLocator(page: Page, title: 'Add License' | 'Edit License') {
  return page
    .getByRole('dialog', { name: title })
    .or(
      page
        .locator('.ant-modal[role="dialog"]')
        .filter({ has: page.getByText(title, { exact: true }) }),
    )
    .first();
}

test.describe('refine phase2 baseline crud baseline', () => {
  test('crud baseline: licenses create/edit/delete with duplicate-fetch RED assertion', async ({
    page,
  }) => {
    await page.addInitScript(seedAuthStorage, e2eIdentity);
    const fixture = await mountCrudMockApi(page);

    await page.goto('/licenses');
    await expect(page.getByRole('button', { name: 'Add License' })).toBeVisible();

    await page.getByRole('button', { name: 'Add License' }).click();
    const addLicenseDialog = licenseDialogLocator(page, 'Add License');
    await expect(addLicenseDialog).toBeVisible();
    await addLicenseDialog.getByRole('button', { name: 'Cancel' }).click();

    const firstRow = page.locator('.ant-table-tbody > tr:not(.ant-table-measure-row)').first();
    await expect(firstRow).toBeVisible();
    await firstRow.getByRole('button', { name: 'edit' }).first().click();
    const editLicenseDialog = licenseDialogLocator(page, 'Edit License');
    await expect(editLicenseDialog).toBeVisible();
    await editLicenseDialog.getByRole('button', { name: 'Cancel' }).click();

    await firstRow.getByRole('button', { name: 'delete' }).first().click();
    await page.locator('.ant-popconfirm-buttons').getByRole('button', { name: 'Cancel' }).click();

    assertDeterministicListFetchBudget('licenses', fixture.counts.listGet.licenses);
  });

  test('crud baseline: proxies create/edit/delete with duplicate-fetch RED assertion', async ({
    page,
  }) => {
    await page.addInitScript(seedAuthStorage, e2eIdentity);
    const fixture = await mountCrudMockApi(page);

    await page.goto('/proxies');
    await expect(page.getByRole('button', { name: 'Add Proxy' })).toBeVisible();

    await page.getByRole('button', { name: 'Add Proxy' }).click();
    const createProxyDialog = page.locator('.ant-modal-wrap:visible').last();
    await expect(createProxyDialog).toBeVisible();
    await createProxyDialog.getByRole('button', { name: 'Cancel' }).click();

    const firstRow = page.locator('.ant-table-tbody > tr:not(.ant-table-measure-row)').first();
    await expect(firstRow).toBeVisible();
    await firstRow.getByRole('button', { name: 'edit' }).first().click();
    const editProxyDialog = page.locator('.ant-modal-wrap:visible').last();
    await expect(editProxyDialog.getByRole('button', { name: 'Update' })).toBeVisible();
    await editProxyDialog.getByRole('button', { name: 'Cancel' }).click();

    await firstRow.getByRole('button', { name: 'delete' }).first().click();

    assertDeterministicListFetchBudget('proxies', fixture.counts.listGet.proxies);
  });

  test('crud baseline: subscriptions create/edit/delete with duplicate-fetch RED assertion', async ({
    page,
  }) => {
    await page.addInitScript(seedAuthStorage, e2eIdentity);
    const fixture = await mountCrudMockApi(page);

    await page.goto('/subscriptions');
    await expect(page.getByRole('button', { name: 'Add Subscription' })).toBeVisible();

    await page.getByRole('button', { name: 'Add Subscription' }).first().click();
    const addSubscriptionDialog = page.getByRole('dialog', { name: 'Add Subscription' });
    await expect(addSubscriptionDialog).toBeVisible();
    await addSubscriptionDialog.getByRole('button', { name: 'Cancel' }).click();

    const firstRow = page.locator('.ant-table-tbody > tr:not(.ant-table-measure-row)').first();
    await expect(firstRow).toBeVisible();
    await firstRow.getByRole('button', { name: 'edit' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Edit Subscription' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).last().click();

    await firstRow.getByRole('button', { name: 'delete' }).first().click();

    assertDeterministicListFetchBudget('subscriptions', fixture.counts.listGet.subscriptions);
  });
});
