import { test, expect } from './fixtures';
import { DEFAULT_WORKFLOWS } from '../src/config/workflows.config';

test.describe('Assistant Configuration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/text-ai-assistants');

    await expect(page.getByText('50,000 tokens left')).toBeVisible();
    await expect(page.getByTestId('input-text')).toHaveCount(1);
    await expect(page.getByTestId('input-text')).toBeVisible();
  });

  test('should open add assistant modal', async ({ page }) => {
    await page.getByTestId('add-assistant-button').click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'New AI Assistant' })).toBeVisible();
  });

  test('should add new assistant with custom configuration', async ({ page }) => {
    await page.getByTestId('add-assistant-button').click();

    await expect(page.getByRole('dialog')).toBeVisible();

    await page.locator('select[name="model"]').selectOption('open-router-free');

    await page.locator('select[name="aiRoleId"]').selectOption('email_assistant');

    await page.locator('input[name="improve"]').check();
    await page.locator('input[name="fixMistakes"]').check();

    await page.locator('select[name="formality"]').selectOption('Casual');

    await page.locator('select[name="tone"]').selectOption('Cheerful');

    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByRole('dialog')).not.toBeVisible();

    await expect(page.locator('text=Professional Email Assistant').first()).toBeVisible();
    await expect(page.getByText('OpenRouter Free').first()).toBeVisible();
  });

  test('should cancel adding new assistant', async ({ page }) => {
    await page.getByTestId('add-assistant-button').click();

    await page.locator('select[name="model"]').selectOption('open-router-free');

    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByRole('dialog')).not.toBeVisible();

  });

  test('should edit existing assistant', async ({ page }) => {
    const firstCard = page.locator('[data-testid^="assistant-card-"]').first();
    const configId = await firstCard.getAttribute('data-testid').then(id => id?.split('-').pop());

    await page.getByTestId(`kebab-menu-${configId}`).click();

    await page.getByTestId(`edit-assistant-${configId}`).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByText('Edit assistant', { exact: true })).toBeVisible();

    await page.locator('select[name="tone"]').selectOption('Cheerful');

    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByRole('dialog')).not.toBeVisible();

    await expect(firstCard.getByText('Cheerful')).toBeVisible();
  });

  test('should duplicate existing assistant', async ({ page }) => {
    const initialCount = await page.locator('[data-testid^="assistant-card-"]').count();

    const firstCard = page.locator('[data-testid^="assistant-card-"]').first();
    const configId = await firstCard.getAttribute('data-testid').then(id => id?.split('-').pop());

    await page.getByTestId(`kebab-menu-${configId}`).click();

    await page.getByTestId(`duplicate-assistant-${configId}`).click();

    await expect(page.locator('[data-testid^="assistant-card-"]')).toHaveCount(initialCount + 1);
  });

  test('should toggle assistant enabled/disabled', async ({ page }) => {
    const firstCard = page.locator('[data-testid^="assistant-card-"]').first();
    const cardTestId = await firstCard.getAttribute('data-testid');
    const configId = cardTestId?.split('-').pop();

    const initialOpacity = await firstCard.evaluate((el) => window.getComputedStyle(el).opacity);

    const toggleLabel = firstCard.locator(`label[for="toggle-${configId}"]`);
    await toggleLabel.click();

    await expect.poll(() => firstCard.evaluate(el => getComputedStyle(el).opacity)).not.toBe(initialOpacity);
    await toggleLabel.click();
    await expect.poll(() => firstCard.evaluate(el => getComputedStyle(el).opacity)).toBe(initialOpacity);
  });

  test('should remove assistant', async ({ page }) => {
    await page.getByTestId('add-assistant-button').click();
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByRole('dialog')).not.toBeVisible();

    const initialCount = await page.locator('[data-testid^="assistant-card-"]').count();

    const lastCard = page.locator('[data-testid^="assistant-card-"]').last();
    const cardTestId = await lastCard.getAttribute('data-testid');
    const configId = cardTestId?.split('-').pop();

    const kebabButton = page.getByTestId(`kebab-menu-${configId}`);
    await kebabButton.click();

    await page.getByTestId(`remove-assistant-${configId}`).click();

    await expect(page.locator('[data-testid^="assistant-card-"]')).toHaveCount(initialCount - 1);
  });

  test('should enforce mutual exclusivity of shorten/lengthen options', async ({ page }) => {
    await page.getByTestId('add-assistant-button').click();

    const shortenCheckbox = page.locator('input[name="shorten"]');
    await shortenCheckbox.check();
    await expect(shortenCheckbox).toBeChecked();

    const lengthenCheckbox = page.locator('input[name="lengthen"]');
    await lengthenCheckbox.check();
    await expect(lengthenCheckbox).toBeChecked();

    await expect(shortenCheckbox).not.toBeChecked();

    await shortenCheckbox.check();
    await expect(shortenCheckbox).toBeChecked();

    await expect(lengthenCheckbox).not.toBeChecked();
  });

  test('should display config summary tags correctly', async ({ page }) => {
    await page.getByTestId('add-assistant-button').click();

    await page.locator('input[name="improve"]').check();
    await page.locator('input[name="addEmojis"]').check();
    await page.locator('select[name="formality"]').selectOption('Formal');
    await page.locator('select[name="tone"]').selectOption('Confident');

    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByRole('dialog')).not.toBeVisible();

    const lastCard = page.locator('[data-testid^="assistant-card-"]').last();

    await expect(lastCard.locator('text=Improve')).toBeVisible();
    await expect(lastCard.getByText('Add emojis')).toBeVisible();
    await expect(lastCard.getByText('Formal')).toBeVisible();
    await expect(lastCard.getByText('Confident')).toBeVisible();
  });

  test('should enable save button only when changes are made', async ({ page }) => {
    const firstCard = page.locator('[data-testid^="assistant-card-"]').first();
    const configId = await firstCard.getAttribute('data-testid').then(id => id?.split('-').pop());

    await page.getByTestId(`kebab-menu-${configId}`).click();
    await page.getByTestId(`edit-assistant-${configId}`).click();

    const saveButton = page.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeDisabled();

    await page.locator('select[name="tone"]').selectOption('Engaging');

    await expect(saveButton).toBeEnabled();
  });

  test('should close modal on Escape key', async ({ page }) => {
    await page.getByTestId('add-assistant-button').click();

    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('should handle translation language selection', async ({ page }) => {
    await page.getByTestId('add-assistant-button').click();

    const translateSelect = page.locator('select[name="translateTo"]');
    await translateSelect.selectOption('es');

    await expect(translateSelect).toHaveValue('es');

    const languageLevelSelect = page.locator('select[name="languageLevel"]');
    await languageLevelSelect.selectOption('intermediate');

    await expect(languageLevelSelect).toHaveValue('intermediate');

    await page.getByRole('button', { name: 'Save' }).click();

    const lastCard = page.locator('[data-testid^="assistant-card-"]').last();
    await expect(lastCard.locator('text=→ Spanish')).toBeVisible();
    await expect(lastCard.locator('text=Intermediate')).toBeVisible();
  });

  test('should persist assistant configurations across page reloads', async ({ page }) => {
    await page.getByTestId('add-assistant-button').click();
    await page.locator('select[name="aiRoleId"]').selectOption('email_assistant');
    await page.locator('input[name="improve"]').check();
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.locator('text=Professional Email Assistant').first()).toBeVisible();

    await page.reload();
    await expect(page.getByText('50,000 tokens left')).toBeVisible();
    await expect(page.getByTestId('input-text')).toHaveCount(1);
    await expect(page.getByTestId('input-text')).toBeVisible();

    await expect(page.locator('text=Professional Email Assistant').first()).toBeVisible();
  });

  test('keeps a newly added assistant after loading saved workflows', async ({ page }) => {
    await page.evaluate((defaults) => {
      const workflows = structuredClone(defaults);
      localStorage.setItem('aiTextEnhancerWorkflows', JSON.stringify(workflows));
    }, DEFAULT_WORKFLOWS);
    await page.reload();
    await expect(page.getByTestId('assistant-card-1')).toBeVisible();

    await page.getByTestId('add-assistant-button').click();
    await page.locator('select[name="aiRoleId"]').selectOption('email_assistant');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('[data-testid^="assistant-card-"]')).toHaveCount(4);
    await expect(page.getByRole('heading', { name: 'Professional Email Assistant' })).toBeVisible();

    await page.getByTestId('workflow-tab-formal-email').click();
    await page.getByTestId('workflow-tab-quick-fix').click();
    await expect(page.locator('[data-testid^="assistant-card-"]')).toHaveCount(4);

    await page.reload();
    await expect(page.locator('[data-testid^="assistant-card-"]')).toHaveCount(4);
    await expect(page.getByRole('heading', { name: 'Professional Email Assistant' })).toBeVisible();
  });
});
