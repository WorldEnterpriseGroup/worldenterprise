import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import { AXE_TAGS } from '../../support/page-guards.ts';
import { isBuilt } from '../../support/routes.ts';
import { FULL_HD, expectNoHorizontalScroll } from '../wp-51/lib/full-width.ts';

// WP-22 (issue #88): the media primitives in place. /about/ carries the captioned explainer film (#decade) and the milestone carousel;
// /network/ carries the "Worlds WE builds" lightbox gallery. Each is checked with scripts on (dialog focus, keys, carousel controls and
// status, pausing), with scripts off (the plain fallbacks), with axe, and for sideways scroll at 390 (mobile project) and 1920 (desktop).

const ABOUT = '/about/';
const NETWORK = '/network/';
const FILM = '#about-film';
const CAROUSEL = '#about-milestones';
const GALLERY = '#network-worlds-gallery';
const GALLERY_SECTION = 'section[aria-labelledby="network-worlds"]';
const isDesktop = (info: TestInfo): boolean => info.project.name === 'wave8-desktop-1440x900';

function axeList(violations: readonly { id: string; nodes: readonly { target: readonly unknown[] }[] }[]): string[] {
  return violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

async function gotoReady(page: Page, path: string, element: string): Promise<void> {
  await page.goto(path);
  await expect(page.locator(element)).toHaveAttribute('data-ready', '');
}

test.describe('captioned film on /about/', () => {
  test.use({ reducedMotion: 'reduce' });
  test.beforeEach(() => {
    test.skip(!isBuilt(ABOUT), 'About is not built');
  });

  test('the player fetches nothing before play, has captions, a content cue, a transcript and a download', async ({ page }) => {
    await gotoReady(page, ABOUT, FILM);
    const video = page.locator(`${FILM} video`);
    await expect(video).toHaveAttribute('preload', 'none');
    await expect(video).toHaveAttribute('controls', '');
    await expect(video).not.toHaveAttribute('autoplay', /.*/);
    await expect(video).toHaveAttribute('poster', /\.avif$/);
    await expect(video).toHaveAttribute('width', '1920');
    await expect(video).toHaveAttribute('height', '1080');
    await expect(video).toHaveJSProperty('paused', true);
    await expect(page.locator(`${FILM} video source`)).toHaveCount(2);
    await expect(page.locator(`${FILM} video source`).first()).toHaveAttribute('type', /^video\/webm; codecs="av01/);

    const track = page.locator(`${FILM} video track[kind="captions"]`);
    await expect(track).toHaveCount(1);
    await expect(track).toHaveAttribute('srclang', 'en');
    const vtt = await page.request.get(new URL((await track.getAttribute('src')) ?? '', page.url()).href);
    expect(vtt.status()).toBe(200);
    expect(await vtt.text()).toMatch(/^WEBVTT\n/);

    await expect(page.locator(`${FILM} .cvideo__cue time`)).toHaveAttribute('datetime', 'PT57S');
    await expect(page.locator(`${FILM} .cvideo__cue`)).toContainText('no sound');

    const transcript = page.locator(`${FILM} details.cvideo__transcript`);
    await expect(transcript).not.toHaveAttribute('open', /.*/);
    await transcript.locator('summary').click();
    await expect(transcript).toHaveAttribute('open', '');
    for (const text of ['Incubation: the dust gathers', 'Launch: the world lights up', 'Year 10. A world in its system', '77.9%', '34.7%', 'Sources']) {
      await expect(transcript, text).toContainText(text);
    }
    await expect(page.locator(`${FILM} .cvideo__download a[download]`)).toHaveAttribute('href', /\.mp4$/);
  });

  test('both encodings are served with seekable byte ranges and stay within 4 MB', async ({ page }) => {
    await page.goto(ABOUT);
    for (const source of await page.locator(`${FILM} video source`).all()) {
      const url = new URL((await source.getAttribute('src')) ?? '', page.url()).href;
      const part = await page.request.get(url, { headers: { Range: 'bytes=0-1023' } });
      expect(part.status(), url).toBe(206);
      expect(part.headers()['content-type'], url).toMatch(/^video\/(webm|mp4)$/);
      const total = Number(/\/(\d+)$/.exec(part.headers()['content-range'] ?? '')?.[1] ?? 'NaN');
      expect(total, url).toBeLessThanOrEqual(4 * 1024 * 1024);
    }
  });

  test('the film pauses when the tab is hidden and when the visitor leaves', async ({ page }) => {
    await gotoReady(page, ABOUT, FILM);
    const video = page.locator(`${FILM} video`);
    await video.scrollIntoViewIfNeeded();
    const started = await video.evaluate(async (el: HTMLVideoElement) => {
      el.muted = true;
      try {
        await el.play();
        return !el.paused;
      } catch (error) {
        return String(error);
      }
    });
    test.skip(started !== true, `this browser build cannot play the film here: ${String(started)}`);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(video).toHaveJSProperty('paused', true);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    });
    await video.evaluate((el: HTMLVideoElement) => el.play());
    await expect(video).toHaveJSProperty('paused', false);
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await expect(video).toHaveJSProperty('paused', true);
  });
});

