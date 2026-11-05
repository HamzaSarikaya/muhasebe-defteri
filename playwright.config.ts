import {defineConfig, devices} from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: process.env.LEDGER_TEST_EMAIL ? 'ledger.spec.ts' : 'foundation.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: {timeout: 10_000},
  use: {baseURL: 'http://localhost:3100', trace: 'retain-on-failure'},
  projects: [
    {name: 'desktop', use: {...devices['Desktop Chrome']}},
    {name: 'mobile', use: {...devices['Pixel 7']}}
  ],
  webServer: {
    command: 'npm run start -- --port 3100',
    url: 'http://localhost:3100/tr',
    reuseExistingServer: false,
    timeout: 30_000
  }
});
