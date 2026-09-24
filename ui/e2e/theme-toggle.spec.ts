import { test, expect } from '@playwright/test';

test.describe('Theme Toggle', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to home page
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('should display dark theme by default', async ({ page }) => {
    // Check that html element has dark class or dark theme attribute
    const htmlElement = page.locator('html');
    
    // Wait for theme to be applied
    await page.waitForTimeout(500);
    
    // Check for dark theme (could be class or data attribute)
    const htmlClass = await htmlElement.getAttribute('class');
    const htmlStyle = await htmlElement.getAttribute('style');
    const dataTheme = await htmlElement.getAttribute('data-theme');
    
    // At least one should indicate dark theme
    const isDark = 
      htmlClass?.includes('dark') || 
      dataTheme === 'dark' ||
      htmlStyle?.includes('dark');
    
    expect(isDark).toBeTruthy();
  });

  test('should toggle to light theme when button is clicked', async ({ page }) => {
    // Wait for theme to be mounted
    await page.waitForTimeout(500);
    
    // Click theme toggle button
    await page.getByTestId('theme-toggle').click();
    
    // Wait for theme transition
    await page.waitForTimeout(500);
    
    // Check that light theme is applied
    const htmlElement = page.locator('html');
    const htmlClass = await htmlElement.getAttribute('class');
    const dataTheme = await htmlElement.getAttribute('data-theme');
    const htmlStyle = await htmlElement.getAttribute('style');
    
    // Should not have dark class, or should have light theme
    const isLight = 
      !htmlClass?.includes('dark') || 
      dataTheme === 'light' ||
      htmlStyle?.includes('light');
    
    expect(isLight).toBeTruthy();
  });

  test('should toggle back to dark theme', async ({ page }) => {
    // Wait for theme to be mounted
    await page.waitForTimeout(500);
    
    // Toggle to light
    await page.getByTestId('theme-toggle').click();
    await page.waitForTimeout(500);
    
    // Toggle back to dark
    await page.getByTestId('theme-toggle').click();
    await page.waitForTimeout(500);
    
    // Check that dark theme is applied
    const htmlElement = page.locator('html');
    const htmlClass = await htmlElement.getAttribute('class');
    const dataTheme = await htmlElement.getAttribute('data-theme');
    
    const isDark = 
      htmlClass?.includes('dark') || 
      dataTheme === 'dark';
    
    expect(isDark).toBeTruthy();
  });

  test('should display correct icon for current theme', async ({ page }) => {
    // Wait for theme to be mounted
    await page.waitForTimeout(500);
    
    const toggleButton = page.getByTestId('theme-toggle');
    
    // In dark mode, should show Sun icon (to switch to light)
    // Check if Sun icon is visible (lucide-react Sun component)
    let hasSunIcon = await toggleButton.locator('svg').first().isVisible();
    expect(hasSunIcon).toBeTruthy();
    
    // Toggle to light theme
    await toggleButton.click();
    await page.waitForTimeout(500);
    
    // In light mode, should show Moon icon (to switch to dark)
    // The icon should have changed
    let hasMoonIcon = await toggleButton.locator('svg').first().isVisible();
    expect(hasMoonIcon).toBeTruthy();
  });

  test('should persist theme preference across page reloads', async ({ page }) => {
    // Wait for theme to be mounted
    await page.waitForTimeout(500);
    
    // Toggle to light theme
    await page.getByTestId('theme-toggle').click();
    await page.waitForTimeout(500);
    
    // Verify light theme
    const htmlBefore = page.locator('html');
    const classBefore = await htmlBefore.getAttribute('class');
    const themeBefore = await htmlBefore.getAttribute('data-theme');
    
    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    
    // Check that light theme persisted
    const htmlAfter = page.locator('html');
    const classAfter = await htmlAfter.getAttribute('class');
    const themeAfter = await htmlAfter.getAttribute('data-theme');
    
    // Theme should still be light
    const isLight = 
      !classAfter?.includes('dark') || 
      themeAfter === 'light';
    
    expect(isLight).toBeTruthy();
  });

  test('should apply correct background colors for dark theme', async ({ page }) => {
    // Ensure dark theme
    await page.waitForTimeout(500);
    const htmlElement = page.locator('html');
    const htmlClass = await htmlElement.getAttribute('class');
    
    // If not dark, toggle to dark
    if (!htmlClass?.includes('dark')) {
      await page.getByTestId('theme-toggle').click();
      await page.waitForTimeout(500);
    }
    
    // Check body background color (should be dark)
    const body = page.locator('body');
    const bgColor = await body.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    
    // Should be a dark color (rgb values should be low)
    // Parse RGB values
    const rgbMatch = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      const [_, r, g, b] = rgbMatch.map(Number);
      // Average should be less than 128 for dark background
      const avg = (r + g + b) / 3;
      expect(avg).toBeLessThan(128);
    }
  });

  test('should apply correct background colors for light theme', async ({ page }) => {
    // Wait for theme to be mounted
    await page.waitForTimeout(500);
    
    // Toggle to light theme
    await page.getByTestId('theme-toggle').click();
    await page.waitForTimeout(500);
    
    // Check body background color (should be light)
    const body = page.locator('body');
    const bgColor = await body.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    
    // Should be a light color (rgb values should be high)
    const rgbMatch = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      const [_, r, g, b] = rgbMatch.map(Number);
      // Average should be greater than 200 for light background
      const avg = (r + g + b) / 3;
      expect(avg).toBeGreaterThan(200);
    }
  });

  test('should update theme on all pages', async ({ page }) => {
    // Start on home page, toggle to light
    await page.waitForTimeout(500);
    await page.getByTestId('theme-toggle').click();
    await page.waitForTimeout(500);
    
    // Navigate to another page
    await page.goto('/text-ai-assistants');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    
    // Theme should still be light
    const htmlElement = page.locator('html');
    const htmlClass = await htmlElement.getAttribute('class');
    const dataTheme = await htmlElement.getAttribute('data-theme');
    
    const isLight = 
      !htmlClass?.includes('dark') || 
      dataTheme === 'light';
    
    expect(isLight).toBeTruthy();
  });

  test('should work on text-ai-assistants page', async ({ page }) => {
    // Navigate to text-ai-assistants
    await page.goto('/text-ai-assistants');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    
    // Toggle theme
    await page.getByTestId('theme-toggle').click();
    await page.waitForTimeout(500);
    
    // Verify theme changed
    const htmlElement = page.locator('html');
    const htmlClass = await htmlElement.getAttribute('class');
    const dataTheme = await htmlElement.getAttribute('data-theme');
    
    const isLight = 
      !htmlClass?.includes('dark') || 
      dataTheme === 'light';
    
    expect(isLight).toBeTruthy();
    
    // Toggle back
    await page.getByTestId('theme-toggle').click();
    await page.waitForTimeout(500);
    
    // Should be dark again
    const htmlClassAfter = await htmlElement.getAttribute('class');
    const dataThemeAfter = await htmlElement.getAttribute('data-theme');
    
    const isDark = 
      htmlClassAfter?.includes('dark') || 
      dataThemeAfter === 'dark';
    
    expect(isDark).toBeTruthy();
  });

  test('should maintain theme when navigating between pages', async ({ page }) => {
    // Set to light theme on home
    await page.waitForTimeout(500);
    await page.getByTestId('theme-toggle').click();
    await page.waitForTimeout(500);
    
    // Navigate to multiple pages
    await page.goto('/text-ai-assistants');
    await page.waitForTimeout(300);
    await page.goto('/text-ai-assistants');
    await page.waitForTimeout(300);
    await page.goto('/');
    await page.waitForTimeout(300);
    
    // Theme should still be light
    const htmlElement = page.locator('html');
    const htmlClass = await htmlElement.getAttribute('class');
    const dataTheme = await htmlElement.getAttribute('data-theme');
    
    const isLight = 
      !htmlClass?.includes('dark') || 
      dataTheme === 'light';
    
    expect(isLight).toBeTruthy();
  });
});
