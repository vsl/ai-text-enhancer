import { test, expect } from '@playwright/test';

test('public navigation and truthful landing page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Stop repeating the same instructions to AI.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Home', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'App', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'About' })).toHaveCount(0);
  const removedPage = await page.request.get('/about');
  expect(removedPage.status()).toBe(404);
  await expect(page.locator('footer a', { hasText: 'GitHub' })).toHaveAttribute('href', 'https://github.com/vsl/ai-text-enhancer');
  await expect(page.locator('body')).not.toContainText(/1M\+|99\.9%|thousands of users|Trusted by Users Worldwide|enterprise-grade security/i);
  await page.getByRole('link', { name: 'App', exact: true }).click();
  await expect(page).toHaveURL('/text-ai-assistants');
  await expect(page.getByTestId('input-text')).toBeVisible();
});
