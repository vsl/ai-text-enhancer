import { test, expect } from './fixtures';

test.describe('Workflow Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/text-ai-assistants');

    await expect(page.getByTestId('input-text')).toHaveCount(1);
    await expect(page.getByTestId('input-text')).toBeVisible();
  });

  test('should display default workflows', async ({ page }) => {
    await expect(page.getByTestId('workflow-tab-quick-fix')).toBeVisible();
    await expect(page.getByTestId('workflow-tab-formal-email')).toBeVisible();
    await expect(page.getByRole('tab')).toHaveCount(2);
  });

  test('should load different workflows when clicking tabs', async ({ page }) => {
    await page.getByTestId('workflow-tab-formal-email').click();

    await expect(page.getByTestId('workflow-tab-formal-email')).toHaveAttribute('aria-selected', 'true');

    await page.getByTestId('workflow-tab-quick-fix').click();
    await expect(page.getByTestId('workflow-tab-quick-fix')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('workflow-tab-formal-email')).toHaveAttribute('aria-selected', 'false');
  });

  test('should create a new workflow', async ({ page }) => {
    await page.getByTestId('create-workflow-button').click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Create New Workflow')).toBeVisible();

    const workflowName = 'Test Workflow ' + Date.now();
    await page.getByTestId('workflow-name-input').fill(workflowName);

    await page.getByTestId('create-workflow-submit').click();

    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });

    const newWorkflowTabId = `workflow-tab-${workflowName.toLowerCase().replace(/\s+/g, '-')}`;
    await expect(page.getByTestId(newWorkflowTabId)).toBeVisible();

    await expect(page.getByTestId(newWorkflowTabId)).toHaveAttribute('aria-selected', 'true');
  });

  test('should validate workflow name is not empty', async ({ page }) => {
    await page.getByTestId('create-workflow-button').click();

    await expect(page.getByTestId('create-workflow-submit')).toBeDisabled();

    await page.getByTestId('workflow-name-input').fill('   ');

    await expect(page.getByTestId('create-workflow-submit')).toBeDisabled();

    await expect(page.getByText('Workflow name cannot be empty.')).toBeVisible();
  });

  test('should validate workflow name is unique', async ({ page }) => {
    await page.getByTestId('create-workflow-button').click();

    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByTestId('workflow-name-input').fill('quick fix');

    await expect(page.getByText('A workflow with this name already exists.')).toBeVisible();

    await expect(page.getByTestId('create-workflow-submit')).toBeDisabled();
  });

  test('should cancel workflow creation', async ({ page }) => {
    await page.getByTestId('create-workflow-button').click();

    await page.getByTestId('workflow-name-input').fill('Test Cancel');

    await page.getByTestId('cancel-workflow-button').click();

    await expect(page.getByRole('dialog')).not.toBeVisible();

    await expect(page.getByTestId('workflow-tab-test-cancel')).not.toBeVisible();
  });

  test('should delete custom workflow', async ({ page }) => {
    await page.getByTestId('create-workflow-button').click();
    const workflowName = 'To Delete ' + Date.now();
    await page.getByTestId('workflow-name-input').fill(workflowName);
    await page.getByTestId('create-workflow-submit').click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    const workflowTabId = `workflow-tab-${workflowName.toLowerCase().replace(/\s+/g, '-')}`;
    await expect(page.getByTestId(workflowTabId)).toBeVisible();

    const deleteButtonId = `delete-workflow-${workflowName.toLowerCase().replace(/\s+/g, '-')}`;
    await page.getByTestId(deleteButtonId).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Confirm Deletion')).toBeVisible();
    await expect(page.getByRole('dialog').getByText(workflowName, { exact: false })).toBeVisible();

    await page.getByTestId('confirm-delete-button').click();

    await expect(page.getByRole('dialog')).not.toBeVisible();

    await expect(page.getByTestId(workflowTabId)).not.toBeVisible();
  });

  test('should cancel workflow deletion', async ({ page }) => {
    await page.getByTestId('create-workflow-button').click();
    const workflowName = 'Keep This ' + Date.now();
    await page.getByTestId('workflow-name-input').fill(workflowName);
    await page.getByTestId('create-workflow-submit').click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    const workflowTabId = `workflow-tab-${workflowName.toLowerCase().replace(/\s+/g, '-')}`;
    await expect(page.getByTestId(workflowTabId)).toBeVisible();

    const deleteButtonId = `delete-workflow-${workflowName.toLowerCase().replace(/\s+/g, '-')}`;
    await page.getByTestId(deleteButtonId).click();

    await page.getByTestId('cancel-delete-button').click();

    await expect(page.getByRole('dialog')).not.toBeVisible();

    await expect(page.getByTestId(workflowTabId)).toBeVisible();
  });

  test('should not show delete button on default workflows', async ({ page }) => {
    await expect(page.getByTestId('delete-workflow-quick-fix')).not.toBeVisible();
    await expect(page.getByTestId('delete-workflow-formal-email')).not.toBeVisible();
  });
});
