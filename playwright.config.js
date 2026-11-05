import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  globalSetup: './e2e/globalSetup.js',
  testDir: './e2e',
  testIgnore: process.env.RUN_BENCHMARK
    ? []
    : ['**/benchmark*.spec.js', '**/profiling*.spec.js'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 4,
  reporter: 'list',
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
  webServer: {
    command: 'npm --prefix frontend run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
    env: {
      VITE_MEMUAT_FIXTURE_UJI: 'true',
      VITE_STATUS_SERVER_OTOMATIS: 'false',
    },
  },
});
