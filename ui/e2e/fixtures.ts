import { expect, test as base } from '@playwright/test';

const USER = {
  id: '00000000-0000-0000-0000-000000000001',
  aud: 'authenticated', role: 'authenticated', is_anonymous: true,
  app_metadata: { provider: 'anonymous', providers: ['anonymous'] },
  user_metadata: {}, identities: [], created_at: '2026-01-01T00:00:00Z',
};

/** Every browser test uses anonymous auth and a profile stub; no live backend calls. */
export const test = base.extend<{ mockBackend: void }>({
  mockBackend: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://www.googletagmanager.com/**', route => route.abort());
    await page.route('https://www.google-analytics.com/**', route => route.abort());
    await page.route('**/auth/v1/**', route => route.fulfill({ json: {
      access_token: 'e2e-access-token', refresh_token: 'e2e-refresh-token',
      expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer', user: USER,
    } }));
    await page.route('**/functions/v1/**', route => route.fulfill({
      status: 500, json: { error: { message: 'Missing API fixture' } },
    }));
    await page.route('**/functions/v1/me', route => route.fulfill({ json: {
      profile: { id: USER.id, email: null, tier: 'free', auth_provider: 'anonymous',
        created_at: USER.created_at },
      quota: { tokens_available: 50000, tokens_used: 0 },
    } }));
    await use();
    expect(errors, 'Unexpected browser errors').toEqual([]);
  }, { auto: true }],
});

export { expect } from '@playwright/test';
