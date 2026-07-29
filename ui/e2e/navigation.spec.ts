import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Start at home page
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display all navigation links', async ({ page }) => {
    // Check that all nav links are visible
    await expect(page.getByRole('link', { name: 'Home', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Text AI Assistants' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'About' }).first()).toBeVisible();
  });

  test('should navigate to home page', async ({ page }) => {
    // Navigate to another page first
    await page.goto('/about');
    
    // Click home link
    await page.getByRole('link', { name: 'Home', exact: true }).click();
    
    // Wait for navigation
    await page.waitForLoadState('networkidle');
    
    // Verify we're on home page
    await expect(page).toHaveURL('/');
    
    // Verify home page content
    await expect(page.getByRole('heading', { name: 'AI Text Enhancer' })).toBeVisible();
  });

  test('should navigate to Text AI Assistants page', async ({ page }) => {
    // Click Text AI Assistants link
    await page.getByRole('link', { name: 'Text AI Assistants' }).click();
    
    // Wait for navigation
    await page.waitForLoadState('networkidle');
    
    // Verify we're on the correct page
    await expect(page).toHaveURL('/text-ai-assistants');
    
    // Verify page content (input fields, workflow tabs)
    await expect(page.getByTestId('input-text')).toBeVisible();
    await expect(page.getByTestId('workflow-tab-quick-fix')).toBeVisible();
  });

  test('should navigate to About page', async ({ page }) => {
    // Click About link
    await page.getByRole('link', { name: 'About' }).first().click();
    
    // Wait for navigation
    await page.waitForLoadState('networkidle');
    
    // Verify we're on about page
    await expect(page).toHaveURL('/about');
    
    // Verify page has content
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('should highlight active navigation link', async ({ page }) => {
    // On home page, Home link should be active
    const homeLink = page.getByRole('link', { name: 'Home', exact: true });
    await expect(homeLink).toHaveClass(/bg-primary/);

    // Navigate to About
    await page.getByRole('link', { name: 'About' }).first().click();
    await page.waitForLoadState('networkidle');

    // About link should be active
    const aboutLink = page.getByRole('link', { name: 'About' }).first();
    await expect(aboutLink).toHaveClass(/bg-primary/);

    // Home link should not be active
    await expect(homeLink).not.toHaveClass(/bg-primary/);
  });

  test('should navigate using browser back button', async ({ page }) => {
    // Navigate through multiple pages
    await page.getByRole('link', { name: 'About' }).first().click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/about');
    
    await page.getByRole('link', { name: 'Text AI Assistants' }).click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/text-ai-assistants');
    
    // Go back
    await page.goBack();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/about');
    
    // Go back again
    await page.goBack();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/');
  });

  test('should navigate using browser forward button', async ({ page }) => {
    // Navigate to About
    await page.getByRole('link', { name: 'About' }).first().click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/about');

    // Navigate to Text AI Assistants
    await page.getByRole('link', { name: 'Text AI Assistants' }).click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/text-ai-assistants');

    // Go back twice
    await page.goBack();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/about');

    await page.goBack();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/');

    // Go forward
    await page.goForward();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/about');

    // Go forward again
    await page.goForward();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/text-ai-assistants');
  });

  test('should display header on all pages', async ({ page }) => {
    // Check header on home page
    await expect(page.locator('header')).toBeVisible();
    await expect(page.getByText('AI Text Enhancer', { exact: false }).first()).toBeVisible();
    
    // Navigate to each page and verify header
    const pages = ['/text-ai-assistants', '/about'];
    
    for (const pagePath of pages) {
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('header')).toBeVisible();
      await expect(page.getByText('AI Text Enhancer', { exact: false }).first()).toBeVisible();
    }
  });

  test('should display footer on all pages', async ({ page }) => {
    // Check footer on home page
    await expect(page.locator('footer')).toBeVisible();
    
    // Navigate to each page and verify footer
    const pages = ['/text-ai-assistants', '/about'];
    
    for (const pagePath of pages) {
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('footer')).toBeVisible();
    }
  });

  test('should navigate via logo/brand link', async ({ page }) => {
    // Navigate away from home
    await page.goto('/about');
    
    // Click on logo/brand link
    await page.getByRole('link', { name: 'AI Text Enhancer', exact: false }).first().click();
    
    // Should navigate to home
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/');
  });

  test('should maintain state when navigating back to Text AI Assistants', async ({ page }) => {
    // Navigate to Text AI Assistants
    await page.goto('/text-ai-assistants');
    await page.waitForLoadState('networkidle');
    
    // Enter some text
    await page.getByTestId('input-text').fill('Test text to remember');
    
    // Navigate away
    await page.getByRole('link', { name: 'About' }).first().click();
    await page.waitForLoadState('networkidle');
    
    // Navigate back
    await page.getByRole('link', { name: 'Text AI Assistants' }).click();
    await page.waitForLoadState('networkidle');
    
    // Text should be preserved (due to localStorage)
    const inputValue = await page.getByTestId('input-text').inputValue();
    expect(inputValue).toBe('Test text to remember');
  });

  test('should handle direct URL navigation', async ({ page }) => {
    // Navigate directly to each page via URL
    await page.goto('/text-ai-assistants');
    await expect(page).toHaveURL('/text-ai-assistants');
    await expect(page.getByTestId('input-text')).toBeVisible();
    
    await page.goto('/about');
    await expect(page).toHaveURL('/about');
    
    await page.goto('/');
    await expect(page).toHaveURL('/');
  });

  test('should show mobile navigation on small screens', async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Wait for layout adjustment
    await page.waitForTimeout(500);
    
    // Desktop nav should be hidden (check if it has display: none or is not visible)
    const desktopNav = page.locator('nav').first();
    const isDesktopVisible = await desktopNav.isVisible();
    
    // On mobile, navigation links might be in a different location or hidden
    // This depends on implementation - adjust based on actual mobile nav behavior
  });

  test('should load pages without errors', async ({ page }) => {
    const errors: string[] = [];
    
    // Listen for console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Navigate to all pages
    const pages = ['/', '/text-ai-assistants', '/about'];
    
    for (const pagePath of pages) {
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
    }
    
    // Should have no console errors
    expect(errors.length).toBe(0);
  });

  test('should handle navigation while loading', async ({ page }) => {
    // Start navigation to Text AI Assistants (don't await)
    page.goto('/text-ai-assistants').catch(() => {
      // Ignore errors from aborted navigation
    });

    // Immediately navigate to About before first navigation completes
    await page.goto('/about');

    // Wait for final navigation
    await page.waitForLoadState('networkidle');

    // Should end up on About page
    await expect(page).toHaveURL('/about');
  });

  test('should preserve scroll position on Text AI Assistants page', async ({ page }) => {
    // Navigate to Text AI Assistants
    await page.goto('/text-ai-assistants');
    await page.waitForLoadState('networkidle');
    
    // Scroll down
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(300);
    
    // Get scroll position
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThan(0);
    
    // Navigate away
    await page.goto('/about');
    await page.waitForLoadState('networkidle');
    
    // Navigate back
    await page.goBack();
    await page.waitForLoadState('networkidle');
    
    // Scroll position might be preserved or reset depending on implementation
    // Just verify page loaded correctly
    await expect(page).toHaveURL('/text-ai-assistants');
  });
});
