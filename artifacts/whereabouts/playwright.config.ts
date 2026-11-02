import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.DEMO_BASE_URL
  ?? (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : undefined);
if (!baseURL) throw new Error('Set DEMO_BASE_URL to the running Whereabouts preview URL.');

// Use the running preview; never start a second app or require an API/database.
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  outputDir: '../../generated-artifacts/whereabouts-e2e',
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
