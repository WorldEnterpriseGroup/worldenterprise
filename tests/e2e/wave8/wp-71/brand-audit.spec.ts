import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { AXE_TAGS, watch } from '../../support/page-guards.ts';
import { liveRoutes } from '../../support/routes.ts';

// WP-71 brand consistency audit, rendered half (the static half is tests/unit/wp-71/brand-audit.test.ts). One sample page per family,
// chosen from the routes that are launched and built; a family with no built page yet is listed in the test title as pending and skipped,
// so the suite stays green while the content packages land one by one. `verify:release` turns pending into a failure.

interface Family {
  readonly name: string;
  /** Route prefix of the family. The first built route under it that is not the hub itself is the sample; the hub is the fallback. */
  readonly prefix: string;
}

const FAMILIES: readonly Family[] = [
  { name: 'segments', prefix: '/founders/' },
  { name: 'industries', prefix: '/industries/' },
  { name: 'compare', prefix: '/compare/' },
  { name: 'journey', prefix: '/journey/' },
  { name: 'investors', prefix: '/investors/' },
  { name: 'partners', prefix: '/network/partners/' },
  { name: 'briefs', prefix: '/briefs/' },
  { name: 'resources', prefix: '/resources/' },
  { name: 'brand story', prefix: '/about/brand-story/' },
  { name: 'press', prefix: '/press/' },
];

function sampleFor(family: Family): string | undefined {
  const inside = liveRoutes.filter((r) => r.path.startsWith(family.prefix) && r.path !== '/press/brand-kit/').map((r) => r.path);
  return inside.find((path) => path !== family.prefix) ?? inside[0];
}

/** The wordmark is the only image whose alt text is the company name; the lockup is that image wherever it sits. */
const LOCKUP = 'img[alt="World Enterprise"]';

