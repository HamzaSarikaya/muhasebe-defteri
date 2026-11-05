import {defineConfig, devices} from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e', testMatch: 'dashboard.spec.ts', outputDir: 'test-results-dashboard', workers: 1, fullyParallel: false,
  timeout: 30_000, expect: {timeout: 10_000},
  use: {baseURL: 'http://localhost:3101', trace: 'retain-on-failure', serviceWorkers: 'block'},
  projects: [{name: 'desktop', use: {...devices['Desktop Chrome']}}, {name: 'mobile', use: {...devices['Pixel 7']}}],
  webServer: {command: 'npx tsx tests/fixtures/dashboard-server.ts', url: 'http://localhost:3101/tr', timeout: 180_000, reuseExistingServer: false}
});
