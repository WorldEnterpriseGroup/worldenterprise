import { site, pageTitle } from '../data/site.ts';
import { readFlag } from './env.ts';
import { buildAbsolute } from './url-core.ts';

/**
 * SEO helpers (SAGE-PLAN 6.9). Titles are "{Page} | World Enterprise Incubator" and stay within 60 characters;
 * descriptions stay within 160. Canonicals are always absolute production URLs, even on preview builds.
 */
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 160;

export type RobotsDirective = 'index,follow' | 'noindex,follow' | 'noindex,nofollow';

export function buildTitle(page?: string): string {
  return pageTitle(page);
}

export function canonicalUrl(path: string): string {
  return buildAbsolute(path, site.origin);
}

/** Trims a description to the 160 character limit at a word boundary, adding an ellipsis only when it cuts. */
export function clampDescription(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= DESCRIPTION_MAX) return clean;
  const cut = clean.slice(0, DESCRIPTION_MAX - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 80 ? lastSpace : cut.length).replace(/[,;:.\s]+$/, '')}\u2026`;
}

export interface RobotsInput {
  readonly noindex?: boolean;
  readonly follow?: boolean;
  readonly draft?: boolean;
}

/** Preview builds and drafts are never indexed. Routes marked noindex in the ledger keep link following. */
export function resolveRobots({ noindex = false, follow = true, draft = false }: RobotsInput): RobotsDirective {
  if (readFlag('PUBLIC_PREVIEW') || draft) return 'noindex,nofollow';
  if (noindex) return follow ? 'noindex,follow' : 'noindex,nofollow';
  return 'index,follow';
}
