import { defineConfig, devices } from '@playwright/test';

// Playwright e2e config. These tests need a running backend + seeded data
// (see tests/e2e/smoke.spec.ts) so they are NOT run in CI yet (per the
// architecture plan, ci.yml only runs Vitest component tests). Run locally
// with `npm run test:e2e` after starting both dev servers (e.g. via the
// top-level `python main.py`).
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Uncomment once backend + frontend dev servers are reliably startable
  // from CI/local scripts with seeded test data:
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:5173',
  //   reuseExistingServer: !process.env.CI,
  // },
});
