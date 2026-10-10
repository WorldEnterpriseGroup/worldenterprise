import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { findOverflow } from '../../support/overflow.ts';
import { AXE_TAGS, watch } from '../../support/page-guards.ts';
import { isBuilt } from '../../support/routes.ts';

// WP-42: the four package cards, the seat explainer and the stage picker on /pricing/. The specs set their own viewport, so they do not
// depend on a project. Each skips while the route is not built.

const ROUTE = '/pricing/';
const PACKAGES = [
  { id: 'spark', name: 'Spark', stageKey: 'idea-or-prototype' },
  { id: 'launch', name: 'Launch', stageKey: 'first-product' },
  { id: 'accelerate', name: 'Accelerate', stageKey: 'early-customer-evidence' },
  { id: 'studio', name: 'Studio', stageKey: 'several-products-or-regulated' },
] as const;
const CURRENCY = /[$€£]\s?\d|\b\d[\d,.]*\s?(?:USD|EUR|GBP)\b/;
const SEAT_COUNT = /\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:dedicated\s+|team\s+)?seats?\b/i;

const VIEWPORTS = [
  { label: '1440', viewport: { width: 1440, height: 900 } },
  { label: '390', viewport: { width: 390, height: 844 } },
] as const;

for (const { label, viewport } of VIEWPORTS) {
  test.describe(`pricing packages at ${label}`, () => {
    test.use({ viewport });
    test.beforeEach(() => {
      test.skip(!isBuilt(ROUTE), `${ROUTE} is not built`);
    });

    test('four package cards, each sized for a stage, with no amount and no seat count', async ({ page, baseURL }) => {
      const seen = watch(page, baseURL ?? '');
      await page.goto(ROUTE);
      const cards = page.locator('#packages [data-package]');
      await expect(cards).toHaveCount(4);
      for (const pkg of PACKAGES) {
        const card = page.locator(`#package-${pkg.id}`);
        await expect(card.getByRole('heading', { level: 3, name: pkg.name })).toBeVisible();
        await expect(card).toContainText('Depth in every service line');
        await expect(card.getByRole('link', { name: new RegExp(`Start with this package.*${pkg.name}`) })).toHaveAttribute('href', new RegExp(`/apply/\\?package=${pkg.id}$`));
        await expect(card.getByRole('link', { name: new RegExp(`Sketch the team.*${pkg.name}`) })).toHaveAttribute('href', new RegExp(`/tools/team-composer/\\?package=${pkg.id}$`));
      }
      const text = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
      expect(text).not.toMatch(CURRENCY);
      expect(text).not.toMatch(SEAT_COUNT);
      expect(seen.consoleErrors).toEqual([]);
      expect(seen.pageErrors).toEqual([]);
      expect(seen.thirdParty).toEqual([]);
    });

    test('the hero primary action jumps to the packages and a primary action is above the fold', async ({ page }) => {
      await page.goto(ROUTE);
      const jump = page.getByRole('link', { name: 'Compare the four packages' }).first();
      await expect(jump).toBeInViewport();
      await expect(jump).toHaveAttribute('href', '#packages');
    });

    test('the page order is cards, seats, picker, drivers, not-published, questions', async ({ page }) => {
      await page.goto(ROUTE);
      const ids = ['#packages', '#seats', '#picker-title', '#not-published'];
      const tops: number[] = [];
      for (const id of ids) {
        const box = await page.locator(id).first().boundingBox();
        expect(box, `${id} is on the page`).not.toBeNull();
        tops.push((box?.y ?? 0) + (await page.evaluate(() => window.scrollY)));
      }
      expect([...tops].sort((a, b) => a - b)).toEqual(tops);
    });

    test('the picker announces the package for a stage and marks its card', async ({ page }) => {
      await page.goto(ROUTE);
      const picker = page.locator('we-package-picker');
      await expect(picker).toHaveAttribute('data-enhanced', '');
      const status = picker.locator('[data-status]');
      await expect(status).toHaveAttribute('role', 'status');
      await expect(status).toBeEmpty();
      for (const pkg of PACKAGES) {
        await picker.locator(`input[name="stage"][value="${pkg.stageKey}"]`).check();
        await expect(status).toContainText(`${pkg.name} is sized for this stage`);
        await expect(page.locator(`#package-${pkg.id}`)).toHaveAttribute('data-suggested', '');
        await expect(page.locator('#packages [data-suggested]')).toHaveCount(1);
        await expect(page.locator(`#package-${pkg.id} .pkg__flag`)).toBeVisible();
        await expect(picker.getByRole('link', { name: `Start with ${pkg.name}` })).toHaveAttribute('href', new RegExp(`/apply/\\?package=${pkg.id}$`));
        await expect(picker.getByRole('link', { name: 'Sketch the team' })).toHaveAttribute('href', new RegExp(`/tools/team-composer/\\?package=${pkg.id}$`));
      }
    });

    test('the picker is keyboard operable', async ({ page }) => {
      await page.goto(ROUTE);
      const picker = page.locator('we-package-picker');
      const first = picker.locator('input[name="stage"]').first();
      await first.focus();
      await page.keyboard.press('ArrowDown');
      await expect(picker.locator('[data-status]')).toContainText('is sized for this stage');
      await expect(first).not.toBeChecked();
    });

    test('every control in the cards and the picker is at least 24px square, and nothing overflows', async ({ page }) => {
      await page.goto(ROUTE);
      const small: string[] = [];
      const controls = page.locator('#packages :is(a, button), we-package-picker :is(a, button, input, label)');
      const count = await controls.count();
      for (let i = 0; i < count; i += 1) {
        const control = controls.nth(i);
        if (!(await control.isVisible())) continue;
        const box = await control.boundingBox();
        if (box !== null && (box.width < 24 || box.height < 24)) small.push(`${await control.evaluate((el) => el.outerHTML.slice(0, 80))} ${Math.round(box.width)}x${Math.round(box.height)}`);
      }
      expect(small).toEqual([]);
      expect(await findOverflow(page)).toEqual([]);
    });

    test('axe finds nothing at WCAG 2.2 AA, before and after a stage is chosen', async ({ page }) => {
      await page.goto(ROUTE);
      await page.waitForLoadState('networkidle');
      const summarise = (v: readonly { id: string; nodes: readonly { target: readonly unknown[] }[] }[]): string[] => v.map((x) => `${x.id}: ${x.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
      expect(summarise((await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()).violations)).toEqual([]);
      await page.locator('we-package-picker input[name="stage"]').nth(1).check();
      await page.emulateMedia({ reducedMotion: 'reduce' });
      expect(summarise((await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()).violations)).toEqual([]);
    });

    test('choosing a stage shifts no layout', async ({ page }) => {
      await page.goto(ROUTE);
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => {
        const shifts: number[] = [];
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
            if (!shift.hadRecentInput) shifts.push(shift.value);
          }
        }).observe({ type: 'layout-shift', buffered: false });
        (window as unknown as { __shifts: number[] }).__shifts = shifts;
      });
      await page.locator('we-package-picker input[name="stage"]').nth(2).check();
      await page.waitForTimeout(400);
      const total = await page.evaluate(() => (window as unknown as { __shifts: number[] }).__shifts.reduce((sum, v) => sum + v, 0));
      expect(total).toBeLessThan(0.1);
    });
  });
}

test.describe('pricing packages without JavaScript', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
  test.beforeEach(() => {
    test.skip(!isBuilt(ROUTE), `${ROUTE} is not built`);
  });

  test('the cards, their links and the stage list all work', async ({ page }) => {
    await page.goto(ROUTE);
    await expect(page.locator('#packages [data-package]')).toHaveCount(4);
    for (const pkg of PACKAGES) {
      await expect(page.locator(`#package-${pkg.id}`).getByRole('link', { name: /Sketch the team/ })).toHaveAttribute('href', new RegExp(`/tools/team-composer/\\?package=${pkg.id}$`));
    }
    const picker = page.locator('we-package-picker');
    await expect(picker.locator('.picker__fallback')).toBeVisible();
    await expect(picker.locator('.picker__live')).toBeHidden();
    await expect(picker.locator('[data-actions]')).toBeHidden();
  });

  test('a stage in the list links to its card, which shows the flag', async ({ page }) => {
    await page.goto(ROUTE);
    await page.locator('we-package-picker .picker__fallback').getByRole('link', { name: 'See the Launch package' }).click();
    await expect(page).toHaveURL(/#package-launch$/);
    await expect(page.locator('#package-launch .pkg__flag')).toBeVisible();
    await expect(page.locator('#package-spark .pkg__flag')).toBeHidden();
  });
});