for (const family of FAMILIES) {
  const route = sampleFor(family);
  const title = route === undefined ? `${family.name}: pending, no built page under ${family.prefix}` : `${family.name}: ${route}`;

  test.describe(title, () => {
    test.skip(route === undefined, `no built page under ${family.prefix} yet`);

    test.beforeEach(async ({ page, baseURL }) => {
      if (route === undefined) return;
      const record = watch(page, baseURL ?? 'http://localhost');
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      expect(record.consoleErrors, 'console errors').toEqual([]);
      expect(record.pageErrors, 'uncaught exceptions').toEqual([]);
      expect(record.thirdParty, 'third-party requests').toEqual([]);
    });

    test('one h1, and the heading levels never skip downward', async ({ page }) => {
      await expect(page.locator('h1')).toHaveCount(1);
      const levels = await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll((els) => els.map((el) => Number(el.tagName.slice(1))));
      let previous = 0;
      const skips: string[] = [];
      for (const level of levels) {
        if (previous !== 0 && level > previous + 1) skips.push(`h${previous} then h${level}`);
        previous = level;
      }
      expect(skips).toEqual([]);
    });

    test('one lockup in the header, none in the page body, and no logo on a dark band', async ({ page }) => {
      await expect(page.locator(`header ${LOCKUP}`)).toHaveCount(1);
      await expect(page.locator(`main ${LOCKUP}`)).toHaveCount(0);
      await expect(page.locator(`.on-inverse ${LOCKUP}`)).toHaveCount(0);
      await expect(page.locator(`.on-inverse img[src*="wordmark"], .on-inverse img[src*="logo"]`)).toHaveCount(0);
    });

    test('tokens only: no inline style and no hard-coded paint on the page body', async ({ page }) => {
      await expect(page.locator('main [style]')).toHaveCount(0);
      const paints = await page.locator('main svg [fill], main svg [stroke]').evaluateAll((els) =>
        els
          .flatMap((el) => [el.getAttribute('fill'), el.getAttribute('stroke')])
          .filter((value): value is string => value !== null && /^(#|rgb|hsl|oklch)/i.test(value)),
      );
      expect(paints).toEqual([]);
    });

    test('actions come from the shared Button: every .btn is a link or a button, and no bare button stands in for one', async ({ page }) => {
      const wrong = await page.locator('main .btn').evaluateAll((els) => els.filter((el) => el.tagName !== 'A' && el.tagName !== 'BUTTON').map((el) => el.outerHTML.slice(0, 80)));
      expect(wrong).toEqual([]);
      const bare = await page.locator('main button:not(.btn):not([class*="btn"])').evaluateAll((els) => els.map((el) => el.outerHTML.slice(0, 80)));
      // A control owned by an island carries its own class; a button with no class at all is a hand-built action.
      expect(bare.filter((html) => !/class=/.test(html))).toEqual([]);
    });

    test('spacing in the page body comes from the token scale: every gap and every vertical padding is one of the --sp-* values', async ({ page }) => {
      // Resolve each token to pixels by measuring a probe, so the check follows the scale if the tokens change.
      const scale = await page.evaluate(() => {
        const probe = document.createElement('div');
        probe.style.position = 'absolute';
        document.body.append(probe);
        const sizes: number[] = [];
        for (let n = 1; n <= 10; n += 1) {
          probe.style.width = `var(--sp-${n})`;
          sizes.push(probe.getBoundingClientRect().width);
        }
        probe.remove();
        return sizes;
      });
      expect(scale.every((size) => size > 0), 'the --sp-1 to --sp-10 tokens resolve').toBe(true);
      // The family and brand components (class prefixes fhub, fcard, fitems, jlist, jstep, jny-, cmp-, bdivider, bcallout, marker) and the
      // shared .stack they compose with; page chrome belongs to the layouts and is audited by their own suites.
      const own = 'main .stack, main [class*="fhub"], main [class*="fcard"], main [class*="fitems"], main [class*="jlist"], main [class*="jstep"], main [class*="jny-"], main [class*="cmp-"], main [class*="bdivider"], main [class*="bcallout"], main [class*="marker"]';
      const off = await page.locator(own).evaluateAll(
        (els, sizes) =>
          els.flatMap((el) => {
            const style = getComputedStyle(el);
            const values: [string, number][] = [
              ['row-gap', parseFloat(style.rowGap)],
              ['column-gap', parseFloat(style.columnGap)],
              ['padding-top', parseFloat(style.paddingTop)],
              ['padding-bottom', parseFloat(style.paddingBottom)],
            ];
            // 0 is no spacing, `normal` parses to NaN, and 1px to 3px are hairline compensation (the audit's own allowance).
            return values
              .filter(([, px]) => Number.isFinite(px) && px > 3 && !sizes.some((size) => Math.abs(size - px) < 0.5))
              .map(([name, px]) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0] ?? ''} ${name}: ${px}px`);
          }),
        scale,
      );
      expect(off).toEqual([]);
    });

    test('a visible focus ring of at least 2px on the first interactive element of the page body', async ({ page }) => {
      const target = page.locator('main a[href], main button').first();
      await target.focus();
      const ring = await target.evaluate((el) => {
        const style = getComputedStyle(el);
        return { width: parseFloat(style.outlineWidth), style: style.outlineStyle };
      });
      expect(ring.style).not.toBe('none');
      expect(ring.width).toBeGreaterThanOrEqual(2);
    });

    test('axe at WCAG 2.2 AA finds nothing', async ({ page }) => {
      const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    });
  });
}

test('the brand kit stays launch:false: it is not built, not linked and not in the sitemap', async ({ request }) => {
  const built = liveRoutes.some((r) => r.path === '/press/brand-kit/');
  test.skip(built, 'the brand kit has been released; the release owner moves its ledger row, and this guard no longer applies');
  const kit = await request.get('/press/brand-kit/');
  expect(kit.status()).toBe(404);
  const press = await request.get('/press/');
  if (press.ok()) expect(await press.text()).not.toContain('/press/brand-kit/');
  for (const file of ['/sitemap-index.xml', '/sitemap-0.xml', '/llms.txt']) {
    const response = await request.get(file);
    if (response.ok()) expect(await response.text(), file).not.toContain('/press/brand-kit/');
  }
});
