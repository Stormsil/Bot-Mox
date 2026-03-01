import { expect, test } from '@playwright/test';

test('smoke: login page loads', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /Bot-Mox/i })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Password' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});
