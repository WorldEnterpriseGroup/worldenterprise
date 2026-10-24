import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import { isDraftFile } from '../../../../src/data/cta/live.ts';
import { routes } from '../../../../src/data/routes.ts';
import type { InsightFile } from '../../../../src/lib/content-files.ts';
import { isBuilt } from '../../support/routes.ts';

/**
 * What the WP-62 specs may assume about a page being on disk, and nothing more. The pipeline builds the whole site, so a page that the
 * route ledger launches and that is not in `dist` is a defect, and the spec fails; a spec never skips and never filters a page away
 * because it is missing. A page may be absent only for a reason the data states: the ledger does not launch it (`launch: false`, or a
 * development route that is not in the ledger) or the article is a draft. Those absences are asserted, not tolerated.
 */

const ledger = new Map(routes.map((route) => [route.path, route]));

/** Whether the ledger launches the path. */
export function isLaunched(path: string): boolean {
  return ledger.get(path)?.launch === true;
}

/** Fails unless the page is built. */
export function requireBuilt(path: string): void {
  expect(isBuilt(path), `${path} must be built: the pipeline builds the whole site`).toBe(true);
}

/**
 * Whether the page is part of the site as built. A launched page must be built (a missing one fails here); a page the ledger does not
 * launch is part of the site only if it was built anyway.
 */
export function isOnSite(path: string): boolean {
  if (isLaunched(path)) {
    requireBuilt(path);
    return true;
  }
  return isBuilt(path);
}

/** The reason the data gives for a page that is not built, after asserting that the data does say so. Fails when the page is launched. */
export function assertNotLaunched(path: string): string {
  expect(isLaunched(path), `${path} is not built, and the route ledger launches it: a launched page must be built`).toBe(false);
  expect(isBuilt(path), `${path} is not launched, so it must not be built either`).toBe(false);
  return ledger.get(path) === undefined ? 'a development route that is not in the ledger' : 'the route ledger does not launch it';
}

/** Whether the article file is a draft, which the site does not build. */
export function isDraftArticle(file: InsightFile): boolean {
  return isDraftFile(readFileSync(join(process.cwd(), file.file), 'utf8'));
}

/** The built articles of a desk: every article that is not a draft must be built, and a draft must not be. */
export function builtArticles(files: readonly InsightFile[]): InsightFile[] {
  const built: InsightFile[] = [];
  for (const file of files) {
    const path = `/insights/${file.slug}/`;
    if (isDraftArticle(file)) {
      expect(isBuilt(path), `${path} is a draft, so it must not be built`).toBe(false);
      continue;
    }
    requireBuilt(path);
    built.push(file);
  }
  return built;
}
