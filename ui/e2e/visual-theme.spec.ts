import { test, expect } from '@playwright/test';

test('Home and App share one graphite theme without a switch', async ({ page }) => {
  for (const route of ['/', '/text-ai-assistants']) {
    await page.goto(route);
    await expect(page.getByRole('button', { name: /toggle theme/i })).toHaveCount(0);
    const tokens = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      return {
        background: root.getPropertyValue('--background').trim(),
        primary: root.getPropertyValue('--primary').trim(),
        colorScheme: root.colorScheme,
      };
    });
    expect(tokens).toEqual({ background: '#0b0d10', primary: '#7c5cfc', colorScheme: 'dark' });
  }
});

test('App content stays inside the shared grid on desktop and mobile', async ({ page }) => {
  await page.goto('/text-ai-assistants');
  const heading = page.getByRole('heading', { level: 1 });
  const header = page.locator('header .content-grid');
  await expect(heading).toBeVisible();
  const desktop = await Promise.all([heading.boundingBox(), header.boundingBox()]);
  expect(desktop[0]!.x).toBeGreaterThanOrEqual(desktop[1]!.x);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('input-text')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test('a saved workflow hydrates without a React mismatch', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('aiTextEnhancerLastSelectedWorkflow', JSON.stringify('Formal Email'));
  });
  await page.goto('/text-ai-assistants');
  await expect(page.getByTestId('workflow-tab-formal-email')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { level: 1, name: 'Formal Email' })).toBeVisible();
  expect(errors.filter(error => error.includes('Hydration failed'))).toEqual([]);
});
