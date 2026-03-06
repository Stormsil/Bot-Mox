import { expect, test } from '@playwright/test';
import { setupAppMocks } from './fixtures/setupAppMocks';

const e2eIdentity = {
  id: 'e2e-user',
  name: 'E2E User',
  email: 'e2e@example.com',
  roles: ['admin'],
};

function seedAuthStorage(identity: typeof e2eIdentity) {
  localStorage.setItem('botmox.auth.token', 'e2e-token');
  localStorage.setItem('botmox.auth.identity', JSON.stringify(identity));
  localStorage.setItem('botmox.auth.verify_at', String(Date.now()));
}

test('auth guard redirects unauthenticated user to login', async ({ page }) => {
  await page.goto('/finance');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: /Bot-Mox/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});

test('authenticated shell and key routes load with mocked API responses', async ({ page }) => {
  await page.addInitScript(seedAuthStorage, e2eIdentity);
  await setupAppMocks(page, { identity: e2eIdentity });

  const protectedRoutes = ['/', '/finance', '/vms'];

  for (const path of protectedRoutes) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(path === '/' ? '/$' : `${path}$`));
    await expect(page.locator('header')).toBeVisible();
  }
});

test('vm settings preview requests hardware fingerprint and renders response data', async ({
  page,
}) => {
  let hardwareFingerprintRequests = 0;

  await page.addInitScript(seedAuthStorage, e2eIdentity);
  await setupAppMocks(page, {
    identity: e2eIdentity,
    overrides: [
      async ({ pathname, fulfillJson }) => {
        if (pathname !== '/api/v1/vm/hardware-fingerprint') {
          return false;
        }

        hardwareFingerprintRequests += 1;
        await fulfillJson({
          mac: '00:1B:21:AA:BB:CC',
          ssdSerial: '12345678',
          smbiosArgs:
            "args: -cpu 'host' -smbios 'type=1,manufacturer=ASUSTeK COMPUTER INC.,product=ROG STRIX B560-F GAMING WIFI'",
          meta: {
            brand: 'ASUS',
            product: 'ROG STRIX B560-F GAMING WIFI',
            cpu: 'Intel(R) Core(TM) i5-11400F CPU @ 2.60GHz',
          },
        });
        return true;
      },
    ],
  });

  await page.goto('/vms');
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByText('Virtual Machines Settings')).toBeVisible();
  await page.getByRole('button', { name: 'Generate Preview' }).click();

  await expect.poll(() => hardwareFingerprintRequests).toBe(1);
  await expect(page.getByText('ASUS / ROG STRIX B560-F GAMING WIFI')).toBeVisible();
  await expect(page.getByText('00:1B:21:AA:BB:CC')).toBeVisible();
  await expect(page.getByText('12345678')).toBeVisible();
});
