import { expect, test } from '@playwright/test';
import { findOverflow, formatOffenders } from './support/overflow.ts';
import { liveRoutes } from './support/routes.ts';

// Layout fit (WP-16). The earlier overflow checks compared documentElement.scrollWidth with clientWidth, and `.page` and `main` clipped
// horizontal overflow, so content could be cut off at the viewport edge and still measure as zero overflow. These tests measure the
// bounding box of every element against the viewport instead (tests/e2e/support/overflow.ts). They run at 1440, 390 and 320 CSS pixels
// (320 is the WCAG 1.4.10 reflow width).

for (const { path: route } of liveRoutes) {
  test(`fits the viewport ${route}`, async ({ page }) => {
    const response = await page.goto(route, { waitUntil: 'load' });
    expect(response?.status(), 'HTTP status').toBe(200);
    const width = page.viewportSize()?.width;

    const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(scroll, `document scrolls sideways at ${width}px`).toBeLessThanOrEqual(0);

    const offenders = await findOverflow(page);
    expect(offenders, `elements outside the ${width}px viewport: ${formatOffenders(offenders)}`).toEqual([]);
  });
}
