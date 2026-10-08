import { expect, test } from '@playwright/test';
import { isBuilt } from './support/routes.ts';

// Mega-menu matrix, SAGE-PLAN 5.5: tab order, Enter and Space open, Escape closes and returns focus, arrow keys, Home and End,
// outside click, hover intent (fine pointers only), touch at 390 px. The no-JS, forced-colors and 200% zoom rows are in modes.spec.ts.

test.beforeEach(() => {
  test.skip(!isBuilt('/'), 'home is not built');
});

test.describe('desktop navigation', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, 'desktop only');
  });

  test('the skip link is the first tab stop and then the logo and triggers follow in reading order', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.locator('a.skip-link')).toBeFocused();
    await expect(page.locator('a.skip-link')).toHaveAttribute('href', '#main');
    const order: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press('Tab');
      order.push(await page.evaluate(() => (document.activeElement?.hasAttribute('data-mega-trigger') ? 'trigger' : (document.activeElement?.tagName ?? ''))));
    }
    expect(order, 'at least one mega trigger is reachable by Tab within the header').toContain('trigger');
  });

  for (const key of ['Enter', 'Space']) {
    test(`${key} opens a panel, Escape closes it and focus returns to the trigger`, async ({ page }) => {
      await page.goto('/');
      const trigger = page.locator('[data-mega-trigger]').first();
      await trigger.focus();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await page.keyboard.press(key);
      const panel = page.locator('[data-mega-panel]:popover-open');
      await expect(panel).toBeVisible();
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await expect(panel.locator('a.mega-panel__hub')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(panel).toBeHidden();
      await expect(trigger).toBeFocused();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
  }

  test('arrow keys move between triggers, Home and End jump to the ends, ArrowDown enters the panel', async ({ page }) => {
    await page.goto('/');
    const triggers = page.locator('[data-mega-trigger]');
    const last = (await triggers.count()) - 1;
    expect(last).toBeGreaterThan(0);
    await triggers.first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(triggers.nth(1)).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(triggers.first()).toBeFocused();
    await page.keyboard.press('End');
    await expect(triggers.nth(last)).toBeFocused();
    await page.keyboard.press('Home');
    await expect(triggers.first()).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('[data-mega-panel]:popover-open a').first()).toBeFocused();
  });

  test('opening one panel closes the other (single open)', async ({ page }) => {
    await page.goto('/');
    const triggers = page.locator('[data-mega-trigger]');
    await triggers.nth(0).click();
    await expect(page.locator('[data-mega-panel]:popover-open')).toHaveCount(1);
    await triggers.nth(1).click();
    await expect(page.locator('[data-mega-panel]:popover-open')).toHaveCount(1);
    await expect(triggers.nth(1)).toHaveAttribute('aria-expanded', 'true');
    await expect(triggers.nth(0)).toHaveAttribute('aria-expanded', 'false');
  });

  test('a click outside closes the panel', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-mega-trigger]').first().click();
    await expect(page.locator('[data-mega-panel]:popover-open')).toBeVisible();
    // The open panel fills the viewport below the header, so the outside point is a blank spot in the header itself.
    const point = await page.evaluate(() => {
      const header = document.querySelector('header');
      const box = header?.getBoundingClientRect();
      if (!box) return null;
      const y = box.top + box.height / 2;
      for (let x = Math.floor(box.width / 2); x < box.width - 4; x += 8) {
        const hit = document.elementFromPoint(x, y);
        if (hit && !hit.closest('a, button, [popover], summary, input')) return { x, y };
      }
      return null;
    });
    expect(point, 'a blank header point exists to click').not.toBeNull();
    await page.mouse.click(point?.x ?? 0, point?.y ?? 0);
    await expect(page.locator('[data-mega-panel]:popover-open')).toHaveCount(0);
  });

  test('the panel stays inside the viewport and does not move the page (no layout shift)', async ({ page }) => {
    await page.goto('/');
    const before = await page.locator('main#main').boundingBox();
    await page.locator('[data-mega-trigger]').first().click();
    const panel = page.locator('[data-mega-panel]:popover-open');
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect((box?.x ?? -1) >= 0 && (box?.x ?? 0) + (box?.width ?? 0) <= (viewport?.width ?? 0) + 1, 'panel within viewport width').toBe(true);
    expect((box?.y ?? 0) + (box?.height ?? 0) <= (viewport?.height ?? 0) + 1, 'panel within viewport height').toBe(true);
    expect(await page.locator('main#main').boundingBox(), 'main did not shift').toEqual(before);
  });

  test('hover intent opens a panel for a fine pointer and Escape dismisses it', async ({ page }) => {
    await page.goto('/');
    const trigger = page.locator('[data-mega-trigger]').first();
    await trigger.hover();
    const panel = page.locator('[data-mega-panel]:popover-open');
    await expect(panel).toBeVisible({ timeout: 2000 });
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
  });
});

