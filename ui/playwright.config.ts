import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 4,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL, trace: 'on-first-retry', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: process.env.E2E_STATIC_EXPORT
      ? 'node e2e/serve-export.mjs'
      : `npm run dev -- --hostname 127.0.0.1 --port ${new URL(baseURL).port || '3000'}`,
    url: baseURL,
    reuseExistingServer: false,
    env: {
      E2E_BASE_URL: baseURL,
      NEXT_PUBLIC_APP_SUPABASE_URL: 'https://e2e.supabase.co',
      NEXT_PUBLIC_APP_SUPABASE_ANON_KEY: 'e2e-anon-key',
      NEXT_PUBLIC_API_BASE_URL: 'https://e2e.supabase.co/functions/v1',
    },
  },
});
