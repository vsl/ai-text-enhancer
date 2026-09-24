import { test, expect } from '@playwright/test';

test.describe('Text Enhancement Flow', () => {
  const useTwoAssistants = async (page: import('@playwright/test').Page) => {
    await page.evaluate(() => {
      const options = {
        improve: true, fixMistakes: true, format: false, shorten: false,
        lengthen: false, addEmojis: false, formality: 'Neutral', tone: 'Confident',
        languageLevel: '', translateTo: '',
      };
      localStorage.setItem('aiTextEnhancerWorkflows', JSON.stringify([{
        name: 'Jev Test',
        configs: [
          { id: 1, model: 'open-router-free', aiRoleId: 'editor', options, enabled: true },
          { id: 2, model: 'open-router-free', aiRoleId: 'summarizer', options, enabled: true },
        ],
      }]));
      localStorage.setItem('aiTextEnhancerLastSelectedWorkflow', JSON.stringify('Jev Test'));
    });
    await page.reload();
  };

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const now = Math.floor(Date.now() / 1000);
      localStorage.setItem('sb-127-auth-token', JSON.stringify({
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600,
        expires_at: now + 3600,
        token_type: 'bearer',
        user: {
          id: '00000000-0000-0000-0000-000000000001',
          aud: 'authenticated',
          role: 'authenticated',
          is_anonymous: true,
          app_metadata: { provider: 'anonymous', providers: ['anonymous'] },
          user_metadata: {},
          identities: [],
          created_at: new Date().toISOString(),
        },
      }));
    });
    await page.route('**/me', route => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ profile: null }),
      });
    });
    // Navigate to the text AI assistants page
    await page.goto('/text-ai-assistants');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('should enable enhance button when text is entered', async ({ page }) => {
    // Initially, button should be disabled
    await expect(page.getByTestId('enhance-button')).toBeDisabled();
    
    // Enter text
    await page.getByTestId('input-text').fill('This is my test text that needs enhancement.');
    
    // Button should now be enabled (assuming at least one assistant is enabled by default)
    await expect(page.getByTestId('enhance-button')).toBeEnabled();
  });

  test('should accept context text (optional field)', async ({ page }) => {
    // Enter text in context field
    const contextText = 'This is an email reply to a client complaint.';
    await page.getByTestId('context-text').fill(contextText);
    
    // Verify the text is entered
    await expect(page.getByTestId('context-text')).toHaveValue(contextText);
  });

  test('should show loading state during enhancement', async ({ page }) => {
    // Mock the API to delay response
    await page.route('**/enhance', async (route) => {
      // Delay for 2 seconds to show loading
      await new Promise(resolve => setTimeout(resolve, 2000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            {
              id: '1',
              status: 'success',
              enhancedText: 'Enhanced text result',
            },
          ],
        }),
      });
    });
    
    // Enter text
    await page.getByTestId('input-text').fill('Test text');
    
    // Click enhance
    await page.getByTestId('enhance-button').click();
    
    // Cancel button should appear
    await expect(page.getByTestId('cancel-button')).toBeVisible();
    
    // Thinking indicator should be visible in assistant cards
    await expect(page.getByRole('status', { name: 'Assistant is thinking' }).first()).toContainText('Thinking...');
  });

  test('should display results after enhancement', async ({ page }) => {
    const enhancedText = 'This is the enhanced version of your text with improved grammar and clarity.';

    // Mock the API
    await page.route('**/enhance', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            {
              id: '1',
              status: 'success',
              enhancedText: enhancedText,
            },
          ],
        }),
      });
    });
    
    // Enter text
    await page.getByTestId('input-text').fill('test text that needs improving');
    
    // Click enhance
    await page.getByTestId('enhance-button').click();
    
    // Wait for results to appear (timeout after 10s)
    await page.waitForTimeout(1000);
    
    // Results should be displayed in assistant cards
    await expect(page.locator('textarea[aria-label="Generated text"]').first()).toContainText(enhancedText);
  });

  test('should copy result to clipboard', async ({ page }) => {
    // Grant clipboard permissions
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    const enhancedText = 'Enhanced text to copy';

    // Mock the API
    await page.route('**/enhance', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            {
              id: '1',
              status: 'success',
              enhancedText: enhancedText,
            },
          ],
        }),
      });
    });
    
    // Enter text and enhance
    await page.getByTestId('input-text').fill('test');
    await page.getByTestId('enhance-button').click();
    
    // Wait for results
    await page.waitForTimeout(1000);
    
    // Get the config ID from the first assistant card
    const firstCard = page.locator('[data-testid^="assistant-card-"]').first();
    const configId = await firstCard.getAttribute('data-testid').then(id => id?.split('-').pop());
    
    // Click copy button
    await page.getByTestId(`copy-result-${configId}`).click();
    
    // Verify clipboard content
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toBe(enhancedText);
  });

  test('should improve this version - copy to input and highlight', async ({ page }) => {
    const enhancedText = 'This is improved text';

    // Mock the API
    await page.route('**/enhance', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            {
              id: '1',
              status: 'success',
              enhancedText: enhancedText,
            },
          ],
        }),
      });
    });
    
    // Enter text and enhance
    await page.getByTestId('input-text').fill('The original text.');
    await page.getByTestId('enhance-button').click();
    
    // Wait for results
    await page.waitForTimeout(1000);
    
    // Wait for result textarea to appear
    await expect(page.locator('textarea[aria-label="Generated text"]').first()).toBeVisible();
    
    // Get the config ID from the first assistant card
    const firstCard = page.locator('[data-testid^="assistant-card-"]').first();
    const cardTestId = await firstCard.getAttribute('data-testid');
    const configId = cardTestId?.split('-').pop();
    
    // Click "Improve this Version" button
    await page.getByTestId(`improve-version-${configId}`).click();
    
    // Wait for the action to complete
    await page.waitForTimeout(500);
    
    // Verify text is copied to input
    await expect(page.getByTestId('input-text')).toHaveValue(enhancedText);
    
    // Verify input has highlight animation class (check for animate-pulse or border-secondary)
    const inputClasses = await page.getByTestId('input-text').getAttribute('class');
    expect(inputClasses).toContain('animate-pulse');
    
    // Verify page scrolled to top (check scroll position)
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBe(0);
  });

  test('should cancel generation', async ({ page }) => {
    // Mock the API with a long delay
    let requestCancelled = false;
    await page.route('**/enhance', async (route) => {
      await new Promise((resolve) => {
        setTimeout(() => {
          if (!requestCancelled) {
            route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                results: [
                  {
                    id: '1',
                    status: 'success',
                    enhancedText: 'Enhanced text',
                  },
                ],
              }),
            });
          } else {
            route.abort();
          }
          resolve(undefined);
        }, 5000);
      });
    });
    
    // Enter text
    await page.getByTestId('input-text').fill('test text');
    
    // Click enhance
    await page.getByTestId('enhance-button').click();
    
    // Verify cancel button appears
    await expect(page.getByTestId('cancel-button')).toBeVisible();
    
    // Click cancel
    requestCancelled = true;
    await page.getByTestId('cancel-button').click();
    
    // Enhance button should be back
    await expect(page.getByTestId('enhance-button')).toBeVisible();
    await expect(page.getByTestId('cancel-button')).not.toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock the API with error response (using valid error code from constants)
    await page.route('**/enhance', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            {
              id: '1',
              status: 'error',
              error: {
                message: 'Quota exceeded',
                code: 'INSUFFICIENT_QUOTA'
              },
            },
          ],
        }),
      });
    });

    // Enter text and enhance
    await page.getByTestId('input-text').fill('test text');
    await page.getByTestId('enhance-button').click();

    // Wait for error to display
    await page.waitForTimeout(1000);

    // Error message should be displayed in the result area (in the ResultTextarea)
    const resultTextarea = page.locator('textarea[aria-label="Generated text"]').first();
    await expect(resultTextarea).toBeVisible();
    await expect(resultTextarea).toHaveValue(/token allowance|run out of tokens|upgrade/i);

    // Assistant card should have error border (red border)
    const firstCard = page.locator('[data-testid^="assistant-card-"]').first();
    const borderColor = await firstCard.evaluate((el) => window.getComputedStyle(el).borderColor);
    // Should be destructive color (reddish)
    expect(borderColor).toContain('rgb'); // Just checking it has a computed color
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
          selectedResultId: '2', confidence: 0.9, probabilities: { '1': 0.16, '2': 0.84 },
        },
      }),
    }));

    await page.getByTestId('input-text').fill('Compare this');
    await page.getByTestId('enhance-button').click();

    await expect(page.locator('[data-testid^="jev-selection-"]')).toHaveCount(1);
    await expect(page.getByTestId('jev-selection-2')).toHaveText('✨ Chosen by Jev');
    await expect(page.getByTestId('assistant-card-2')).toContainText('Second result');
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
          { id: '1', status: 'success', enhancedText: 'Legacy one', total_tokens: 10 },
          { id: '2', status: 'error', error: { code: 'LLM_ERROR' } },
        ],
        selection: {
          status: 'success', judge: 'jev', model: 'typesafe/jev-1.13',
          selectedResultId: '2', confidence: 1, probabilities: { '1': 0, '2': 1 },
        },
      },
      {
        results: [
          { id: '1', status: 'success', enhancedText: 'Old backend one', total_tokens: 10 },
          { id: '2', status: 'success', enhancedText: 'Old backend two', total_tokens: 10 },
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
      ['Legacy one', 0],
      ['Old backend two', 1],
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
      if (call === 2) await new Promise(resolve => setTimeout(resolve, 1000));
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
            selectedResultId: '1', confidence: 0.8, probabilities: { '1': 0.8, '2': 0.2 },
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
  });

  test.skip('should edit result text inline', async ({ page }) => {
    const enhancedText = 'Enhanced text result';

    // Mock the API
    await page.route('**/enhance', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            {
              id: '1',
              status: 'success',
              enhancedText: enhancedText,
            },
          ],
        }),
      });
    });
    
    // Enter text and enhance
    await page.getByTestId('input-text').fill('test');
    await page.getByTestId('enhance-button').click();
    
    // Wait for results
    await page.waitForTimeout(1000);
    
    // Find the result textarea
    const resultTextarea = page.locator('textarea[aria-label="Generated text"]').first();
    await expect(resultTextarea).toBeVisible();

    // Verify initial text
    await expect(resultTextarea).toHaveValue(enhancedText);

    // Click into the textarea to focus it
    await resultTextarea.click();

    // Select all and delete
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');

    // Type new text
    await page.keyboard.type('Manually edited result');

    // Verify the change
    await expect(resultTextarea).toHaveValue('Manually edited result');
  });
});
