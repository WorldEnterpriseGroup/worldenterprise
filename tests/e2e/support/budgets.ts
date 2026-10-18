import AxeBuilder from '@axe-core/playwright';
import { test, type Page } from '@playwright/test';
import { AXE_TAGS } from './page-guards.ts';

// Test budgets that match the work. playwright.config.ts keeps the flat 45 s default (CI job pods request 100m CPU, issue #110, so a
// heavy page runs several times slower than on a laptop); a test whose cost grows with the page or with a list it walks asks for more
// time here, in proportion, instead of raising the default for everyone or retrying.

export const BASE_BUDGET_MS = 45_000;
export const MAX_BUDGET_MS = 180_000;
const AXE_MS_PER_1000_ELEMENTS = 10_000;

/** The test budget for a full-page axe scan: 45 s plus 10 s per 1,000 elements (rounded up), capped at 3 minutes. Pure, so a unit test can pin it. */
export function axeBudgetMs(elements: number): number {
  return Math.min(BASE_BUDGET_MS + Math.ceil(elements / 1_000) * AXE_MS_PER_1000_ELEMENTS, MAX_BUDGET_MS);
}

/** The test budget for a test that walks `items` rows, panels or pages, spending about `perItemMs` on each: 45 s plus the walk, capped at 3 minutes. */
export function walkBudgetMs(items: number, perItemMs: number): number {
  return Math.min(BASE_BUDGET_MS + Math.max(0, items) * perItemMs, MAX_BUDGET_MS);
}

/** Raises the running test's budget to at least `ms`. It never lowers a budget the test already set for itself. */
export function ensureBudget(ms: number): void {
  test.setTimeout(Math.max(test.info().timeout, ms));
}

/** Sizes the budget for walking `items` things at about `perItemMs` each. Call it once the count is known, before the loop. */
export function budgetForItems(items: number, perItemMs: number): void {
  ensureBudget(walkBudgetMs(items, perItemMs));
}

export interface AnalyzeOptions {
  /** Scope the scan to a selector, as AxeBuilder.include does. The budget still follows the whole page, which is the safe side. */
  readonly include?: string;
  /** Axe tags. Defaults to AXE_TAGS (WCAG 2.2 AA). */
  readonly tags?: readonly string[];
}

/**
 * The one way a spec runs axe on a page. axe walks every element, so its cost grows with the page: the glossary and the insights hub
 * (about 120 entries each) took 49 to 53 s on a loaded runner and failed all three attempts at the 45 s default (pipeline 71653, job
 * 1192229). This counts the elements, sets the budget with axeBudgetMs, then runs AxeBuilder, so a big page gets time in proportion and
 * a hung scan still fails. Navigate and settle the page first.
 */
export async function analyzePage(page: Page, options: AnalyzeOptions = {}): ReturnType<AxeBuilder['analyze']> {
  const elements = await page.locator('*').count();
  ensureBudget(axeBudgetMs(elements));
  const builder = new AxeBuilder({ page }).withTags([...(options.tags ?? AXE_TAGS)]);
  if (options.include !== undefined) builder.include(options.include);
  return builder.analyze();
}
