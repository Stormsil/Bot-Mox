import { expect, test } from '@playwright/test';

const e2eIdentity = {
  id: 'e2e-user',
  name: 'E2E User',
  email: 'e2e@example.com',
  roles: ['admin'],
};

type ApiEnvelope = {
  success: true;
  data: unknown;
  meta?: Record<string, unknown>;
};

function envelope(data: unknown, meta?: Record<string, unknown>): ApiEnvelope {
  if (meta) {
    return { success: true, data, meta };
  }
  return { success: true, data };
}

function toJsonResponse(payload: ApiEnvelope): { status: number; contentType: string; body: string } {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  };
}

test('auth guard redirects unauthenticated user to login', async ({ page }) => {
  await page.goto('/finance');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Bot-Mox Login' })).toBeVisible();
});

test('authenticated shell and key routes load with mocked API responses', async ({ page }) => {
  await page.addInitScript((identity) => {
    localStorage.setItem('botmox.auth.token', 'e2e-token');
    localStorage.setItem('botmox.auth.identity', JSON.stringify(identity));
    localStorage.setItem('botmox.auth.verify_at', String(Date.now()));
  }, e2eIdentity);

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const pathname = url.pathname;

    if (pathname === '/api/v1/auth/whoami') {
      await route.fulfill(toJsonResponse(envelope({ uid: e2eIdentity.id, email: e2eIdentity.email, roles: e2eIdentity.roles })));
      return;
    }

    if (pathname.startsWith('/api/v1/resources/')) {
      await route.fulfill(toJsonResponse(envelope([], { total: 0 })));
      return;
    }

    if (pathname === '/api/v1/bots') {
      await route.fulfill(toJsonResponse(envelope([], { total: 0 })));
      return;
    }

    if (pathname.startsWith('/api/v1/bots/')) {
      await route.fulfill(
        toJsonResponse(
          envelope({
            id: 'e2e-bot',
            project_id: 'wow_tbc',
            status: 'offline',
            character: { name: 'E2E Bot' },
          }),
        ),
      );
      return;
    }

    if (pathname.startsWith('/api/v1/workspace/')) {
      const isListLike = method === 'GET' && !pathname.split('/').pop()?.includes('-');
      if (isListLike) {
        await route.fulfill(toJsonResponse(envelope([], { total: 0 })));
        return;
      }

      await route.fulfill(toJsonResponse(envelope({ id: 'e2e-item' })));
      return;
    }

    if (pathname === '/api/v1/finance/operations') {
      await route.fulfill(toJsonResponse(envelope([], { total: 0 })));
      return;
    }

    if (pathname === '/api/v1/finance/daily-stats' || pathname === '/api/v1/finance/gold-price-history') {
      await route.fulfill(toJsonResponse(envelope([])));
      return;
    }

    if (pathname === '/api/v1/theme-assets') {
      await route.fulfill(toJsonResponse(envelope({ generated_at_ms: Date.now(), items: [] })));
      return;
    }

    if (pathname.startsWith('/api/v1/settings/')) {
      await route.fulfill(toJsonResponse(envelope({})));
      return;
    }

    if (method === 'GET') {
      await route.fulfill(toJsonResponse(envelope([])));
      return;
    }

    await route.fulfill(toJsonResponse(envelope({ id: 'e2e-item' })));
  });

  const protectedRoutes = ['/', '/finance', '/vms'];

  for (const path of protectedRoutes) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path === '/' ? '/$' : `${path}$`}`));
    await expect(page.locator('header')).toBeVisible();
  }
});
