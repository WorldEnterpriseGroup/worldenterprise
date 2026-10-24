import { defineConfig, devices } from '@playwright/test';

// The suite runs against an already built dist/ served by scripts/lib/serve.mjs. Nothing here builds the site.
// Specs are matched per project: the common specs run at both viewports, the mode specs run in one project each.
const PORT = Number(process.env.E2E_PORT ?? 4321);
const COMMON = ['routes', 'axe', 'menu', 'folds', 'interaction', 'forms', 'shell', 'layout-shift', 'layout'].map((name) => new RegExp(`/${name}\\.spec\\.ts$`));
// Wave 7 specs live in tests/e2e/wave7/** and run in two projects of their own, added only when E2E_WAVE7 is set (job e2e:wave7). The
// common projects ignore that directory, so a filter word in another job's command (routes, axe, menu, forms) cannot pick one up.
const WAVE7_DIR = /\/e2e\/wave7\//;
const WAVE7_SPECS = /\/e2e\/wave7\/.+\.spec\.ts$/;
const wave7Projects = process.env.E2E_WAVE7
  ? [
      { name: 'wave7-desktop-1440x900', testMatch: WAVE7_SPECS, use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
      { name: 'wave7-mobile-390x844', testMatch: WAVE7_SPECS, use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
    ]
  : [];
// Wave 8 specs follow the same rule in tests/e2e/wave8/** (job e2e:wave8, E2E_WAVE8).
const WAVE8_DIR = /\/e2e\/wave8\//;
const WAVE8_SPECS = /\/e2e\/wave8\/.+\.spec\.ts$/;
// Specs that set their own viewport run in the desktop project only: the mobile project would repeat the same measurement at the same width.
const WAVE8_FIXED_VIEWPORT_SPECS = /\/e2e\/wave8\/wp-109\/content-extent\.spec\.ts$/;
const wave8Projects = process.env.E2E_WAVE8
  ? [
      { name: 'wave8-desktop-1440x900', testMatch: WAVE8_SPECS, use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
      { name: 'wave8-mobile-390x844', testMatch: WAVE8_SPECS, testIgnore: WAVE8_FIXED_VIEWPORT_SPECS, use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
    ]
  : [];

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
    { name: 'desktop-1440x900', testMatch: COMMON, testIgnore: [WAVE7_DIR, WAVE8_DIR], use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile-390x844', testMatch: COMMON, testIgnore: [WAVE7_DIR, WAVE8_DIR], use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
    // 320 px is the WCAG 1.4.10 reflow width. Only the layout spec runs here: it is the suite that measures where elements sit.
    { name: 'mobile-320x568', testMatch: /\/layout\.spec\.ts$/, use: { ...devices['Pixel 7'], viewport: { width: 320, height: 568 } } },
    { name: 'no-js', testMatch: /\/modes\.spec\.ts$/, use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, javaScriptEnabled: false } },
    { name: 'forced-colors', testMatch: /\/modes\.spec\.ts$/, use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, forcedColors: 'active', colorScheme: 'light' } },
    { name: 'zoom-200', testMatch: /\/modes\.spec\.ts$/, use: { ...devices['Desktop Chrome'], viewport: { width: 720, height: 450 } } },
    ...wave7Projects,
    ...wave8Projects,
  ],
});
