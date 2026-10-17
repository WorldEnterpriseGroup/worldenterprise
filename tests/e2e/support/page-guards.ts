import type { Page } from '@playwright/test';
import { isFirstParty } from './routes.ts';

export interface Watch {
  readonly consoleErrors: string[];
  readonly pageErrors: string[];
  readonly thirdParty: string[];
}

/** Records console errors, uncaught exceptions and requests that leave the site origin. Attach before navigating. */
export function watch(page: Page, baseURL: string, allowedOrigins: readonly string[] = []): Watch {
  const record: Watch = { consoleErrors: [], pageErrors: [], thirdParty: [] };
  page.on('console', (message) => {
    if (message.type() === 'error') record.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => record.pageErrors.push(error.message));
  page.on('request', (request) => {
    const url = request.url();
    if (!isFirstParty(url, baseURL) && !allowedOrigins.includes(new URL(url).origin)) record.thirdParty.push(url);
  });
  return record;
}

export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

export interface Quiet {
  /** Resolves after the load event once no request has been open for `quietMs`; rejects with the open URLs after `timeoutMs`. */
  settled(quietMs?: number, timeoutMs?: number): Promise<void>;
}

/**
 * Counts open requests from the test side. Attach before navigating.
 * Replaces page.waitForLoadState('networkidle'): on a page whose HTML takes longer than 500 ms to parse (/insights/ in CI),
 * Playwright can raise networkidle before domcontentloaded, clear it on the next subresource and never raise it again,
 * so the wait hangs to the test timeout with nothing in flight.
 */
export function quiet(page: Page): Quiet {
  const open = new Set<string>();
  let lastActivity = Date.now();
  let next = 0;
  const ids = new WeakMap<object, string>();
  page.on('request', (request) => {
    const id = `${next++} ${request.url()}`;
    ids.set(request, id);
    open.add(id);
    lastActivity = Date.now();
  });
  const close = (request: object): void => {
    const id = ids.get(request);
    if (id !== undefined) open.delete(id);
    lastActivity = Date.now();
  };
  page.on('requestfinished', close);
  page.on('requestfailed', close);
  return {
    async settled(quietMs = 500, timeoutMs = 15_000): Promise<void> {
      await page.waitForLoadState('load');
      const start = Date.now();
      while (open.size > 0 || Date.now() - lastActivity < quietMs) {
        if (Date.now() - start > timeoutMs) {
          throw new Error(`network not quiet after ${timeoutMs} ms; open: ${[...open].slice(0, 5).join(', ') || 'none'}`);
        }
        await page.waitForTimeout(100);
      }
    },
  };
}
