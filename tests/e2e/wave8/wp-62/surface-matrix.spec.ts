import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { resolveCta, resolveMidCta, FAMILY_SURFACES } from '../../../../src/data/cta/index.ts';
import type { CtaModel, FamilySurface, ResolveInput } from '../../../../src/data/cta/index.ts';
import { listInsightFiles } from '../../../../src/lib/content-files.ts';
import { isBuilt } from '../../support/routes.ts';

// WP-62, acceptance: the surface matrix of the call to action. One sample route of every page family is visited at 1440 and at 390 pixels,
// with JavaScript on and with JavaScript off (the bands are static HTML, so the two must agree). Each sample has the band the family map
// resolves for the routes that are built: the expected count of end bands, the variant (read from the heading, which is the variant's copy),
// the primary and the secondary link. The routes that carry no band (legal, forms, thanks, search, the style guide, the 404 page) carry no
// `data-cta` element at all. A long article has at most one mid-body band, after half of the text and before its last tenth, never straight
// after a heading, and no document under 900 words has one. The band adds no script, no cookie and no tracking attribute beyond `data-cta`.

const isLive = (path: string): boolean => isBuilt(path);

/** The path of a link with any preview base path and any origin taken off, so a link is compared with the ledger path it points at. */
function endsWithPath(actual: string, expected: string): boolean {
  const pathname = new URL(actual, 'http://localhost').pathname;
  return pathname === expected || pathname.endsWith(expected);
}

interface Sample {
  readonly row: FamilySurface;
  readonly input: ResolveInput;
}

/** The sample of each row: the row's own route, or, for an article row, the first built article of the desk. */
function samples(): { sample: Sample; built: boolean }[] {
  const articles = listInsightFiles(process.cwd());
  return FAMILY_SURFACES.map((row) => {
    if (row.family !== 'articles' || row.input.topic === undefined) return { sample: { row, input: row.input }, built: isBuilt(row.input.path) };
    const found = articles.find((file) => file.desk === row.input.topic && isBuilt(`/insights/${file.slug}/`));
    const path = found === undefined ? row.input.path : `/insights/${found.slug}/`;
    return { sample: { row, input: { ...row.input, path } }, built: found !== undefined };
  });
}

/** The attributes an element of a band may carry: the markup of the band and its `data-cta`, and nothing that tracks. */
async function assertNoTracking(page: Page): Promise<void> {
  const offenders = await page.evaluate(() => {
    const found: string[] = [];
    for (const band of Array.from(document.querySelectorAll('[data-cta]'))) {
      for (const el of [band, ...Array.from(band.querySelectorAll('*'))]) {
        if (el.tagName === 'SCRIPT') found.push(`${el.tagName}`);
        for (const attr of Array.from(el.attributes)) {
          if (/^(?:data-(?!cta$)|on|ping$)/.test(attr.name)) found.push(`${el.tagName}[${attr.name}]`);
        }
      }
    }
    return found;
  });
  expect(offenders, 'a band carries no script, event handler, ping or data attribute beyond data-cta').toEqual([]);
}

/**
 * The closing bands that wave 9 and the earlier hand-placed pages put in a layout's `after` or `cta-end` slot, which take the place of the
 * default band of the map: the sales ladder of the reading templates (`data-cta-ladder`, WP-56, SALES.md 6), the program closing band
 * (`program-end`, WP-53), the home page's closing band (`home-end`, W9-13), the contact page's next-step band and the old `section.ctaband`.
 * Such a page is accepted when it has exactly one of them, no `data-cta="end"` element beside it (a page the CTA system closes has none of
 * them), and the gap is recorded as an annotation so the report names it. A mid-body band is the CTA system's and may sit in either kind.
 */
const CLOSING_BANDS = [
  '[data-cta-ladder]',
  'section.ctaband',
  'section.program-end',
  'section[aria-labelledby="home-end-title"]',
  'section#next',
  'section[aria-labelledby="contact-next"]',
].join(', ');

async function isLegacyBand(page: Page): Promise<boolean> {
  const drawn = await page.locator('[data-cta="end"]').count();
  const closing = await page.locator(CLOSING_BANDS).count();
  if (drawn === 1) {
    expect(closing, 'a page with a data-cta end band has no other closing band beside it').toBe(0);
    return false;
  }
  expect(drawn, 'at most one end band').toBe(0);
  expect(closing, 'a page with no data-cta end band keeps exactly one hand-placed closing band').toBe(1);
  await expect(page.locator('[data-cta="end"]'), 'a page on a hand-placed closing band has no CTA system end band').toHaveCount(0);
  test.info().annotations.push({ type: 'legacy-band', description: `${new URL(page.url()).pathname} closes with its own band, not the CTA system` });
  return true;
}