test.describe('milestone carousel on /about/', () => {
  test.beforeEach(() => {
    test.skip(!isBuilt(ABOUT), 'About is not built');
  });

  test('a labelled region with Previous, Next, item buttons and an "Item n of N" status', async ({ page }) => {
    await gotoReady(page, ABOUT, CAROUSEL);
    const root = page.locator(CAROUSEL);
    const region = root.locator('[aria-roledescription="carousel"]');
    await expect(region).toHaveAttribute('aria-labelledby', 'about-milestones-title');
    await expect(page.locator('#about-milestones-title')).toHaveText('The decade, milestone by milestone');
    const status = root.locator('[data-status]');
    await expect(status).toHaveAttribute('aria-live', 'polite');
    await expect(status).toHaveText('Item 1 of 7');
    await expect(root.locator('[data-prev]')).toBeDisabled();
    const markers = root.locator('[data-markers] button');
    await expect(markers).toHaveCount(7);
    await expect(markers.first()).toHaveAttribute('aria-current', 'true');

    await root.locator('[data-next]').click();
    await expect(status).toHaveText('Item 2 of 7');
    await expect(markers.nth(1)).toHaveAttribute('aria-current', 'true');
    await expect(root.locator('[data-prev]')).toBeEnabled();

    await markers.nth(4).click();
    await expect(status).toHaveText('Item 5 of 7');
    await expect(markers.nth(4)).toHaveAttribute('aria-current', 'true');

    await markers.nth(6).click();
    await expect(status).toHaveText('Item 7 of 7');
    await expect(root.locator('[data-next]')).toBeDisabled();
    await expect(root.locator('li').nth(6)).toBeInViewport();

    await root.locator('[data-prev]').click();
    await expect(status).toHaveText('Item 6 of 7');
  });

  test('no autoplay: the carousel stays on its item when left alone', async ({ page }) => {
    await gotoReady(page, ABOUT, CAROUSEL);
    const track = page.locator(`${CAROUSEL} [data-track]`);
    const before = await track.evaluate((el) => el.scrollLeft);
    await page.waitForTimeout(3000);
    expect(await track.evaluate((el) => el.scrollLeft)).toBe(before);
    await expect(page.locator(`${CAROUSEL} [data-status]`)).toHaveText('Item 1 of 7');
  });

  test('smooth scrolling only without a reduced-motion preference', async ({ browser }) => {
    for (const [reducedMotion, expected] of [
      ['reduce', 'auto'],
      ['no-preference', 'smooth'],
    ] as const) {
      const context = await browser.newContext({ reducedMotion });
      const page = await context.newPage();
      await page.goto(ABOUT);
      expect(await page.locator(`${CAROUSEL} [data-track]`).evaluate((el) => getComputedStyle(el).scrollBehavior), reducedMotion).toBe(expected);
      await context.close();
    }
  });
});

