import { existsSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { watch } from '../../support/page-guards.ts';
import { RESULT_KINDS, readType } from '../../../../src/components/islands/we-search/query.ts';
import { isBuilt } from '../../support/routes.ts';

// WP-46: result-type chips on /search/. The type comes from the URL prefix of each result and the filter runs in the browser.

test.beforeEach(() => {
  test.skip(!isBuilt('/search/') || !existsSync('dist/pagefind/pagefind.js'), '/search/ or the Pagefind index is not in dist');
});

const QUERIES = ['the', 'team', 'founder', 'startup', 'product', 'investor', 'program'];

/** Runs queries until one finds results of at least two types, so the chips show. Returns the query. */
async function searchWithTypes(page: Page): Promise<string> {
  const input = page.locator('#we-search-input');
  await expect(input).toBeVisible();
  for (const query of QUERIES) {
    await input.fill(query);
    await input.press('Enter');
    await expect(page.locator('[data-search-results] li').first()).toBeVisible({ timeout: 10_000 });
    // A query that found one type only shows no chips; the next one may find more.
    const shown = await page.locator('[data-search-chips]').waitFor({ state: 'visible', timeout: 4000 }).then(
      () => true,
      () => false,
    );
    if (shown) return query;
  }
  throw new Error('no query found results of two types; the index looks too small for this test');
}

const rows = (page: Page): Promise<string[]> => page.locator('[data-search-results] li h2 a').evaluateAll((links) => links.map((a) => (a as HTMLAnchorElement).pathname));

test('the chips list the types found, with All pressed first', async ({ page, baseURL }) => {
  const seen = watch(page, baseURL ?? '');
  await page.goto('/search/');
  await searchWithTypes(page);
  const group = page.getByRole('group', { name: 'Filter results by type' });
  await expect(group).toBeVisible();
  const chips = group.getByRole('button');
  expect(await chips.count(), 'All and at least two types').toBeGreaterThanOrEqual(3);
  await expect(chips.first()).toHaveText('All');
  await expect(chips.first()).toHaveAttribute('aria-pressed', 'true');
  await expect(chips.nth(1)).toHaveAttribute('aria-pressed', 'false');
  expect(seen.thirdParty).toEqual([]);
  expect(seen.consoleErrors).toEqual([]);
});

test('a chip filters the list to its type, keeps ?type=, names the type in the status line, and All restores the list', async ({ page }) => {
  await page.goto('/search/');
  const query = await searchWithTypes(page);
  const all = await rows(page);
  const group = page.getByRole('group', { name: 'Filter results by type' });
  const chip = group.getByRole('button').nth(1);
  const name = ((await chip.textContent()) ?? '').trim();
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/[?&]type=[a-z]+/);
  await expect(page.locator('[data-search-status]')).toContainText(new RegExp(`${name.replace(/s$/, '')}.* result.* for “${query}”`, 'i'));
  const kind = readType(new URL(page.url()).search);
  const prefix = RESULT_KINDS.find((row) => row.id === kind)?.prefix ?? '';
  expect(prefix, 'the URL names a known type').not.toBe('');
  await expect.poll(async () => (await rows(page)).every((path) => path.includes(prefix)), { message: `every row is under ${prefix}` }).toBe(true);
  expect((await rows(page)).length).toBeGreaterThan(0);
  await expect(page.locator('[data-search-results] .we-search__kind').first()).toContainText(name.replace(/s$/, ''));
  await group.getByRole('button', { name: 'All' }).click();
  await expect(page).not.toHaveURL(/type=/);
  await expect.poll(async () => (await rows(page)).length).toBe(all.length);
});

test('the chips are reachable and operable with the keyboard, and the pressed state is announced', async ({ page }) => {
  await page.goto('/search/');
  await searchWithTypes(page);
  const group = page.getByRole('group', { name: 'Filter results by type' });
  const chip = group.getByRole('button').nth(1);
  await chip.focus();
  await page.keyboard.press('Space');
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await expect(chip).toBeFocused();
  await page.keyboard.press('Enter');
  // Pressing the pressed chip again leaves it as it is; All is how the filter is cleared.
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
});

test('a link with ?q= and ?type= opens already filtered, and an unknown type is ignored', async ({ page }) => {
  await page.goto('/search/');
  const query = await searchWithTypes(page);
  const group = page.getByRole('group', { name: 'Filter results by type' });
  await group.getByRole('button').nth(1).click();
  const filteredUrl = page.url();
  await page.goto(filteredUrl);
  await expect(page.locator('[data-search-results] li').first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('group', { name: 'Filter results by type' }).getByRole('button').nth(1)).toHaveAttribute('aria-pressed', 'true');
  await page.goto(`/search/?q=${encodeURIComponent(query)}&type=nonsense`);
  await expect(page.locator('[data-search-results] li').first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('group', { name: 'Filter results by type' }).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
});

test('the first page of an unfiltered search is still ten rows, with Show more', async ({ page }) => {
  await page.goto('/search/');
  const input = page.locator('#we-search-input');
  await expect(input).toBeVisible();
  for (const query of QUERIES) {
    await input.fill(query);
    await input.press('Enter');
    await expect(page.locator('[data-search-results] li').first()).toBeVisible({ timeout: 10_000 });
    if (await page.locator('[data-search-more]').isVisible()) {
      expect(await rows(page)).toHaveLength(10);
      return;
    }
  }
  test.skip(true, 'no broad query returned more than one page; the index is too small for this check');
});