async function assertEndBand(page: Page, model: CtaModel): Promise<void> {
  if (await isLegacyBand(page)) return;
  const band = page.locator('[data-cta="end"]');
  await expect(band, 'exactly one end band').toHaveCount(1);
  await expect(band.locator('h2, h3').first(), 'the heading of the band').toHaveText(model.heading);
  const links = band.locator('a');
  const expected = [model.primary.href, ...(model.secondary !== undefined && model.secondary.href !== model.primary.href ? [model.secondary.href] : [])];
  await expect(links, 'one primary and at most one secondary link').toHaveCount(expected.length);
  const hrefs = await links.evaluateAll((anchors) => anchors.map((a) => a.getAttribute('href') ?? ''));
  hrefs.forEach((href, index) => expect(endsWithPath(href, expected[index] ?? ''), `link ${index + 1}: ${href} points at ${expected[index]}`).toBe(true));
  await assertNoTracking(page);
}

function matrix(): void {
  test.describe('the end band of each page family', () => {
    for (const { sample, built } of samples()) {
      test(`${sample.row.id}`, async ({ page }) => {
        test.skip(!built, `${sample.input.path} is not built`);
        await page.goto(sample.input.path);
        // A band with no live primary is not drawn, so the resolver decides whether this page has one; the page must agree with it.
        const model = sample.row.expect === null ? null : resolveCta(sample.input, isLive);
        if (model === null) {
          await expect(page.locator('[data-cta]'), 'a form, legal, thanks, search, style guide or 404 page carries no band').toHaveCount(0);
          return;
        }
        await assertEndBand(page, model);
        expect(await page.locator('[data-cta="mid"]').count(), 'at most one mid-body band').toBeLessThanOrEqual(1);
        if (resolveMidCta(sample.input, isLive) === null) await expect(page.locator('[data-cta="mid"]'), 'no mid-body band where the map gives none').toHaveCount(0);
      });
    }
  });

  test.describe('the mid-body band of the built articles', () => {
    test('a band sits after half the text and before the last tenth, after a paragraph, in a document of 900 words or more', async ({ page }) => {
      const built = listInsightFiles(process.cwd()).filter((file) => isBuilt(`/insights/${file.slug}/`));
      test.skip(built.length === 0, 'no article is built');
      test.setTimeout(240_000);
      let withBand = 0;
      for (const file of built) {
        await page.goto(`/insights/${file.slug}/`);
        const bands = page.locator('[data-cta="mid"]');
        const count = await bands.count();
        expect(count, `${file.slug}: at most one mid-body band`).toBeLessThanOrEqual(1);
        const measure = await page.evaluate(() => {
          const band = document.querySelector('[data-cta="mid"]');
          const words = (text: string): number => text.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
          if (band === null) return { has: false as const, total: 0, before: 0, afterTag: '' };
          const parent = band.parentElement;
          const siblings = parent === null ? [] : Array.from(parent.children).filter((child) => child !== band);
          const index = parent === null ? -1 : Array.from(parent.children).indexOf(band);
          const before = Array.from(parent?.children ?? []).slice(0, index).reduce((sum, el) => sum + words(el.textContent ?? ''), 0);
          const total = siblings.reduce((sum, el) => sum + words(el.textContent ?? ''), 0);
          return { has: true as const, total, before, afterTag: band.previousElementSibling?.tagName ?? '' };
        });
        if (!measure.has) continue;
        withBand += 1;
        // The page is counted here by splitting its text, the plugin counts the words of the source blocks (headings, lists and tables count
        // differently, and a table cell or a link adds words to the DOM); a margin of five points on each side keeps the two from disagreeing.
        expect(measure.total, `${file.slug}: only a document of about 900 words or more carries a mid-body band`).toBeGreaterThanOrEqual(850);
        const share = measure.before / measure.total;
        expect(share, `${file.slug}: the band is not in the first half`).toBeGreaterThanOrEqual(0.45);
        expect(share, `${file.slug}: the band is not in the last tenth`).toBeLessThanOrEqual(0.95);
        expect(measure.afterTag, `${file.slug}: the band follows a paragraph, never a heading`).toBe('P');
        await expect(bands.locator('a'), `${file.slug}: the band has one action`).toHaveCount(1);
        await assertNoTracking(page);
      }
      test.info().annotations.push({ type: 'mid-bands', description: `${withBand} of ${built.length} built articles carry a mid-body band` });
    });
  });
}

test.describe('with JavaScript', () => {
  matrix();
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  matrix();
});
