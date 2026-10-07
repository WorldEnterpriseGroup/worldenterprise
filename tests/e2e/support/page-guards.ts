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
