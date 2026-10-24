import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { CLOSING_BANDS, resolveCta, resolveMidCta, FAMILY_SURFACES } from '../../../../src/data/cta/index.ts';
import type { CtaModel, FamilySurface, ResolveInput } from '../../../../src/data/cta/index.ts';
import { listInsightFiles } from '../../../../src/lib/content-files.ts';
import { ARTICLE_FURNITURE_SELECTOR } from '../../../../src/lib/rehype-mid-cta.ts';
import { assertNotLaunched, builtArticles, isOnSite, requireBuilt } from './presence.ts';

// WP-62, acceptance: the surface matrix of the call to action. One sample route of every page family is visited at 1440 and at 390 pixels,
// with JavaScript on and with JavaScript off (the bands are static HTML, so the two must agree). Each sample has the band the family map
// resolves for the routes that are built: the expected count of end bands, the variant (read from the heading, which is the variant's copy),
// the primary and the secondary link. The routes that carry no band (legal, forms, thanks, search, the style guide, the 404 page) carry no
// `data-cta` element at all. A long article has at most one mid-body band, after half of the text and before its last tenth, never straight
// after a heading, and no document under 900 words has one. The band adds no script, no cookie and no tracking attribute beyond `data-cta`.

const isLive = (path: string): boolean => isOnSite(path);

/** The path of a link with any preview base path and any origin taken off, so a link is compared with the ledger path it points at. */
function endsWithPath(actual: string, expected: string): boolean {
  const pathname = new URL(actual, 'http://localhost').pathname;
  return pathname === expected || pathname.endsWith(expected);
}

interface Sample {
  readonly row: FamilySurface;
  readonly input: ResolveInput;
}

/**
 * The sample of each row: the row's own route, or, for an article row, the first built article of the desk. A desk with no built article
 * fails, and so does a launched route that is not built (presence.ts); a row is without a sample only when the data says its route is not launched.
 */
