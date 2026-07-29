import { test, expect } from '@playwright/test';

test.describe('Workflow Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the text AI assistants page
    await page.goto('/text-ai-assistants');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('should display default workflows', async ({ page }) => {
    // Check that default workflow tabs are visible
    await expect(page.getByTestId('workflow-tab-quick-fix')).toBeVisible();
    await expect(page.getByTestId('workflow-tab-formal-email')).toBeVisible();
    await expect(page.getByTestId('workflow-tab-social-media-blast')).toBeVisible();
  });

  test('should load different workflows when clicking tabs', async ({ page }) => {
    // Click on Formal Email workflow
    await page.getByTestId('workflow-tab-formal-email').click();
    
    // Verify the workflow is active (aria-selected should be true)
    await expect(page.getByTestId('workflow-tab-formal-email')).toHaveAttribute('aria-selected', 'true');
    
    // Click on Social Media Blast workflow
    await page.getByTestId('workflow-tab-social-media-blast').click();
    
    // Verify the workflow switched
    await expect(page.getByTestId('workflow-tab-social-media-blast')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('workflow-tab-formal-email')).toHaveAttribute('aria-selected', 'false');
  });

  test('should create a new workflow', async ({ page }) => {
    // Click the create workflow button (+)
    await page.getByTestId('create-workflow-button').click();
    
    // Wait for modal to open
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Create New Workflow')).toBeVisible();
    
    // Enter workflow name
    const workflowName = 'Test Workflow ' + Date.now();
    await page.getByTestId('workflow-name-input').fill(workflowName);
    
    // Click Create button
    await page.getByTestId('create-workflow-submit').click();
    
    // Wait for modal to close with increased timeout
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });
    
    // Verify new workflow tab appears
    const newWorkflowTabId = `workflow-tab-${workflowName.toLowerCase().replace(/\s+/g, '-')}`;
    await expect(page.getByTestId(newWorkflowTabId)).toBeVisible();
    
    // Verify it's the active tab
    await expect(page.getByTestId(newWorkflowTabId)).toHaveAttribute('aria-selected', 'true');
  });

  test('should validate workflow name is not empty', async ({ page }) => {
    // Click create workflow button
    await page.getByTestId('create-workflow-button').click();
    
    // Try to create without entering a name
    await expect(page.getByTestId('create-workflow-submit')).toBeDisabled();
    
    // Enter some spaces only
    await page.getByTestId('workflow-name-input').fill('   ');
    
    // Create button should still be disabled
    await expect(page.getByTestId('create-workflow-submit')).toBeDisabled();
    
    // Verify error message
    await expect(page.getByText('Workflow name cannot be empty.')).toBeVisible();
  });

  test('should validate workflow name is unique', async ({ page }) => {
    // Click create workflow button
    await page.getByTestId('create-workflow-button').click();
    
    // Wait for modal to open
    await expect(page.getByRole('dialog')).toBeVisible();
    
    // Try to create a workflow with existing name (case-insensitive)
    await page.getByTestId('workflow-name-input').fill('quick fix');
    
    // Verify error message appears
    await expect(page.getByText('A workflow with this name already exists.')).toBeVisible();
    
    // Create button should be disabled
    await expect(page.getByTestId('create-workflow-submit')).toBeDisabled();
  });

  test('should cancel workflow creation', async ({ page }) => {
    // Click create workflow button
    await page.getByTestId('create-workflow-button').click();
    
    // Enter a name
    await page.getByTestId('workflow-name-input').fill('Test Cancel');
    
    // Click Cancel
    await page.getByTestId('cancel-workflow-button').click();
    
    // Modal should close
    await expect(page.getByRole('dialog')).not.toBeVisible();
    
    // Workflow should not be created
    await expect(page.getByTestId('workflow-tab-test-cancel')).not.toBeVisible();
  });

  test('should delete custom workflow', async ({ page }) => {
    // First, create a workflow to delete
    await page.getByTestId('create-workflow-button').click();
    const workflowName = 'To Delete ' + Date.now();
    await page.getByTestId('workflow-name-input').fill(workflowName);
    await page.getByTestId('create-workflow-submit').click();
    
    // Wait for create workflow modal to close
    await page.waitForTimeout(500);
    
    // Wait for workflow to be created
    const workflowTabId = `workflow-tab-${workflowName.toLowerCase().replace(/\s+/g, '-')}`;
    await expect(page.getByTestId(workflowTabId)).toBeVisible();
    
    // Click delete button on the workflow tab
    const deleteButtonId = `delete-workflow-${workflowName.toLowerCase().replace(/\s+/g, '-')}`;
    await page.getByTestId(deleteButtonId).click({ force: true });
    
    // Wait for confirmation modal
    await page.waitForTimeout(300);
    
    // Confirmation modal should appear
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Confirm Deletion')).toBeVisible();
    await expect(page.getByRole('dialog').getByText(workflowName, { exact: false })).toBeVisible();
    
    // Click Delete in confirmation modal
    await page.getByTestId('confirm-delete-button').click();
    
    // Modal should close
    await expect(page.getByRole('dialog')).not.toBeVisible();
    
    // Workflow tab should be removed
    await expect(page.getByTestId(workflowTabId)).not.toBeVisible();
  });

  test('should cancel workflow deletion', async ({ page }) => {
    // First, create a workflow
    await page.getByTestId('create-workflow-button').click();
    const workflowName = 'Keep This ' + Date.now();
    await page.getByTestId('workflow-name-input').fill(workflowName);
    await page.getByTestId('create-workflow-submit').click();
    
    // Wait for create workflow modal to close
    await page.waitForTimeout(500);
    
    // Wait for workflow to be created
    const workflowTabId = `workflow-tab-${workflowName.toLowerCase().replace(/\s+/g, '-')}`;
    await expect(page.getByTestId(workflowTabId)).toBeVisible();
    
    // Click delete button
    const deleteButtonId = `delete-workflow-${workflowName.toLowerCase().replace(/\s+/g, '-')}`;
    await page.getByTestId(deleteButtonId).click({ force: true });
    
    // Wait for confirmation modal
    await page.waitForTimeout(300);
    
    // Click Cancel in confirmation modal
    await page.getByTestId('cancel-delete-button').click();
    
    // Modal should close
    await expect(page.getByRole('dialog')).not.toBeVisible();
    
    // Workflow should still exist
    await expect(page.getByTestId(workflowTabId)).toBeVisible();
  });

  test('should not show delete button on default workflows', async ({ page }) => {
    // Default workflows should not have delete buttons
    await expect(page.getByTestId('delete-workflow-quick-improve')).not.toBeVisible();
    await expect(page.getByTestId('delete-workflow-email-assistant')).not.toBeVisible();
    await expect(page.getByTestId('delete-workflow-academic-writing')).not.toBeVisible();
  });
});
