import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { findOverflow } from '../../support/overflow.ts';
import { AXE_TAGS, watch } from '../../support/page-guards.ts';
import { isBuilt } from '../../support/routes.ts';

// WP-45 (visual system v2): the statement hero, the stage rail, the scroll-driven and view-transition moments, and the three modes
// the brief names (reduced motion, forced colors, 200 % zoom). Each test skips while its route is not built, and sets its own motion
// and color preferences, so the project only decides the viewport (1440 and 390).

const STATEMENT_ROUTES = ['/founders/', '/investors/', '/network/operators/'] as const;
const STAGE_ROUTES = [
  { path: '/program/dream/', current: 'Dream', states: ['current', 'next', 'next'] },
  { path: '/program/build/', current: 'Build', states: ['done', 'current', 'next'] },
  { path: '/program/grow/', current: 'Grow', states: ['done', 'done', 'current'] },
] as const;

/** Relative luminance of the computed `rgb()` or `color(srgb ...)` value, 0 (black) to 1 (white). */
async function luminanceOf(page: Page, selector: string): Promise<number> {
  return page.locator(selector).first().evaluate((el) => {
    const probe = document.createElement('canvas');
    probe.width = 1;
    probe.height = 1;
    const context = probe.getContext('2d');
    if (!context) throw new Error('no 2d canvas context');
    // Paint over white so a gradient or a color-mix() value is read as the pixel the reader sees.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, 1, 1);
    context.fillStyle = getComputedStyle(el).backgroundColor;
    context.fillRect(0, 0, 1, 1);
    const [r = 0, g = 0, b = 0] = Array.from(context.getImageData(0, 0, 1, 1).data);
    const channel = (value: number): number => {
      const s = value / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  });
}

test.describe('statement hero', () => {
  for (const route of STATEMENT_ROUTES) {
    test(`${route} opens with the statement hero: one h1, a light wash, the action in the first viewport`, async ({ page, baseURL }) => {
      test.skip(!isBuilt(route), `${route} is not built`);
      const seen = watch(page, baseURL ?? '');
      await page.goto(route);
      const hero = page.locator('section.hero[data-variant="statement"]');
      await expect(hero).toHaveCount(1);
      // The statement hero is the compact hero, so the layout contract in folds.spec (editorial or compact) still holds.
      await expect(hero).toHaveAttribute('data-hero', 'compact');
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(hero.locator('h1')).toBeVisible();
      expect(await luminanceOf(page, 'section.hero[data-variant="statement"]'), 'the hero wash is light').toBeGreaterThan(0.85);
      const action = hero.locator('a.btn--primary').first();
      if ((await action.count()) > 0) {
        const box = await action.boundingBox();
        const height = page.viewportSize()?.height ?? 0;
        expect(box).not.toBeNull();
        expect((box?.y ?? 0) + (box?.height ?? 0), 'the primary action ends inside the first viewport').toBeLessThanOrEqual(height);
      }
      expect(await findOverflow(page), 'nothing leaves the viewport').toEqual([]);
      expect(seen.consoleErrors).toEqual([]);
      expect(seen.thirdParty).toEqual([]);
    });
  }

  test('a page with media keeps the editorial hero', async ({ page }) => {
    const route = '/services/';
    test.skip(!isBuilt(route), `${route} is not built`);
    await page.goto(route);
    await expect(page.locator('section.hero[data-variant="statement"]')).toHaveCount(0);
  });
});

test.describe('stage rail', () => {
  for (const stage of STAGE_ROUTES) {
    test(`${stage.path} marks ${stage.current} as the current stop`, async ({ page }) => {
      test.skip(!isBuilt(stage.path), `${stage.path} is not built`);
      await page.goto(stage.path);
      const rail = page.locator('nav.stagerail');
      await expect(rail).toHaveCount(1);
      await expect(rail).toHaveAttribute('aria-label', /.+/);
      const stops = rail.locator('li.stagerail__stop');
      await expect(stops).toHaveCount(3);
      for (const [index, state] of stage.states.entries()) {
        await expect(stops.nth(index)).toHaveAttribute('data-state', state);
      }
      const current = rail.locator('a[aria-current="step"]');
      await expect(current).toHaveCount(1);
      await expect(current).toContainText(stage.current);
      // Reachable by keyboard: every stop is a link, so all three are in the tab order.
      for (let index = 0; index < 3; index += 1) {
        await expect(stops.nth(index).locator('a')).toHaveAttribute('href', /\/program\/(dream|build|grow)\/$/);
      }
    });
  }

  test('the rail is not drawn on a program page that is not a stage', async ({ page }) => {
    const route = '/program/how-it-works/';
    test.skip(!isBuilt(route), `${route} is not built`);
    await page.goto(route);
    await expect(page.locator('nav.stagerail')).toHaveCount(0);
  });
});

test.describe('scroll-driven moments', () => {
  test('with motion welcome, the rail fill and the page title carry an animation timeline', async ({ page }) => {
    const route = STAGE_ROUTES[1].path;
    test.skip(!isBuilt(route), `${route} is not built`);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(route);
    const supported = await page.evaluate(() => CSS.supports('animation-timeline: view()'));
    test.skip(!supported, 'this browser has no scroll-driven animations; the default style is the finished picture');
    const fill = await page.locator('.stagerail__stop[data-state="current"]').evaluate((el) => {
      const style = getComputedStyle(el, '::after');
      return { name: style.animationName, timeline: style.animationTimeline };
    });
    expect(fill.name).not.toBe('none');
    expect(fill.timeline).toContain('view');
    expect(await page.locator('h1').first().evaluate((el) => getComputedStyle(el).viewTransitionName)).toBe('page-title');
  });

  test('with reduced motion there is no animation on the rail and no named view transition', async ({ page }) => {
    const route = STAGE_ROUTES[1].path;
    test.skip(!isBuilt(route), `${route} is not built`);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(route);
    const fill = await page.locator('.stagerail__stop[data-state="current"]').evaluate((el) => getComputedStyle(el, '::after').animationName);
    expect(fill).toBe('none');
    expect(await page.locator('h1').first().evaluate((el) => getComputedStyle(el).viewTransitionName)).toBe('none');
    // The finished picture: the line behind the current stop is complete, so the first stop's fill is not scaled down.
    const done = await page.locator('.stagerail__stop[data-state="done"]').first().evaluate((el) => getComputedStyle(el, '::after').transform);
    expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(done);
  });

  test('the program diagram and the evidence ledger animate only when motion is welcome', async ({ page }) => {
    const route = '/program/';
    test.skip(!isBuilt(route), `${route} is not built`);
    const probe = async (): Promise<{ steps: string[]; rail: string }> =>
      page.evaluate(() => ({
        steps: Array.from(document.querySelectorAll('.altitude__link')).map((el) => getComputedStyle(el).animationName),
        rail: (() => {
          const list = document.querySelector('.altitude ol');
          return list ? getComputedStyle(list, '::after').animationName : 'missing';
        })(),
      }));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(route);
    const reduced = await probe();
    expect(reduced.steps.every((name) => name === 'none'), 'no step animates under reduced motion').toBe(true);
    expect(['none', 'missing']).toContain(reduced.rail);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const supported = await page.evaluate(() => CSS.supports('animation-timeline: view()'));
    test.skip(!supported, 'this browser has no scroll-driven animations');
    const moving = await probe();
    expect(moving.steps.length).toBeGreaterThan(0);
    expect(moving.steps.every((name) => name !== 'none'), 'each step animates when motion is welcome').toBe(true);
  });
});

test.describe('modes', () => {
  for (const route of ['/founders/', '/program/dream/', '/program/']) {
    test(`${route} has nothing past the edge at 200 % zoom (a 720 px window)`, async ({ page }) => {
      test.skip(!isBuilt(route), `${route} is not built`);
      await page.setViewportSize({ width: 720, height: 450 });
      await page.goto(route);
      expect(await findOverflow(page)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    });

    test(`${route} keeps its shapes visible in forced colors`, async ({ page }) => {
      test.skip(!isBuilt(route), `${route} is not built`);
      await page.emulateMedia({ forcedColors: 'active', colorScheme: 'light' });
      await page.goto(route);
      await expect(page.locator('h1').first()).toBeVisible();
      for (const shape of await page.locator('.stagerail__node, .altitude__hex').all()) {
        const colors = await shape.evaluate((el) => {
          const style = getComputedStyle(el);
          return { background: style.backgroundColor, color: style.color };
        });
        // A node whose fill and letter are the same color would be a blank hex.
        expect(colors.background, 'the hex fill differs from its letter').not.toBe(colors.color);
      }
      expect(await findOverflow(page)).toEqual([]);
    });
  }
});

test.describe('accessibility', () => {
  for (const route of ['/founders/', '/program/dream/', '/program/']) {
    test(`${route} has no WCAG 2.2 AA violations on the new variants`, async ({ page }) => {
      test.skip(!isBuilt(route), `${route} is not built`);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(route);
      const result = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    });
  }

  test('the styleguide shows every new variant on a light tint', async ({ page }) => {
    const route = '/styleguide/';
    test.skip(!isBuilt(route), `${route} is not built`);
    await page.goto(route);
    for (const selector of ['.sg-tint--blue', '.sg-tint--sand', '.sg-tint--stone']) {
      expect(await luminanceOf(page, selector), `${selector} is a light tint`).toBeGreaterThan(0.85);
    }
    await expect(page.locator('#system .feature')).toHaveCount(2);
    await expect(page.locator('#system .ledgercard')).toHaveCount(1);
    await expect(page.locator('#system .claimcard')).toHaveCount(2);
    await expect(page.locator('#system nav.stagerail')).toHaveCount(1);
    await expect(page.locator('#system [aria-hidden="true"].divider')).toHaveCount(3);
    expect(await findOverflow(page)).toEqual([]);
  });
});