test.describe('mobile navigation', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(!isMobile, 'mobile only');
  });

  test('a tap on Menu opens the drawer with grouped sections and Escape closes it', async ({ page }) => {
    await page.goto('/');
    const button = page.getByRole('button', { name: 'Menu' });
    await button.tap();
    const drawer = page.locator('[data-mobile-drawer]');
    await expect(drawer).toBeVisible();
    const group = drawer.locator('summary').first();
    await expect(group).toBeVisible();
    await group.tap();
    await expect(drawer.locator('details[open] a').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
  });

  test('touch targets in the drawer are at least 24 by 24 CSS pixels', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Menu' }).tap();
    const small = await page.evaluate(() =>
      [...document.querySelectorAll('[data-mobile-drawer] a, [data-mobile-drawer] summary, [data-mobile-drawer] button')]
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width > 0 && (r.width < 24 || r.height < 24))
        .length,
    );
    expect(small).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------
// WP-16: current section, header fit, mega menu identity, drawer focus, fixed Apply bar.

test.describe('the current section in the header', () => {
  // Apply, Contact and Trust are listed in a panel so people can find them, but they are not part of that section. The link to the
  // page itself keeps aria-current="page"; no top-level item is current. The mapping is unit-tested in tests/unit/wp-16.
  const expectations: readonly { route: string; section: string | null }[] = [
    { route: '/apply/', section: null },
    { route: '/apply/thanks/', section: null },
    { route: '/contact/', section: null },
    { route: '/trust/', section: null },
    { route: '/founders/', section: 'Network' },
    { route: '/press/', section: 'About' },
    { route: '/fundability/', section: 'Playbooks' },
    { route: '/glossary/', section: 'Resources' },
    { route: '/pricing/', section: 'Pricing' },
  ];

  for (const { route, section } of expectations) {
    test(`${route} marks ${section ?? 'no top-level item'} as current`, async ({ page }) => {
      test.skip(!isBuilt(route), `${route} is not built`);
      await page.goto(route);
      // The markup of both navs is in the document at every width; only one of them is shown.
      const desktop = await page.locator('[data-mega-nav] > ul > li > :is(a, button)[aria-current]').evaluateAll((els) => els.map((el) => `${el.getAttribute('aria-current')}:${(el.textContent ?? '').trim()}`));
      const drawer = await page.locator('[data-mobile-drawer] > nav > ul > li > :is(a, summary)[aria-current], [data-mobile-drawer] > nav > ul > li > details > summary[aria-current]').evaluateAll((els) => els.map((el) => `${el.getAttribute('aria-current')}:${(el.textContent ?? '').trim()}`));
      const expected = section === null ? [] : [`${route === '/pricing/' ? 'page' : 'true'}:${section}`];
      expect(desktop, 'desktop navigation').toEqual(expected);
      expect(drawer, 'mobile drawer').toEqual(expected);
    });
  }

  test('the Apply link of the page that is the application is the current page', async ({ page }) => {
    test.skip(!isBuilt('/apply/'), '/apply/ is not built');
    await page.goto('/apply/');
    await expect(page.locator('main#main')).toBeAttached();
    const current = await page.locator('header [aria-current="page"]').evaluateAll((els) => els.map((el) => (el.textContent ?? '').trim()));
    expect(current.some((text) => text.startsWith('Apply'))).toBe(true);
  });
});

test.describe('the header at the widths between the drawer and the full nav', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, 'desktop only');
  });

  // The logo has a brand minimum of 160px. It used to shrink to 117px at 1100px to make room for the nav; now it holds 160px and the
  // nav gives 1px of type. Nothing may wrap, collide with the Apply button or leave the header.
  for (const width of [1100, 1140, 1180, 1230, 1279, 1440]) {
    test(`at ${width}px the logo is legible and the nav fits on one row`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      const m = await page.evaluate(() => {
        const box = (el: Element | null): { left: number; right: number; top: number; bottom: number; width: number } | null => {
          if (el === null) return null;
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width };
        };
        const items = [...document.querySelectorAll('.mega-nav__list > li > :is(a, button)')].map((el) => box(el));
        return {
          viewport: document.documentElement.clientWidth,
          scroll: document.documentElement.scrollWidth,
          logo: box(document.querySelector('.site-header__logo img')),
          nav: box(document.querySelector('.mega-nav__list')),
          apply: box(document.querySelector('.site-header__apply')),
          items,
          font: parseFloat(getComputedStyle(document.querySelector('.mega-nav__trigger') ?? document.body).fontSize),
        };
      });
      expect(m.logo, 'the logo is rendered').not.toBeNull();
      expect(m.logo?.width ?? 0, 'logo width in CSS pixels').toBeGreaterThanOrEqual(159);
      if (width >= 1279) expect(m.logo?.width ?? 0, 'the full logo from 1279px').toBeGreaterThanOrEqual(255);
      expect(m.scroll, 'the document does not scroll sideways').toBeLessThanOrEqual(m.viewport);
      const tops = m.items.map((item) => Math.round(item?.top ?? -1));
      expect(new Set(tops).size, `nav items share one row (tops ${tops.join(', ')})`).toBe(1);
      expect(m.items.length, 'nav items').toBeGreaterThanOrEqual(7);
      expect(m.nav?.right ?? 0, 'nav ends before the Apply button').toBeLessThanOrEqual((m.apply?.left ?? 0) - 8);
      expect(m.apply?.right ?? 0, 'Apply stays inside the viewport').toBeLessThanOrEqual(m.viewport);
      expect(m.logo?.right ?? 0, 'logo ends before the nav').toBeLessThanOrEqual((m.nav?.left ?? 0) + 1);
      if (width < 1280) expect(m.font, 'nav type under 1280px').toBeCloseTo(15, 0);
      else expect(m.font, 'nav type from 1280px').toBeGreaterThanOrEqual(16);
    });
  }
});

