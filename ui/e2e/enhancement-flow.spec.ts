import type { Page } from '@playwright/test';
import type { BatchRequest } from '../../backend/src/types/api.types';
import { test, expect } from './fixtures';

test.describe('Text Enhancement Flow', () => {
  const useTwoAssistants = async (page: Page) => {
    await page.evaluate(() => {
      const options = {
        improve: true, fixMistakes: true, format: false, avoidCommonAiSymbols: false, shorten: false,
        lengthen: false, addEmojis: false, formality: 'Neutral', tone: 'Confident',
        languageLevel: '', translateTo: '',
      };
      localStorage.setItem('aiTextEnhancerWorkflows', JSON.stringify([{
        name: 'Jev Test',
        configs: [
          { id: 1, model: 'open-router-free', aiRoleId: 'editor', options, enabled: true },
          { id: 2, model: 'open-router-free', aiRoleId: 'email_assistant', options, enabled: true },
        ],
      }]));
      localStorage.setItem('aiTextEnhancerLastSelectedWorkflow', JSON.stringify('Jev Test'));
    });
    await page.reload();
    await expect(page.getByTestId('workflow-tab-jev-test')).toHaveAttribute('aria-selected', 'true');
  };

  test.beforeEach(async ({ page }) => {
    await page.goto('/text-ai-assistants');

    await expect(page.getByTestId('input-text')).toHaveCount(1);
    await expect(page.getByTestId('input-text')).toBeVisible();
  });

  async function mockResults(page: Page, text: string) {
    await page.route('**/enhance', route => {
      const { assistants } = route.request().postDataJSON() as BatchRequest;
      return route.fulfill({ json: { results: assistants.map(({ id }) => ({
        id, status: 'success', enhancedText: text, total_tokens: 10,
      })) } });
    });
  }

  async function generate(page: Page, text = 'Source text') {
    await page.getByTestId('input-text').fill(text);
    await page.getByTestId('enhance-button').click();
  }

  test('enables generation when text is entered', async ({ page }) => {
    await expect(page.getByTestId('enhance-button')).toBeDisabled();
    await page.getByTestId('input-text').fill('Text to enhance');
    await expect(page.getByTestId('enhance-button')).toBeEnabled();
  });

  test('accepts optional reference context', async ({ page }) => {
    const context = 'An email reply to a client complaint.';
    await page.getByTestId('context-text').fill(context);
    await expect(page.getByTestId('context-text')).toHaveValue(context);
  });

  test('shows pending state and allows cancellation', async ({ page }) => {
    // Hold the request until cancellation instead of racing a timed response.
    const pending = page.waitForRequest('**/enhance');
    await page.route('**/enhance', () => {});
    await generate(page);
    await pending;
    await expect(page.getByRole('status', { name: 'Assistant is thinking' }).first()).toContainText('Thinking...');
    await page.getByTestId('cancel-button').click();
    await expect(page.getByTestId('enhance-button')).toBeEnabled();
    await expect(page.getByTestId('cancel-button')).not.toBeVisible();
    await expect(page.getByRole('status', { name: 'Assistant is thinking' })).toHaveCount(0);
  });

  test('displays results for each requested assistant', async ({ page }) => {
    await mockResults(page, 'Improved grammar and clarity.');
    await generate(page);
    const outputs = page.getByRole('textbox', { name: 'Generated text' });
    await expect(outputs).toHaveCount(3);
    for (const output of await outputs.all()) await expect(output).toHaveValue('Improved grammar and clarity.');
    await expect(page.getByRole('status', { name: 'Assistant is thinking' })).toHaveCount(0);
  });

  test('copies a generated result', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await mockResults(page, 'Enhanced text to copy');
    await generate(page);
    await page.getByTestId('copy-result-1').click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('Enhanced text to copy');
  });

  test('uses a generated result as the next input', async ({ page }) => {
    await mockResults(page, 'Improved text');
    await generate(page);
    await page.getByTestId('improve-version-1').click();
    await expect(page.getByTestId('input-text')).toHaveValue('Improved text');
    await expect(page.getByTestId('input-text')).toHaveClass(/border-primary/);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('shows a quota error on the affected assistant', async ({ page }) => {
    await page.route('**/enhance', route => {
      const { assistants } = route.request().postDataJSON() as BatchRequest;
      return route.fulfill({ json: { results: assistants.map(({ id }) => ({
        id, status: 'error', error: { code: 'INSUFFICIENT_QUOTA' },
      })) } });
    });
    await generate(page);
    const firstCard = page.getByTestId('assistant-card-1');
    await expect(firstCard.getByRole('alert')).toContainText('token allowance');
    await expect(firstCard).toHaveClass(/border-destructive/);
  });

  test('highlights exactly the successful result selected by Jev', async ({ page }) => {
    await useTwoAssistants(page);
    await page.route('**/enhance', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        results: [
          { id: '1', status: 'success', enhancedText: 'First result', total_tokens: 10 },
          { id: '2', status: 'success', enhancedText: 'Second result', total_tokens: 10 },
        ],
        selection: {
          status: 'success', judge: 'jev', model: 'typesafe/jev-1.13',
          selectedResultId: '2', confidence: 0.9, scores: { '1': 0.16, '2': 0.84 },
        },
      }),
    }));

    await page.getByTestId('input-text').fill('Compare this');
    await page.getByTestId('enhance-button').click();

    await expect(page.locator('[data-testid^="jev-selection-"]')).toHaveCount(1);
    await expect(page.getByTestId('jev-selection-2')).toHaveText('Chosen by Jev');
    await expect(page.getByTestId('assistant-card-2')).toContainText('Second result');
    await expect(page.getByTestId('jev-score-2')).toHaveText('Jev score 84%');
    await expect(page.getByTestId('jev-score-1')).toHaveText('Jev score 16%');
    await expect(page.locator('[data-testid^=\"assistant-card-\"]').first()).toHaveAttribute('data-testid', 'assistant-card-2');
    const savedOrder = await page.evaluate(() => JSON.parse(localStorage.getItem('aiTextEnhancerWorkflows') || '[]')[0].configs.map((config: { id: number }) => config.id));
    expect(savedOrder).toEqual([1, 2]);
    await expect(page.getByText(/best/i)).toHaveCount(0);

    await page.locator('label[for="toggle-2"]').click();
    await expect(page.locator('[data-testid^="jev-selection-"]')).toHaveCount(0);
  });

  test('does not mark skipped, unavailable, absent, or errored selections', async ({ page }) => {
    await useTwoAssistants(page);
    const responses = [
      {
        results: [
          { id: '1', status: 'success', enhancedText: 'Only valid result', total_tokens: 10 },
          { id: '2', status: 'error', error: { code: 'LLM_ERROR' } },
        ],
        selection: { status: 'skipped', reason: 'NOT_ENOUGH_VALID_RESULTS' },
      },
      {
        results: [
          { id: '1', status: 'success', enhancedText: 'Available one', total_tokens: 10 },
          { id: '2', status: 'success', enhancedText: 'Available two', total_tokens: 10 },
        ],
        selection: { status: 'unavailable', reason: 'JUDGE_FAILED' },
      },
      {
        results: [
          { id: '1', status: 'success', enhancedText: 'Successful candidate', total_tokens: 10 },
          { id: '2', status: 'error', error: { code: 'LLM_ERROR' } },
        ],
        selection: {
          status: 'success', judge: 'jev', model: 'typesafe/jev-1.13',
          selectedResultId: '2', confidence: 1, scores: { '1': 0, '2': 1 },
        },
      },
      {
        results: [
          { id: '1', status: 'success', enhancedText: 'First candidate', total_tokens: 10 },
          { id: '2', status: 'success', enhancedText: 'Second candidate', total_tokens: 10 },
        ],
      },
    ];
    let call = 0;
    await page.route('**/enhance', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(responses[call++]),
    }));

    for (const [expectedText, resultIndex] of [
      ['Only valid result', 0],
      ['Available two', 1],
      ['Successful candidate', 0],
      ['Second candidate', 1],
    ] as const) {
      await page.getByTestId('input-text').fill(`Run ${call + 1}`);
      await page.getByTestId('enhance-button').click();
      await expect(page.locator('textarea[aria-label="Generated text"]').nth(resultIndex)).toHaveValue(expectedText);
      await expect(page.locator('[data-testid^="jev-selection-"]')).toHaveCount(0);
    }
  });

  test('removes a previous Jev badge immediately when another generation starts', async ({ page }) => {
    await useTwoAssistants(page);
    let call = 0;
    await page.route('**/enhance', async route => {
      call += 1;
      if (call === 2) return;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            { id: '1', status: 'success', enhancedText: 'One', total_tokens: 10 },
            { id: '2', status: 'success', enhancedText: 'Two', total_tokens: 10 },
          ],
          selection: {
            status: 'success', judge: 'jev', model: 'typesafe/jev-1.13',
            selectedResultId: '1', confidence: 0.8, scores: { '1': 0.8, '2': 0.2 },
          },
        }),
      });
    });
    await page.getByTestId('input-text').fill('First run');
    await page.getByTestId('enhance-button').click();
    await expect(page.getByTestId('jev-selection-1')).toBeVisible();

    await page.getByTestId('input-text').fill('Second run');
    await page.getByTestId('enhance-button').click();
    await expect(page.locator('[data-testid^="jev-selection-"]')).toHaveCount(0);
    await expect(page.locator('[data-testid^="jev-score-"]')).toHaveCount(0);
  });

});
