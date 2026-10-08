import { defineConfig, devices } from '@playwright/test';

// The suite runs against an already built dist/ served by scripts/lib/serve.mjs. Nothing here builds the site.
// Specs are matched per project: the common specs run at both viewports, the mode specs run in one project each.
const PORT = Number(process.env.E2E_PORT ?? 4321);
const COMMON = ['routes', 'axe', 'menu', 'folds', 'interaction', 'forms', 'shell', 'layout-shift'].map((name) => new RegExp(`/${name}\\.spec\\.ts$`));

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  // Two retries in CI. With every qa job blocking, one failed attempt must not redden a pipeline: pipeline 64205 had 4 tests that hit
  // the 45 s timeout in the same slow minute on the runner (two jobs) and 3 mobile full-page screenshots that Chromium refused
  // ("Unable to capture screenshot"); all passed on the first retry in about a second. A deterministic defect fails every attempt, so the
  // extra retry hides none, and the job log still lists any test that needed one as flaky.
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  timeout: 45_000,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }], ['junit', { outputFile: 'test-results/junit.xml' }]] : [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `node scripts/lib/serve.mjs dist ${PORT}`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    { name: 'desktop-1440x900', testMatch: COMMON, use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile-390x844', testMatch: COMMON, use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
    { name: 'no-js', testMatch: /\/modes\.spec\.ts$/, use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, javaScriptEnabled: false } },
    { name: 'forced-colors', testMatch: /\/modes\.spec\.ts$/, use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, forcedColors: 'active', colorScheme: 'light' } },
    { name: 'zoom-200', testMatch: /\/modes\.spec\.ts$/, use: { ...devices['Desktop Chrome'], viewport: { width: 720, height: 450 } } },
  ],
});