test.describe('mega panel identity and spacing', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, 'desktop only');
  });

  test('each link is a grid with a hex bullet, and the label sits closer to its description than to the next link', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.locator('[data-mega-trigger]').first().click();
    const panel = page.locator('[data-mega-panel]:popover-open');
    await expect(panel).toBeVisible();
    const report = await panel.evaluate((el) => {
      const links = [...el.querySelectorAll<HTMLElement>('.mega-panel__column li > a')];
      const first = links[0];
      const bullet = first === undefined ? null : getComputedStyle(first, '::before');
      const gaps = links.flatMap((a, i) => {
        const label = a.querySelector('.mega-panel__label')?.getBoundingClientRect();
        const desc = a.querySelector('.mega-panel__desc')?.getBoundingClientRect();
        const next = links[i + 1];
        if (label === undefined || desc === undefined || next === undefined || a.closest('ul') !== next.closest('ul')) return [];
        const nextLabel = next.querySelector('.mega-panel__label')?.getBoundingClientRect();
        return nextLabel === undefined ? [] : [{ inner: desc.top - label.bottom, outer: nextLabel.top - desc.bottom }];
      });
      const measure = [...el.querySelectorAll<HTMLElement>('.mega-panel__desc')].map((d) => d.getBoundingClientRect().width);
      const probe = document.createElement('span');
      probe.style.cssText = 'position:absolute;visibility:hidden;inline-size:38ch';
      el.querySelector('.mega-panel__desc')?.append(probe);
      const limit = probe.getBoundingClientRect().width;
      probe.remove();
      return {
        links: links.length,
        bulletWidth: bullet === null ? 0 : parseFloat(bullet.width),
        bulletClip: bullet?.clipPath ?? 'none',
        display: first === undefined ? '' : getComputedStyle(first).display,
        gaps,
        widest: Math.max(0, ...measure),
        limit,
        height: Math.min(...links.map((a) => a.getBoundingClientRect().height)),
      };
    });
    expect(report.links, 'links in the panel').toBeGreaterThanOrEqual(4);
    expect(report.display).toBe('grid');
    expect(report.bulletClip, 'the bullet is a hexagon').toContain('polygon');
    expect(report.bulletWidth, 'the bullet is 12px').toBeCloseTo(12, 0);
    expect(report.gaps.length, 'links that have a description and a successor').toBeGreaterThan(0);
    for (const gap of report.gaps) expect(gap.inner, 'label to its own description').toBeLessThan(gap.outer);
    expect(report.widest, 'descriptions wrap at 38ch').toBeLessThanOrEqual(report.limit + 1);
    expect(report.height, 'every link is at least a 44px target').toBeGreaterThanOrEqual(43.5);
  });

  test('the panel has one amber mark: the featured card edge, not the headings or the top rule', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.locator('[data-mega-trigger]').first().click();
    const panel = page.locator('[data-mega-panel]:popover-open');
    await expect(panel).toBeVisible();
    const colours = await panel.evaluate((el) => {
      const amber = getComputedStyle(document.documentElement).getPropertyValue('--color-highlight').trim();
      const probe = document.createElement('span');
      probe.style.color = amber;
      document.body.append(probe);
      const resolved = getComputedStyle(probe).color;
      probe.remove();
      const featured = el.querySelector('.mega-panel__featured');
      const heading = el.querySelector('.mega-panel__heading');
      return {
        amber: resolved,
        top: getComputedStyle(el).borderTopColor,
        featured: featured === null ? '' : getComputedStyle(featured).borderInlineStartColor,
        headingMark: heading === null ? '' : getComputedStyle(heading, '::after').content,
      };
    });
    expect(colours.featured, 'the featured card edge is the amber mark').toBe(colours.amber);
    expect(colours.top, 'the panel rule is not amber').not.toBe(colours.amber);
    expect(colours.headingMark, 'column headings carry no amber segment').toBe('none');
  });

  test('moving from one trigger to the next leaves exactly one panel open, the one the pointer is on', async ({ page }) => {
    await page.goto('/');
    const triggers = page.locator('[data-mega-trigger]');
    test.skip((await triggers.count()) < 2, 'needs two panel triggers');
    await triggers.nth(0).hover();
    await expect(page.locator('[data-mega-panel]:popover-open')).toHaveCount(1, { timeout: 2000 });
    await triggers.nth(1).hover();
    const second = await triggers.nth(1).getAttribute('popovertarget');
    await expect(page.locator(`#${second}:popover-open`)).toBeVisible({ timeout: 2000 });
    // Past the 250ms leave delay of the first trigger: its timer must not touch the panel that is now open.
    await page.waitForTimeout(600);
    await expect(page.locator('[data-mega-panel]:popover-open')).toHaveCount(1);
    await expect(page.locator(`#${second}:popover-open`)).toBeVisible();
  });

  test('the disclosure buttons do not claim to open a menu', async ({ page }) => {
    await page.goto('/');
    expect(await page.locator('[data-mega-trigger][aria-haspopup]').count()).toBe(0);
    expect(await page.locator('.mobile-nav__toggle[aria-haspopup]').count()).toBe(0);
  });
});

