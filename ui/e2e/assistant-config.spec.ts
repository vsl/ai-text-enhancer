import { test, expect } from '@playwright/test';

test.describe('Assistant Configuration', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the text AI assistants page
    await page.goto('/text-ai-assistants');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('should open add assistant modal', async ({ page }) => {
    // Click Add Assistant button
    await page.getByTestId('add-assistant-button').click();
    
    // Modal should open
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Add Assistant', { exact: false })).toBeVisible();
  });

  test('should add new assistant with custom configuration', async ({ page }) => {
    // Click Add Assistant
    await page.getByTestId('add-assistant-button').click();
    
    // Wait for modal
    await expect(page.getByRole('dialog')).toBeVisible();
    
    // Select model
    await page.locator('select[name="model"]').selectOption('open-router-free');
    
    // Select AI Role
    await page.locator('select[name="aiRoleId"]').selectOption('summarizer');
    
    // Check some action options
    await page.locator('input[name="improve"]').check();
    await page.locator('input[name="fixMistakes"]').check();
    
    // Select formality
    await page.locator('select[name="formality"]').selectOption('Casual');
    
    // Select tone
    await page.locator('select[name="tone"]').selectOption('Cheerful');
    
    // Click Save button
    await page.getByRole('button', { name: 'Save' }).click();
    
    // Modal should close
    await expect(page.getByRole('dialog')).not.toBeVisible();
    
    // New assistant card should appear
    await expect(page.locator('text=Summarizer Assistant').first()).toBeVisible();
    await expect(page.getByText('OpenRouter Free').first()).toBeVisible();
  });

  test('should cancel adding new assistant', async ({ page }) => {
    // Click Add Assistant
    await page.getByTestId('add-assistant-button').click();
    
    // Make some changes
    await page.locator('select[name="model"]').selectOption('open-router-free');
    
    // Click Cancel
    await page.getByRole('button', { name: 'Cancel' }).click();
    
    // Modal should close
    await expect(page.getByRole('dialog')).not.toBeVisible();
    
    // Changes should not be saved (no new assistant with open-router-free model added)
    // Note: This assumes the default workflow doesn't have open-router-free
  });

  test('should edit existing assistant', async ({ page }) => {
    // Get the first assistant card
    const firstCard = page.locator('[data-testid^="assistant-card-"]').first();
    const configId = await firstCard.getAttribute('data-testid').then(id => id?.split('-').pop());
    
    // Open kebab menu
    await page.getByTestId(`kebab-menu-${configId}`).click();
    
    // Click Edit Assistant
    await page.getByTestId(`edit-assistant-${configId}`).click();
    
    // Modal should open with edit mode (title shows "Editing: {role}")
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Editing:', { exact: false })).toBeVisible();
    
    // Change tone
    await page.locator('select[name="tone"]').selectOption('Cheerful');
    
    // Save changes
    await page.getByRole('button', { name: 'Save' }).click();
    
    // Modal should close
    await expect(page.getByRole('dialog')).not.toBeVisible();
    
    // Verify changes reflected in summary tags
    await expect(firstCard.locator('text=😄 Cheerful')).toBeVisible();
  });

  test('should duplicate existing assistant', async ({ page }) => {
    // Count initial assistants
    const initialCount = await page.locator('[data-testid^="assistant-card-"]').count();
    
    // Get the first assistant card
    const firstCard = page.locator('[data-testid^="assistant-card-"]').first();
    const configId = await firstCard.getAttribute('data-testid').then(id => id?.split('-').pop());
    
    // Open kebab menu
    await page.getByTestId(`kebab-menu-${configId}`).click();
    
    // Click Duplicate Assistant
    await page.getByTestId(`duplicate-assistant-${configId}`).click();
    
    // Wait a moment for state update
    await page.waitForTimeout(500);
    
    // Verify assistant count increased by 1
    const newCount = await page.locator('[data-testid^="assistant-card-"]').count();
    expect(newCount).toBe(initialCount + 1);
  });

  test('should toggle assistant enabled/disabled', async ({ page }) => {
    // Get the first assistant card
    const firstCard = page.locator('[data-testid^="assistant-card-"]').first();
    const cardTestId = await firstCard.getAttribute('data-testid');
    const configId = cardTestId?.split('-').pop();
    
    // Get initial opacity (enabled should be 100%, disabled should be 60%)
    const initialOpacity = await firstCard.evaluate((el) => window.getComputedStyle(el).opacity);
    
    // Find and click the toggle switch label (the visible element)
    const toggleLabel = firstCard.locator(`label[for="toggle-${configId}"]`);
    await toggleLabel.click();
    
    // Wait for animation
    await page.waitForTimeout(300);
    
    // Verify opacity changed
    const newOpacity = await firstCard.evaluate((el) => window.getComputedStyle(el).opacity);
    expect(newOpacity).not.toBe(initialOpacity);
    
    // Toggle back
    await toggleLabel.click();
    await page.waitForTimeout(300);

    // Opacity should return to initial (allow for small floating point differences from transitions)
    const finalOpacity = await firstCard.evaluate((el) => window.getComputedStyle(el).opacity);
    const initialOpacityNum = parseFloat(initialOpacity);
    const finalOpacityNum = parseFloat(finalOpacity);
    expect(Math.abs(finalOpacityNum - initialOpacityNum)).toBeLessThan(0.01);
  });

  test('should remove assistant', async ({ page }) => {
    // Add a new assistant first (so we don't remove defaults)
    await page.getByTestId('add-assistant-button').click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: 'Save' }).click();
    
    // Wait for modal to close and state to update
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page.waitForTimeout(500);
    
    // Count assistants
    const initialCount = await page.locator('[data-testid^="assistant-card-"]').count();
    
    // Get the last assistant card (the one we just added)
    const lastCard = page.locator('[data-testid^="assistant-card-"]').last();
    const cardTestId = await lastCard.getAttribute('data-testid');
    const configId = cardTestId?.split('-').pop();
    
    // Open kebab menu
    const kebabButton = page.getByTestId(`kebab-menu-${configId}`);
    await kebabButton.click({ force: true });
    await page.waitForTimeout(200);
    
    // Click Remove Assistant
    await page.getByTestId(`remove-assistant-${configId}`).click();
    
    // Wait for state update
    await page.waitForTimeout(500);
    
    // Verify assistant count decreased by 1
    const newCount = await page.locator('[data-testid^="assistant-card-"]').count();
    expect(newCount).toBe(initialCount - 1);
  });

  test('should enforce mutual exclusivity of shorten/lengthen options', async ({ page }) => {
    // Open add assistant modal
    await page.getByTestId('add-assistant-button').click();
    
    // Check "shorten" option
    const shortenCheckbox = page.locator('input[name="shorten"]');
    await shortenCheckbox.check();
    await expect(shortenCheckbox).toBeChecked();
    
    // Now check "lengthen" option
    const lengthenCheckbox = page.locator('input[name="lengthen"]');
    await lengthenCheckbox.check();
    await expect(lengthenCheckbox).toBeChecked();
    
    // "shorten" should now be unchecked
    await expect(shortenCheckbox).not.toBeChecked();
    
    // Now check "shorten" again
    await shortenCheckbox.check();
    await expect(shortenCheckbox).toBeChecked();
    
    // "lengthen" should be unchecked
    await expect(lengthenCheckbox).not.toBeChecked();
  });

  test('should display config summary tags correctly', async ({ page }) => {
    // Open add assistant modal
    await page.getByTestId('add-assistant-button').click();
    
    // Configure assistant with specific options
    await page.locator('input[name="improve"]').check();
    await page.locator('input[name="addEmojis"]').check();
    await page.locator('select[name="formality"]').selectOption('Formal');
    await page.locator('select[name="tone"]').selectOption('Confident');
    
    // Save
    await page.getByRole('button', { name: 'Save' }).click();
    
    // Wait for modal to close
    await expect(page.getByRole('dialog')).not.toBeVisible();
    
    // Get the last assistant card (the one we just added)
    const lastCard = page.locator('[data-testid^="assistant-card-"]').last();
    
    // Verify summary tags are displayed
    await expect(lastCard.locator('text=Improve')).toBeVisible();
    await expect(lastCard.locator('text=+ Emojis')).toBeVisible();
    await expect(lastCard.locator('text=🧐 Formal')).toBeVisible();
    await expect(lastCard.locator('text=😎 Confident')).toBeVisible();
  });

  test('should enable save button only when changes are made', async ({ page }) => {
    // Get the first assistant card
    const firstCard = page.locator('[data-testid^="assistant-card-"]').first();
    const configId = await firstCard.getAttribute('data-testid').then(id => id?.split('-').pop());
    
    // Open edit modal
    await page.getByTestId(`kebab-menu-${configId}`).click();
    await page.getByTestId(`edit-assistant-${configId}`).click();
    
    // Save button should be disabled initially (no changes)
    const saveButton = page.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeDisabled();
    
    // Make a change
    await page.locator('select[name="tone"]').selectOption('Engaging');
    
    // Save button should now be enabled
    await expect(saveButton).toBeEnabled();
  });

  test('should close modal on Escape key', async ({ page }) => {
    // Open add assistant modal
    await page.getByTestId('add-assistant-button').click();
    
    // Modal should be visible
    await expect(page.getByRole('dialog')).toBeVisible();
    
    // Press Escape
    await page.keyboard.press('Escape');
    
    // Modal should close
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('should handle translation language selection', async ({ page }) => {
    // Open add assistant modal
    await page.getByTestId('add-assistant-button').click();

    // Select translation language (using language code, not name)
    const translateSelect = page.locator('select[name="translateTo"]');
    await translateSelect.selectOption('es');

    // Verify it's selected (value is the language code)
    await expect(translateSelect).toHaveValue('es');
    
    // Language level should become relevant
    const languageLevelSelect = page.locator('select[name="languageLevel"]');
    await languageLevelSelect.selectOption('intermediate');
    
    // Verify it's selected
    await expect(languageLevelSelect).toHaveValue('intermediate');
    
    // Save
    await page.getByRole('button', { name: 'Save' }).click();
    
    // Verify translation tag appears in summary
    const lastCard = page.locator('[data-testid^="assistant-card-"]').last();
    await expect(lastCard.locator('text=→ Spanish')).toBeVisible();
    await expect(lastCard.locator('text=Intermediate')).toBeVisible();
  });

  test('should persist assistant configurations across page reloads', async ({ page }) => {
    // Add a new assistant with specific config
    await page.getByTestId('add-assistant-button').click();
    await page.locator('select[name="aiRoleId"]').selectOption('email_assistant');
    await page.locator('input[name="improve"]').check();
    await page.getByRole('button', { name: 'Save' }).click();
    
    // Wait for save
    await page.waitForTimeout(500);
    
    // Verify assistant exists
    await expect(page.locator('text=Professional Email Assistant').first()).toBeVisible();
    
    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Assistant should still be there
    await expect(page.locator('text=Professional Email Assistant').first()).toBeVisible();
  });
});
