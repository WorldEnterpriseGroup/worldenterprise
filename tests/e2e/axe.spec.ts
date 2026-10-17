import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { AXE_TAGS, quiet } from './support/page-guards.ts';
import { fileFor, isBuilt, liveRoutes } from './support/routes.ts';

// axe-core at WCAG 2.2 AA on every built route, and again with the mega menu open (desktop) or the drawer open (mobile).
// All impacts fail; there is no allow list, so a violation is fixed at its owner.

interface Violation {
  readonly id: string;
  readonly impact?: string | null;
  readonly nodes: readonly { target: readonly unknown[] }[];
}
const summarise = (violations: readonly Violation[]): string[] => violations.map((v) => `${v.id} (${v.impact ?? 'n/a'}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);

for (const { path: route } of liveRoutes) {
  test(`axe ${route}`, async ({ page }) => {
    const network = quiet(page);
    await page.goto(route);
    await network.settled();
    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(summarise(results.violations)).toEqual([]);
  });
}

test('axe with the navigation open', async ({ page, isMobile }) => {
  test.skip(!isBuilt('/'), 'home is not built');
  // Panels and the drawer fade in over 220ms. axe must see the settled state, not a mid-transition colour (a11y audit, Unverified 5).
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  if (isMobile) {
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(page.locator('[data-mobile-drawer]')).toBeVisible();
  } else {
    await page.locator('[data-mega-trigger]').first().click();
    await expect(page.locator('[data-mega-panel]:popover-open')).toBeVisible();
  }
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(summarise(results.violations)).toEqual([]);
});

test('axe on every mega menu panel', async ({ page, isMobile }) => {
  test.skip(isMobile || !isBuilt('/'), 'desktop only');
  // With reduced motion the panel transition collapses to 0.01ms, so axe samples the settled colours of the featured card.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const count = await page.locator('[data-mega-trigger]').count();
  // One scan per panel, so the budget grows with the panel count: runner load must not turn a slow minute into a failed test.
  test.setTimeout(30_000 + count * 15_000);
  const failures: string[] = [];
  for (let i = 0; i < count; i += 1) {
    await page.locator('[data-mega-trigger]').nth(i).click();
    await expect(page.locator('[data-mega-panel]:popover-open')).toBeVisible();
    // The scan is scoped to the open panel. The page behind it is covered by "axe <route>" and "axe with the navigation open",
    // so a full-page analyze() per panel would repeat that work and cost about 10 s each on a loaded runner.
    const results = await new AxeBuilder({ page }).include('[data-mega-panel]:popover-open').withTags(AXE_TAGS).analyze();
    failures.push(...summarise(results.violations).map((line) => `panel ${i}: ${line}`));
    await page.keyboard.press('Escape');
  }
  expect(failures).toEqual([]);
});

// ---------------------------------------------------------------------------------------------------------------------------
// WP-16: structure that axe does not flag but the audit did (a11y P2-2 and P2-3).

test('every error summary is a named group, and the group is what takes focus', () => {
  const failures: string[] = [];
  let found = 0;
  for (const { path: route } of liveRoutes) {
    const html = readFileSync(fileFor(route), 'utf8');
    for (const tag of html.matchAll(/<div\b[^>]*\bdata-error-summary\b[^>]*>/g)) {
      found += 1;
      if (!/\brole=(?:"group"|'group'|group(?=[\s>]))/.test(tag[0])) failures.push(`${route}: error summary without role="group"`);
      if (!/\baria-labelledby=/.test(tag[0])) failures.push(`${route}: error summary without a name`);
    }
  }
  expect(found, 'error summaries in the built pages').toBeGreaterThan(0);
  expect(failures).toEqual([]);
});

test('the topic eyebrow above an article headline is a sentence-sized link: "Topic: build", not a bare word', async ({ page }) => {
  const route = liveRoutes.find((r) => /^\/insights\/[^/]+\/$/.test(r.path) && readFileSync(fileFor(r.path), 'utf8').includes('hero--article') && /<p class="?eyebrow"?>\s*<a\b/.test(readFileSync(fileFor(r.path), 'utf8')));
  test.skip(route === undefined, 'no article with a linked topic is built');
  await page.goto(route?.path ?? '/');
  const link = page.locator('article > header .eyebrow a');
  await expect(link).toHaveCount(1);
  expect(await link.evaluate((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim())).toMatch(/^Topic: \S+/);
  await expect(page.getByRole('link', { name: /^Topic: \S+/ })).toHaveCount(1);
  // The words a sighted reader sees are unchanged: the added context is visually hidden and the visible text stays the topic.
  const visible = await link.evaluate((el) => [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent ?? '').join('').trim());
  expect(visible).toMatch(/^\S+$/);
  expect(await link.locator('.visually-hidden').count()).toBe(1);
});
