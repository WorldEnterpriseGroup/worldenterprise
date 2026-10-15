import { expect, test } from '@playwright/test';
import { isBuilt } from '../../support/routes.ts';
import { FULL_HD, expectBandsFullBleed, expectFullWidth, expectNoHorizontalScroll, expectReadableProse } from '../wp-51/lib/full-width.ts';

// WP-56 (issue #77): the content-family hubs and templates at 1920x1080. Every hub fills the 110rem frame with illustrated cards (an
// emblem per card), reading text keeps its measure, and the end of every template carries the CTA ladder that starts with "Start a
// readiness review". A route that is not built is skipped, not failed.

const HUBS: readonly { readonly path: string; readonly cards: boolean }[] = [
  { path: '/insights/', cards: true },
  { path: '/research/', cards: true },
  { path: '/library/', cards: true },
  { path: '/playbooks/', cards: true },
  { path: '/briefs/', cards: true },
  { path: '/industries/', cards: true },
  { path: '/compare/', cards: true },
  { path: '/journey/', cards: true },
  { path: '/fundability/', cards: false },
  { path: '/resources/', cards: false },
  { path: '/glossary/', cards: false },
  { path: '/faq/', cards: false },
  { path: '/search/', cards: false },
  { path: '/sitemap/', cards: false },
];

/**
 * `measure: false` where the reading column belongs to a layout WP-56 does not own: TemplateLayout's "How to use this" box (WP-51)
 * runs a little past 80ch at 1920, which the WP-51 suite owns. WP-56 checks the frame and the ladder there.
 */
const TEMPLATES: readonly { readonly path: string; readonly measure: boolean }[] = [
  { path: '/insights/evaluating-an-llm-feature-before-you-ship-it/', measure: true },
  { path: '/playbooks/build-and-ship-v1/', measure: true },
  { path: '/fundability/data-room/', measure: true },
  { path: '/library/pricing-page-checklist/', measure: false },
  { path: '/industries/fintech/', measure: true },
  { path: '/compare/build-vs-buy/', measure: true },
];

test.describe('WP-56 families at 1920x1080', () => {
  test.use({ viewport: FULL_HD, reducedMotion: 'reduce' });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'wave8-desktop-1440x900', 'desktop-only width checks');
  });

  for (const hub of HUBS) {
    test(`${hub.path} fills the frame with its family visuals and keeps text readable`, async ({ page }) => {
      test.skip(!isBuilt(hub.path), `${hub.path} is not built`);
      await page.goto(hub.path);
      await page.evaluate(() => document.fonts.ready);
      await expectFullWidth(page);
      await expectNoHorizontalScroll(page);
      await expectReadableProse(page);
      await expectBandsFullBleed(page);
      await expect(page.locator('main svg.wv-emblem').first()).toBeVisible();
      if (hub.cards) {
        const cards = page.locator('main ul.wv-cards > li');
        expect(await cards.count()).toBeGreaterThan(0);
        // Large cards: at 1920 a card is at least 22rem wide (352px), so the hub reads as pictures, not a list of links.
        const box = await cards.first().boundingBox();
        expect(box?.width ?? 0).toBeGreaterThanOrEqual(352);
        // The whole card is one link: its title.
        await expect(cards.first().locator('a')).toHaveCount(1);
      }
    });
  }

  for (const { path, measure } of TEMPLATES) {
    test(`${path} ends with the CTA ladder and keeps its measure`, async ({ page }) => {
      test.skip(!isBuilt(path), `${path} is not built`);
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      await expectFullWidth(page);
      await expectNoHorizontalScroll(page);
      if (measure) await expectReadableProse(page);
      const ladder = page.locator('[data-cta-ladder]');
      if (isBuilt('/apply/')) {
        await expect(ladder).toHaveCount(1);
        await expect(ladder.getByRole('link', { name: 'Start a readiness review' })).toBeVisible();
      }
      // The timeline brief stays hidden until its page exists.
      if (!isBuilt('/briefs/real-timeline/')) await expect(page.getByRole('link', { name: 'Get the timeline brief' })).toHaveCount(0);
    });
  }

  test('an insights article shows its pull-stats beside the emblem, with the source and the honesty line', async ({ page }) => {
    const path = TEMPLATES[0]?.path ?? '/insights/';
    test.skip(!isBuilt(path), `${path} is not built`);
    await page.goto(path);
    const stats = page.locator('.wv-context');
    await expect(stats).toBeVisible();
    await expect(stats).toContainText("These figures describe all new U.S. businesses, not WE's results.");
    await expect(stats).toContainText('Source: U.S. Bureau of Labor Statistics');
    const text = await stats.locator('.wv-context__text').boundingBox();
    const art = await stats.locator('.wv-context__art').boundingBox();
    expect(text).not.toBeNull();
    expect(art).not.toBeNull();
    // Side by side: the picture starts to the right of the text column.
    expect((art?.x ?? 0) >= (text?.x ?? 0) + (text?.width ?? 0)).toBe(true);
  });
});
