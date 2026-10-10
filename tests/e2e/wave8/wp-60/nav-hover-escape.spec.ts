import { expect, type Locator, test } from '@playwright/test';
import { isBuilt } from '../../support/routes.ts';

// The mega menu arms a 150 ms hover-intent timer on pointerenter (src/scripts/nav.ts). A timer still pending when the user opens and then
// closes the panel used to fire afterwards and reopen it (e2e:wave7 nav-identity, three attempts of three on pipeline 65931). A fake clock
// makes the order deterministic: the timer is armed, the panel is opened and closed, and only then does time pass.

test.beforeEach(({ isMobile }) => {
  test.skip(isMobile, 'hover intent is for fine pointers');
  test.skip(!isBuilt('/'), 'home is not built');
});

const isOpen = (panel: Locator): Promise<boolean> => panel.evaluate((el) => el.matches(':popover-open'));

test.describe('hover-intent timer and a panel the user closed', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install();
    await page.goto('/');
    // Pause so no timer fires unless the test runs the clock.
    await page.clock.pauseAt(Date.now() + 1000);
  });

  test('click opens, Escape closes inside the hover delay, and the panel stays closed', async ({ page }) => {
    const trigger = page.locator('[data-mega-trigger]').first();
    const panel = page.locator(`#${await trigger.getAttribute('popovertarget')}`);
    await trigger.hover();
    await trigger.click();
    expect(await isOpen(panel), 'the click opened the panel').toBe(true);
    await page.keyboard.press('Escape');
    expect(await isOpen(panel), 'Escape closed it').toBe(false);
    await page.clock.runFor(400);
    expect(await isOpen(panel), 'the pending hover timer did not reopen it').toBe(false);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  test('Escape with nothing open cancels the pending hover timer', async ({ page }) => {
    const trigger = page.locator('[data-mega-trigger]').first();
    const panel = page.locator(`#${await trigger.getAttribute('popovertarget')}`);
    await trigger.hover();
    await page.keyboard.press('Escape');
    await page.clock.runFor(400);
    expect(await isOpen(panel), 'a dismissed hover does not open the panel').toBe(false);
  });

  test('a fresh pointerenter still opens the panel after the delay', async ({ page }) => {
    const trigger = page.locator('[data-mega-trigger]').first();
    const panel = page.locator(`#${await trigger.getAttribute('popovertarget')}`);
    await trigger.hover();
    await trigger.click();
    await page.keyboard.press('Escape');
    await page.mouse.move(2, 2);
    await page.clock.runFor(400);
    expect(await isOpen(panel), 'still closed while the pointer is away').toBe(false);
    await trigger.hover();
    await page.clock.runFor(100);
    expect(await isOpen(panel), 'not before the 150 ms hover delay').toBe(false);
    await page.clock.runFor(100);
    expect(await isOpen(panel), 'open after it').toBe(true);
  });
});
