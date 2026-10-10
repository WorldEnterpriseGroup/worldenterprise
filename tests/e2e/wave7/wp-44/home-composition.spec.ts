import { existsSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { isBuilt } from '../../support/routes.ts';

// WP-44, acceptance: the home page is an argument (promise, evidence, mechanism, price structure, limits, depth, action). There is no
// catalogue statistic, what you leave with reads Dream, Build and Grow, the packages teaser shows the four packages without an amount,
// each proof row links to the page that holds its evidence, the no-funding disclaimer is still there, and below-the-fold bands defer rendering.

const SECTION_ORDER = [
  'What you leave with',
  'A team that works for your company',
  'Four packages, sized to the stage you are at',
  'Promise and proof',
  'Evidence a serious investor asks for',
  'What WE does, and what it does not do',
  'Fully remote, by design',
  'Seven service lines, one team to answer to',
  'Latest insights',
  'Questions founders ask first',
] as const;

test.beforeEach(() => {
  test.skip(!isBuilt('/'), 'home is not built');
  test.skip(!existsSync('src/components/home/leave-with/LeaveWith.astro'), 'the leave-with band has not merged');
});

test('the sections follow the planned order, and the first six are always there', async ({ page }) => {
  await page.goto('/');
  // A heading of the Markdown body may carry an anchor, so a heading matches a planned title when it starts with it.
  const headings = (await page.locator('main h2').allTextContents())
    .map((t) => t.trim())
    .map((t) => SECTION_ORDER.find((title) => t.startsWith(title)) ?? t);
  const present = SECTION_ORDER.filter((title) => headings.includes(title));
  expect(headings.filter((h) => (SECTION_ORDER as readonly string[]).includes(h)), 'the planned sections, in page order').toEqual(present);
  for (const title of SECTION_ORDER.slice(0, 6)) expect(headings, `"${title}" is on the page`).toContain(title);
  await expect(page.locator('h1'), 'one h1').toHaveCount(1);
});

test('there is no catalogue-count band and no numeric catalogue statistic', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.factband'), 'no fact band').toHaveCount(0);
  const text = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
  expect(text).not.toMatch(/\b\d+\s*(?:playbooks?|templates?|insight articles?|articles?|service lines?|research briefs?|frameworks?|stages?)\b/i);
  expect(text).not.toMatch(/(?:Service lines|Playbooks|Insight articles|Research briefs|Published frameworks)\s*\d/);
});

test('what you leave with has one column each for Dream, Build and Grow, with exit evidence and working material', async ({ page }) => {
  await page.goto('/');
  const band = page.locator('section[aria-labelledby="home-leave-with"]');
  const cards = band.locator('article');
  await expect(cards).toHaveCount(3);
  await expect(cards.locator('h3')).toHaveText(['Dream', 'Build', 'Grow']);
  for (const name of ['Dream', 'Build', 'Grow']) {
    const card = band.locator('article', { has: page.getByRole('heading', { level: 3, name }) });
    await expect(card.locator('ul').first().locator('li').first(), `${name}: exit evidence`).toBeVisible();
    expect(await card.locator('ul').nth(0).locator('li').count(), `${name}: exit evidence items`).toBeGreaterThan(0);
    expect(await card.locator('ul').nth(1).locator('li a').count(), `${name}: working material links`).toBeGreaterThan(0);
    await expect(card.getByRole('link', { name: `Read about ${name}` })).toHaveAttribute('href', new RegExp(`/program/${name.toLowerCase()}/$`));
  }
  const links = await band.locator('.leave__material a').evaluateAll((anchors) => anchors.map((a) => (a as HTMLAnchorElement).getAttribute('href') ?? ''));
  expect(links.length).toBeGreaterThanOrEqual(3);
  for (const link of links) expect(link, 'a working material link is a site path').toMatch(/^\/(?:playbooks|library|fundability)\//);
});

test('the columns sit side by side on a wide screen and stack on a phone, at one height', async ({ page }) => {
  await page.goto('/');
  const boxes = await page.locator('section[aria-labelledby="home-leave-with"] article').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
    }),
  );
  expect(boxes).toHaveLength(3);
  const wide = (page.viewportSize()?.width ?? 0) >= 1000;
  if (wide) {
    expect(new Set(boxes.map((b) => b.y)).size, 'the three cards start on one line').toBe(1);
    expect(new Set(boxes.map((b) => b.height)).size, 'the three cards are one height').toBe(1);
    expect(boxes[0]?.x ?? 0).toBeLessThan(boxes[1]?.x ?? 0);
    expect(boxes[1]?.x ?? 0).toBeLessThan(boxes[2]?.x ?? 0);
  } else {
    expect(new Set(boxes.map((b) => b.x)).size, 'the cards share one left edge').toBe(1);
    expect(boxes[0]?.y ?? 0).toBeLessThan(boxes[1]?.y ?? 0);
    expect(boxes[1]?.y ?? 0).toBeLessThan(boxes[2]?.y ?? 0);
  }
});