test.describe('the mobile drawer keeps keyboard focus', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(!isMobile, 'mobile only');
  });

  const insideDrawer = (): boolean => document.querySelector('[data-mobile-drawer]')?.contains(document.activeElement) ?? false;

  test('Tab and Shift+Tab wrap inside the open drawer and Escape returns focus to Menu', async ({ page }) => {
    await page.goto('/');
    const menu = page.getByRole('button', { name: 'Menu' });
    await menu.focus();
    await page.keyboard.press('Enter');
    const drawer = page.locator('[data-mobile-drawer]');
    await expect(drawer).toBeVisible();
    await expect.poll(() => page.evaluate(insideDrawer), { message: 'focus moves into the drawer when it opens' }).toBe(true);

    const stops = await page.evaluate(() => {
      const root = document.querySelector('[data-mobile-drawer]');
      if (root === null) return 0;
      const reachable = (el: HTMLElement): boolean => {
        const closed = el.closest('details:not([open])');
        return el.checkVisibility() && (closed === null || (el.tagName === 'SUMMARY' && el.parentElement === closed));
      };
      return [...root.querySelectorAll<HTMLElement>('a[href], button, summary')].filter(reachable).length;
    });
    expect(stops, 'tab stops in the drawer').toBeGreaterThanOrEqual(5);

    const seen = new Set<string>();
    for (let i = 0; i < stops + 3; i += 1) {
      await page.keyboard.press('Tab');
      const state = await page.evaluate(() => ({ inside: document.querySelector('[data-mobile-drawer]')?.contains(document.activeElement) ?? false, label: (document.activeElement?.textContent ?? '').trim().slice(0, 30) }));
      expect(state.inside, `Tab ${i + 1} stays inside the drawer (on "${state.label}")`).toBe(true);
      seen.add(state.label);
    }
    expect(seen.size, 'Tab visits more than one stop and wraps around').toBeGreaterThan(3);

    // Backwards from the first stop goes to the last, not out to the Menu button or the page.
    await page.evaluate(() => {
      const first = document.querySelector<HTMLElement>('[data-mobile-drawer] button, [data-mobile-drawer] a, [data-mobile-drawer] summary');
      first?.focus();
    });
    for (let i = 0; i < stops + 3; i += 1) {
      await page.keyboard.press('Shift+Tab');
      const inside = await page.evaluate(() => document.querySelector('[data-mobile-drawer]')?.contains(document.activeElement) ?? false);
      expect(inside, `Shift+Tab ${i + 1} stays inside the drawer`).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(menu).toBeFocused();
  });

  test('keyboard focus that lands outside the open drawer is sent back in', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Menu' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-mobile-drawer]')).toBeVisible();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Shift+Tab');
    await page.evaluate(() => document.querySelector<HTMLElement>('.site-header__logo')?.focus());
    await expect.poll(() => page.evaluate(insideDrawer)).toBe(true);
  });
});