test.describe('lightbox gallery on /network/', () => {
  test.use({ reducedMotion: 'reduce' });
  test.beforeEach(() => {
    test.skip(!isBuilt(NETWORK), 'Network is not built');
  });

  test('a thumbnail opens the dialog, focus moves in, stays in and returns on Escape', async ({ page }) => {
    await gotoReady(page, NETWORK, GALLERY);
    const links = page.locator(`${GALLERY} a.lightbox__link`);
    await expect(links).toHaveCount(7);
    const dialog = page.locator(`${GALLERY} dialog`);
    await expect(dialog).toHaveAttribute('closedby', 'any');
    await expect(dialog).not.toBeVisible();

    await links.nth(1).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-close]')).toBeFocused();
    await expect(dialog.locator('[data-position]')).toHaveText('2 of 7');
    await expect(dialog.locator('[data-live]')).toHaveText(/^Image 2 of 7: Months 0 to 7/);
    const img = dialog.locator('[data-stage] img');
    await expect(img).toHaveCount(1);
    await expect(img).toHaveAttribute('alt', /core built from hexagonal tiles/);
    await expect(img).toHaveJSProperty('complete', true);

    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate((el) => el.contains(document.activeElement)), `Tab ${i + 1} stays in the dialog`).toBe(true);
    }
    await page.keyboard.press('Shift+Tab');
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(links.nth(1)).toBeFocused();
    await expect(dialog.locator('[data-stage] img')).toHaveCount(0);
  });

  test('Previous, Next and the arrow keys step through the set and announce each item', async ({ page }) => {
    await gotoReady(page, NETWORK, GALLERY);
    const dialog = page.locator(`${GALLERY} dialog`);
    const position = dialog.locator('[data-position]');
    const live = dialog.locator('[data-live]');
    await page.locator(`${GALLERY} a.lightbox__link`).first().click();
    await expect(position).toHaveText('1 of 7');
    await dialog.locator('[data-next]').click();
    await expect(position).toHaveText('2 of 7');
    await expect(live).toHaveText(/^Image 2 of 7: /);
    await dialog.locator('[data-prev]').click();
    await dialog.locator('[data-prev]').click();
    await expect(position).toHaveText('7 of 7');
    await expect(live).toHaveText(/^Image 7 of 7: Year 10/);
    await page.keyboard.press('ArrowRight');
    await expect(position).toHaveText('1 of 7');
    await page.keyboard.press('ArrowLeft');
    await expect(position).toHaveText('7 of 7');
    await page.keyboard.press('Home');
    await expect(position).toHaveText('1 of 7');
    await dialog.locator('[data-close]').click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator(`${GALLERY} a.lightbox__link`).first()).toBeFocused();
    // Arrow keys belong to the dialog only: with it closed they do nothing to the gallery.
    await page.keyboard.press('ArrowRight');
    await expect(dialog).not.toBeVisible();
  });

  test('the open viewer passes axe and the zoom transition is off under reduced motion', async ({ page }) => {
    await gotoReady(page, NETWORK, GALLERY);
    await page.locator(`${GALLERY} a.lightbox__link`).nth(2).click();
    const img = page.locator(`${GALLERY} dialog [data-stage] img`);
    await expect(img).toBeVisible();
    expect(await img.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
    const results = await new AxeBuilder({ page }).include(`${GALLERY} dialog`).withTags(AXE_TAGS).analyze();
    expect(axeList(results.violations)).toEqual([]);
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('/about/ keeps the native player, the transcript, the download and a plain ordered list', async ({ page }) => {
    test.skip(!isBuilt(ABOUT), 'About is not built');
    await page.goto(ABOUT);
    await expect(page.locator(`${FILM} video[controls]`)).toBeVisible();
    await expect(page.locator(`${FILM} video`)).toHaveAttribute('poster', /\.avif$/);
    await expect(page.locator(`${FILM} details.cvideo__transcript summary`)).toBeVisible();
    await expect(page.locator(`${FILM} .cvideo__download a[download]`)).toBeVisible();
    const list = page.locator(`${CAROUSEL} ol.carousel__track`);
    await expect(list).toBeVisible();
    await expect(list.locator(':scope > li')).toHaveCount(7);
    await expect(page.locator(`${CAROUSEL} [data-controls]`)).toBeHidden();
    await expect(page.locator(`${CAROUSEL} [data-markers]`)).toBeHidden();
  });

  test('/network/ gallery links open the full-size images', async ({ page }) => {
    test.skip(!isBuilt(NETWORK), 'Network is not built');
    await page.goto(NETWORK);
    const links = page.locator(`${GALLERY} a.lightbox__link`);
    await expect(links).toHaveCount(7);
    await expect(page.locator(`${GALLERY} dialog`)).not.toBeVisible();
    const href = (await links.first().getAttribute('href')) ?? '';
    expect(href).toMatch(/\.avif$/);
    const image = await page.request.get(new URL(href, page.url()).href);
    expect(image.status()).toBe(200);
    expect(image.headers()['content-type']).toBe('image/avif');
    await links.first().click();
    await expect(page).toHaveURL(/\.avif$/);
  });
});

test.describe('axe and width', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the film band and the gallery section pass axe', async ({ page }) => {
    test.skip(!isBuilt(ABOUT) || !isBuilt(NETWORK), 'About or Network is not built');
    await gotoReady(page, ABOUT, CAROUSEL);
    const about = await new AxeBuilder({ page }).include('#decade').withTags(AXE_TAGS).analyze();
    expect(axeList(about.violations)).toEqual([]);
    await gotoReady(page, NETWORK, GALLERY);
    const network = await new AxeBuilder({ page }).include(GALLERY_SECTION).withTags(AXE_TAGS).analyze();
    expect(axeList(network.violations)).toEqual([]);
  });

  test('no sideways scroll at 390 px (mobile project)', async ({ page }, info) => {
    test.skip(isDesktop(info), 'the phone width runs in the mobile project');
    for (const path of [ABOUT, NETWORK]) {
      test.skip(!isBuilt(path), `${path} is not built`);
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      await expectNoHorizontalScroll(page);
      const film = page.locator(`${FILM} video`);
      if (path === ABOUT) expect(((await film.boundingBox())?.width ?? 0) <= (page.viewportSize()?.width ?? 0)).toBe(true);
    }
  });

  test('no sideways scroll at 1920 px, and the film spans the frame', async ({ page }, info) => {
    test.skip(!isDesktop(info), 'the full HD width runs once, in the desktop project');
    await page.setViewportSize(FULL_HD);
    for (const path of [ABOUT, NETWORK]) {
      test.skip(!isBuilt(path), `${path} is not built`);
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      await expectNoHorizontalScroll(page);
    }
    await page.goto(ABOUT);
    const box = await page.locator(`${FILM} video`).boundingBox();
    expect(box?.width ?? 0, 'the film plays wide on a full HD screen').toBeGreaterThanOrEqual(1500);
    expect(Math.abs((box?.width ?? 0) / (box?.height ?? 1) - 16 / 9)).toBeLessThan(0.02);
  });
});
