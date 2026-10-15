import { expect } from '@playwright/test';
import type { Locator, Page, TestInfo } from '@playwright/test';

// Shared by the WP-52 styleguide specs: visuals.spec.ts (posters, markup, review shots) and visuals-live.spec.ts (live WebGL scenes).

export const ROUTE = '/styleguide/';

export const isDesktop = (info: TestInfo): boolean => info.project.name.includes('desktop');

/** The runner may report fewer than four cores, which the gate refuses; the gate itself is unit-tested. */
export async function presentFourCores(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', {
      get: () => 8,
      configurable: true,
    });
  });
}

/** Cumulative layout shift observed on the page so far (buffered entries, ignoring shifts right after input). */
export async function cls(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let total = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as (PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
          })[]) {
            if (!entry.hadRecentInput) total += entry.value;
          }
        });
        observer.observe({ type: 'layout-shift', buffered: true });
        window.setTimeout(() => {
          observer.disconnect();
          resolve(total);
        }, 300);
      }),
  );
}

/** Whether this browser can create a WebGL2 context at all (the gate's last check). */
export async function hasWebGL2(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    try {
      const gl = document.createElement('canvas').getContext('webgl2');
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
      return gl !== null;
    } catch (error) {
      console.info('webgl2 probe threw', error);
      return false;
    }
  });
}

/**
 * Waits for a scene to go live when the runner has WebGL2; otherwise (or when the runtime falls back) asserts the poster stays. Returns
 * whether the scene went live; callers pause a live scene when done, so software rendering does not load the runner afterwards.
 */
export async function liveOrPoster(page: Page, scene: Locator, info: TestInfo): Promise<boolean> {
  const poster = scene.locator('img.scene__poster');
  if (!(await hasWebGL2(page))) {
    info.annotations.push({
      type: 'no-webgl2',
      description: 'the runner has no WebGL2: the poster fallback is checked instead',
    });
    await page.waitForTimeout(1500);
    await expect(scene.locator('canvas.scene__canvas'), 'no canvas without WebGL2').toHaveCount(0);
    await expect(poster, 'the poster stays visible without WebGL2').toBeVisible();
    return false;
  }
  await expect(scene, 'the scene leaves the poster state (gate passed, loading or live)').toHaveAttribute(
    'data-state',
    /^(?:loading|live|fallback)$/,
    {
      timeout: 20_000,
    },
  );
  await expect(scene, 'the scene settles live or falls back to its poster').toHaveAttribute('data-state', /^(?:live|fallback)$/, {
    timeout: 25_000,
  });
  if ((await scene.getAttribute('data-state')) === 'fallback') {
    info.annotations.push({
      type: 'scene-fallback',
      description: 'the runtime fell back to the poster on this runner',
    });
    await expect(poster, 'the poster stays visible after a fallback').toBeVisible();
    return false;
  }
  return true;
}