test.describe('the fixed Apply bar', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(!isMobile, 'phone widths only');
  });

  test('--apply-bar-h is the real height of the bar and the page scrolls clear of it', async ({ page }) => {
    await page.goto('/');
    const m = await page.evaluate(() => {
      const bar = document.querySelector('.mobile-apply');
      const probe = document.createElement('div');
      probe.style.cssText = 'position:absolute;visibility:hidden;block-size:var(--apply-bar-h)';
      document.body.append(probe);
      const token = probe.getBoundingClientRect().height;
      probe.remove();
      return {
        bar: bar === null ? 0 : bar.getBoundingClientRect().height,
        token,
        padding: parseFloat(getComputedStyle(document.documentElement).scrollPaddingBottom),
        footer: parseFloat(getComputedStyle(document.querySelector('.site-footer') ?? document.body).paddingBottom),
      };
    });
    expect(m.bar, 'the bar is rendered').toBeGreaterThan(0);
    expect(Math.abs(m.bar - m.token), 'the bar is exactly --apply-bar-h tall').toBeLessThanOrEqual(1);
    expect(m.padding, 'scroll-padding-bottom clears the bar').toBeGreaterThanOrEqual(m.token);
    expect(m.footer, 'the footer ends above the bar').toBeGreaterThanOrEqual(m.token);
  });

  for (const route of ['/apply/', '/contact/']) {
    test(`${route} does not render the bar and does not reserve space for it`, async ({ page }) => {
      test.skip(!isBuilt(route), `${route} is not built`);
      await page.goto(route);
      expect(await page.locator('.mobile-apply').count()).toBe(0);
      const padding = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).scrollPaddingBottom) || 0);
      expect(padding, 'no scroll padding for a bar that is not there').toBe(0);
    });
  }

  test('no tab stop on a long page is hidden behind the bar', async ({ page }) => {
    const route = '/library/seed-data-room-checklist/';
    test.skip(!isBuilt(route), `${route} is not built`);
    test.setTimeout(120_000);
    await page.goto(route);
    const hidden: string[] = [];
    let visited = 0;
    for (let i = 0; i < 90; i += 1) {
      await page.keyboard.press('Tab');
      const state = await page.evaluate(() => {
        const el = document.activeElement;
        const bar = document.querySelector('.mobile-apply');
        if (el === null || el === document.body || bar === null) return null;
        if (bar.contains(el)) return { inBar: true, bottom: 0, barTop: 0, name: '' };
        const r = el.getBoundingClientRect();
        return { inBar: false, bottom: r.bottom, barTop: bar.getBoundingClientRect().top, name: `${el.tagName.toLowerCase()} ${(el.textContent ?? '').trim().slice(0, 30)}` };
      });
      if (state === null) continue;
      if (state.inBar) break;
      visited += 1;
      if (state.bottom > state.barTop + 0.5) hidden.push(`${state.name} ends at ${Math.round(state.bottom)} under the bar at ${Math.round(state.barTop)}`);
    }
    expect(visited, 'tab stops visited').toBeGreaterThan(20);
    expect(hidden).toEqual([]);
  });
});