test('the packages teaser names the four packages, links apply and pricing, and shows no amount', async ({ page }) => {
  await page.goto('/');
  const section = page.locator('section[aria-labelledby="home-packages"]');
  await expect(section.locator('h3')).toHaveText(['Spark', 'Launch', 'Accelerate', 'Studio']);
  for (const id of ['spark', 'launch', 'accelerate', 'studio']) {
    await expect(section.locator(`a[href$="/apply/?package=${id}"]`), `apply link for ${id}`).toHaveCount(1);
  }
  await expect(section.getByRole('link', { name: 'See seats and packages' })).toHaveAttribute('href', /\/pricing\/$/);
  const text = await section.innerText();
  expect(text).not.toMatch(/[$€£]|\bUSD\b|\bper (?:month|seat)\b/i);
  expect(text).not.toMatch(/\b\d+\s+(?:dedicated\s+)?seats?\b/i);
});

test('every promise-and-proof row leads with its source, links to it, and the whole row is the target', async ({ page }) => {
  await page.goto('/');
  const rows = page.locator('section[aria-labelledby="home-proof"] .proof__row');
  await expect(rows).toHaveCount(4);
  for (let i = 0; i < 4; i += 1) {
    const row = rows.nth(i);
    const link = row.locator('a.proof__link');
    await expect(link, `row ${i} has one link`).toHaveCount(1);
    await expect(link).toHaveAttribute('href', /^\/.+\/$/);
    const source = await row.locator('.proof__source').boundingBox();
    const claim = await row.locator('.proof__claim').boundingBox();
    expect(source?.y ?? 0, `row ${i}: the source comes first`).toBeLessThan(claim?.y ?? 0);
    const rowBox = await row.boundingBox();
    const cover = await link.evaluate((a) => getComputedStyle(a, '::after').position);
    expect(cover, `row ${i}: the link covers the row`).toBe('absolute');
    expect(rowBox?.height ?? 0, `row ${i} is a comfortable target`).toBeGreaterThan(40);
  }
  await expect(rows.nth(0).locator('a.proof__link')).toHaveAttribute('href', /\/program\/how-it-works\/$/);
  await expect(rows.nth(3).locator('a.proof__link')).toHaveAttribute('href', /\/fundability\/$/);
  // The link is stretched over the row by a pseudo-element, so a click on the claim text is a click on the link.
  const target = rows.nth(1);
  await target.scrollIntoViewIfNeeded();
  const claimBox = await target.locator('.proof__claim').boundingBox();
  expect(claimBox, 'the claim has a box').not.toBeNull();
  await page.mouse.click((claimBox?.x ?? 0) + 8, (claimBox?.y ?? 0) + (claimBox?.height ?? 0) / 2);
  await expect(page).toHaveURL(/\/program\/dedicated-teams\/$/);
});

test('the no-funding disclaimer is on the page, next to the investor evidence', async ({ page }) => {
  await page.goto('/');
  const section = page.locator('section[aria-labelledby="home-fundable"]');
  await expect(section.getByText('WE makes no promise of funding.')).toBeVisible();
});

test('every band below the first one defers its rendering; the first and the hero do not', async ({ page }) => {
  await page.goto('/');
  const states = await page.locator('main > section, main section.section').evaluateAll((els) =>
    els.map((el) => ({ id: el.getAttribute('aria-labelledby') ?? el.className, cv: getComputedStyle(el).contentVisibility })),
  );
  const leave = states.find((s) => s.id === 'home-leave-with');
  expect(leave?.cv, 'the band under the hero renders at once').toBe('visible');
  const deferred = states.filter((s) => s.cv === 'auto');
  expect(deferred.length, `deferred bands: ${JSON.stringify(states)}`).toBeGreaterThanOrEqual(6);
  const ids = new Set(deferred.map((s) => s.id));
  for (const id of ['home-team', 'home-packages', 'home-proof', 'home-fundable', 'home-remote', 'home-faq']) expect(ids.has(id), `${id} defers`).toBe(true);
});
