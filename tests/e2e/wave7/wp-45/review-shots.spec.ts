import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { isBuilt } from '../../support/routes.ts';

// WP-45 review screenshots: home, program, pricing and a hub at 390, 768 and 1440, for the reviewer. The pictures are not committed
// ("no image added"); they are written to test-results/wp-45-shots/ and attached to the report, so they travel as CI artifacts of
// job e2e:wave7 (artifacts: test-results/ and playwright-report/). The project set has no 768 window, so this spec sets its own
// viewport and runs once, in the desktop project. It captures the finished picture (reduced motion), so a scroll-driven moment that
// has not played yet cannot hide a section.

const ROUTES = [
  { name: 'home', path: '/' },
  { name: 'program', path: '/program/' },
  { name: 'pricing', path: '/pricing/' },
  { name: 'hub-services', path: '/services/' },
] as const;
const WIDTHS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const;
const OUT = join('test-results', 'wp-45-shots');

test.describe('review screenshots', () => {
  test.beforeAll(() => {
    mkdirSync(OUT, { recursive: true });
  });

  for (const route of ROUTES) {
    for (const size of WIDTHS) {
      test(`${route.name} at ${size.width}`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'wave7-desktop-1440x900', 'the shots are taken once, from the desktop project, at three sizes');
        test.skip(!isBuilt(route.path), `${route.path} is not built`);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.setViewportSize(size);
        await page.goto(route.path);
        await page.evaluate(() => document.fonts.ready);
        const file = join(OUT, `${route.name}-${size.width}.png`);
        const shot = await page.screenshot({ path: file, fullPage: true });
        expect(shot.byteLength).toBeGreaterThan(0);
        await testInfo.attach(`${route.name}-${size.width}`, { body: shot, contentType: 'image/png' });
      });
    }
  }
});
