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

function createFixture() {
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
        key: 'SIN-PHASE3-0001',
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

  return { bots, data };
}

async function mountMockApi(page: Page) {
  const fixture = createFixture();

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
        await route.fulfill(toJsonResponse(envelope(collection, { total: collection.length })));
        return;
      }

      if (method === 'GET' && id) {
        const found = collection.find((item) => item.id === id);
        await route.fulfill(toJsonResponse(envelope(found ?? null), found ? 200 : 404));
        return;
      }

      if (method === 'POST' && !id) {
        const body = request.postDataJSON() as Record<string, unknown>;
        const next: ResourceRecord = {
          ...body,
          id: `${kind}-created-${Date.now()}`,
          created_at: Number(body.created_at ?? Date.now()),
          updated_at: Number(body.updated_at ?? Date.now()),
        };
        collection.unshift(next);
        await route.fulfill(toJsonResponse(envelope(next), 201));
        return;
      }

      if (method === 'PATCH' && id) {
        const body = request.postDataJSON() as Record<string, unknown>;
        const index = collection.findIndex((item) => item.id === id);
        if (index >= 0) {
          const current = collection[index];
          if (current) {
            collection[index] = {
              ...current,
              ...body,
              id: String(current.id),
              created_at: Number(current.created_at ?? Date.now()),
              updated_at: Number(body.updated_at ?? Date.now()),
            };
          }
        }
        await route.fulfill(toJsonResponse(envelope(collection[index] ?? { id })));
        return;
      }

      if (method === 'DELETE' && id) {
        const index = collection.findIndex((item) => item.id === id);
        if (index >= 0) {
          collection.splice(index, 1);
        }
        await route.fulfill(toJsonResponse(envelope({ id, deleted: true })));
        return;
      }

      await route.fulfill(toJsonResponse(envelope({ ok: true })));
      return;
    }

    if (method === 'GET') {
      await route.fulfill(toJsonResponse(envelope([], { total: 0 })));
      return;
    }

    await route.fulfill(toJsonResponse(envelope({ id: 'e2e-item' })));
  });
}

test.describe('refine phase3 crud wiring baseline', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(seedAuthStorage, e2eIdentity);
    await mountMockApi(page);
  });

  test('route parity: direct urls render target pages', async ({ page }) => {
    await page.goto('/licenses');
    await expect(page).toHaveURL(/\/licenses$/);
    await expect(page.getByRole('button', { name: 'Add License' })).toBeVisible();

    await page.goto('/proxies');
    await expect(page).toHaveURL(/\/proxies$/);
    await expect(page.getByRole('button', { name: 'Add Proxy' })).toBeVisible();

    await page.goto('/subscriptions');
    await expect(page).toHaveURL(/\/subscriptions$/);
    await expect(page.getByRole('button', { name: 'Add Subscription' })).toBeVisible();
  });

  test('route parity: sidebar navigation changes URL to target resources', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Expand all' }).click();

    await page.getByRole('treeitem', { name: /Licenses/i }).click();
    await expect(page).toHaveURL(/\/licenses$/);

    await page.getByRole('treeitem', { name: /Proxies/i }).click();
    await expect(page).toHaveURL(/\/proxies$/);

    await page.getByRole('treeitem', { name: /Subscriptions/i }).click();
    await expect(page).toHaveURL(/\/subscriptions$/);
  });

  test('crud modal lifecycle: create/edit dialogs open with expected labels', async ({ page }) => {
    await page.goto('/licenses');
    await page.getByRole('button', { name: 'Add License' }).click();
    await expect(page.getByRole('dialog', { name: 'Add License' })).toBeVisible();
    await page
      .getByRole('dialog', { name: 'Add License' })
      .getByRole('button', { name: 'Cancel' })
      .click();

    await page.goto('/proxies');
    await page.getByRole('button', { name: 'Add Proxy' }).click();
    await expect(page.getByRole('dialog', { name: 'Add Proxy' })).toBeVisible();
    await page
      .getByRole('dialog', { name: 'Add Proxy' })
      .getByRole('button', { name: 'Cancel' })
      .click();

    await page.goto('/subscriptions');
    await page.getByRole('button', { name: 'Add Subscription' }).click();
    await expect(page.getByRole('dialog', { name: 'Add Subscription' })).toBeVisible();
    await page
      .getByRole('dialog', { name: 'Add Subscription' })
      .getByRole('button', { name: 'Cancel' })
      .click();
  });
});