function sampleOf(row: FamilySurface): Sample | { readonly notLaunched: string } {
  if (row.family !== 'articles' || row.input.topic === undefined) {
    if (isOnSite(row.input.path)) return { row, input: row.input };
    return { notLaunched: assertNotLaunched(row.input.path) };
  }
  const found = builtArticles(listInsightFiles(process.cwd())).find((file) => file.desk === row.input.topic);
  expect(found, `the ${row.input.topic} desk has a built article to sample`).toBeDefined();
  return { row, input: { ...row.input, path: `/insights/${found?.slug ?? ''}/` } };
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
 * A row listed in `CLOSING_BANDS` (src/data/cta/closing-bands.ts) closes with its own band: it must have exactly that band, one element,
 * and no `data-cta="end"` element; the gap is recorded as an annotation so the report names it. Every other row with a band must have
 * exactly one `data-cta="end"` element and none of the listed bands: there is no fallback. Returns true when the row was a listed one.
 */
async function isLegacyBand(page: Page, rowId: string): Promise<boolean> {
  const listed = CLOSING_BANDS[rowId];
  const drawn = page.locator('[data-cta="end"]');
  const anyListed = Array.from(new Set(Object.values(CLOSING_BANDS).map((band) => band.selector))).join(', ');
  if (listed === undefined) {
    await expect(drawn, `${rowId} is not on the closing-band list, so it has exactly one data-cta end band`).toHaveCount(1);
    await expect(page.locator(anyListed), `${rowId} has no hand-placed closing band beside its data-cta end band`).toHaveCount(0);
    return false;
  }
  await expect(drawn, `${rowId} closes with its own band, so it has no data-cta end band`).toHaveCount(0);
  await expect(page.locator(listed.selector), `${rowId} closes with exactly one ${listed.selector} (${listed.source})`).toHaveCount(1);
  test.info().annotations.push({ type: 'legacy-band', description: `${new URL(page.url()).pathname} closes with ${listed.source}, not the CTA system` });
  return true;
}

async function assertEndBand(page: Page, model: CtaModel, rowId: string): Promise<void> {
  if (await isLegacyBand(page, rowId)) return;
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
    for (const row of FAMILY_SURFACES) {
      test(`${row.id}`, async ({ page }) => {
        const found = sampleOf(row);
        if ('notLaunched' in found) {
          test.info().annotations.push({ type: 'not-launched', description: `${row.input.path}: ${found.notLaunched}` });
          return;
        }
        const { input: sampleInput } = found;
        await page.goto(sampleInput.path);
        // A band with no live primary is not drawn, so the resolver decides whether this page has one; the page must agree with it.
        const model = row.expect === null ? null : resolveCta(sampleInput, isLive);
        if (model === null) {
          await expect(page.locator('[data-cta]'), 'a form, legal, thanks, search, style guide or 404 page carries no band').toHaveCount(0);
          return;
        }
        await assertEndBand(page, model, row.id);
        expect(await page.locator('[data-cta="mid"]').count(), 'at most one mid-body band').toBeLessThanOrEqual(1);
        if (resolveMidCta(sampleInput, isLive) === null) await expect(page.locator('[data-cta="mid"]'), 'no mid-body band where the map gives none').toHaveCount(0);
      });
    }
  });

  // One test per article, so each has its own timeout and the workers share the load, instead of one loop over every built article. The band is
  // static markup, so the page is read at domcontentloaded and measured once, in a single evaluate.
  test.describe('the mid-body band of the built articles', () => {
    for (const file of listInsightFiles(process.cwd())) {
      test(`${file.slug}: a band sits after half the text and before the last tenth, after a paragraph, in a document of 900 words or more`, async ({ page }) => {
        if (builtArticles([file]).length === 0) return; // a draft: asserted to be unbuilt, and it has no band to measure
        await page.goto(`/insights/${file.slug}/`, { waitUntil: 'domcontentloaded' });
        const bands = page.locator('[data-cta="mid"]');
        const count = await bands.count();
        expect(count, `${file.slug}: at most one mid-body band`).toBeLessThanOrEqual(1);
        if (count === 0) return;
        const measure = await page.evaluate((furniture) => {
          const band = document.querySelector('[data-cta="mid"]');
          const words = (text: string): number => text.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
          if (band === null) return { total: 0, before: 0, afterTag: '' };
          const parent = band.parentElement;
          // The text the plugin measures is the article body. Everything the layout puts after it in the same container is page furniture, so the
          // count stops at the first piece of it; the selector is the plugin's own (ARTICLE_FURNITURE_SELECTOR).
          const all = Array.from(parent?.children ?? []);
          const end = all.findIndex((child) => child.matches(furniture));
          const body = end === -1 ? all : all.slice(0, end);
          const before = body.slice(0, body.indexOf(band)).reduce((sum, el) => sum + words(el.textContent ?? ''), 0);
          const total = body.filter((child) => child !== band).reduce((sum, el) => sum + words(el.textContent ?? ''), 0);
          return { total, before, afterTag: band.previousElementSibling?.tagName ?? '' };
        }, ARTICLE_FURNITURE_SELECTOR);
        // The page is counted here by splitting its text and the plugin counts the words of the source blocks (and the prose in component props);
        // a margin of five points on each side keeps the two from disagreeing over a table cell or a link.
        expect(measure.total, `${file.slug}: only a document of about 900 words or more carries a mid-body band`).toBeGreaterThanOrEqual(850);
        const share = measure.before / measure.total;
        expect(share, `${file.slug}: the band is not in the first half`).toBeGreaterThanOrEqual(0.45);
        expect(share, `${file.slug}: the band is not in the last tenth`).toBeLessThanOrEqual(0.95);
        expect(measure.afterTag, `${file.slug}: the band follows a paragraph, never a heading`).toBe('P');
        await expect(bands.locator('a'), `${file.slug}: the band has one action`).toHaveCount(1);
        await assertNoTracking(page);
      });
    }
  });
}

test.describe('with JavaScript', () => {
  matrix();
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  matrix();
});
