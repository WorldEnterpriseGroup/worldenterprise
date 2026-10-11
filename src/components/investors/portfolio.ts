/**
 * The consent gate of the portfolio showcase (D-12 as amended by D-21; W8-17; docs/wave8-contracts.md, section 7).
 *
 * A company is shown only when its entry carries `consent: true` and a consent record whose scope names the company, and each optional field
 * is shown only when the scope names the permission that covers it: `description` covers the one line and the stage, `website` covers the
 * link. A scope that lacks `name` lists nothing, because a card without a name has nothing to show. Pure functions with no Astro imports, so
 * node --test can run them over fixtures.
 */
import { STAGE_LABELS } from './copy.ts';

export type ConsentScope = 'name' | 'description' | 'website' | 'investor-introductions';
export type PortfolioStage = keyof typeof STAGE_LABELS;

/** The part of a portfolio entry the gate reads. It is the shape of `schemas.portfolio` without the fields the page never shows. */
export interface PortfolioData {
  readonly company: string;
  readonly website?: string | undefined;
  readonly oneLine?: string | undefined;
  readonly stage?: PortfolioStage | undefined;
  readonly consent: boolean;
  readonly consentRecord: { readonly scope: readonly ConsentScope[] };
  readonly draft?: boolean | undefined;
}

/** What a company card may show: only fields the founder agreed to. */
export interface ShowcaseCard {
  readonly name: string;
  readonly oneLine?: string;
  readonly stage?: string;
  readonly website?: string;
}

/** A link target a founder supplied. Only an http or https address becomes a link; any other scheme is dropped. */
export function safeWebsite(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** The card for one entry, or null when the entry may not be shown at all. */
export function showcaseCard(data: PortfolioData): ShowcaseCard | null {
  if (data.draft === true || data.consent !== true) return null;
  const scope = new Set(data.consentRecord.scope);
  if (!scope.has('name') || data.company.trim() === '') return null;
  const card: { name: string; oneLine?: string; stage?: string; website?: string } = { name: data.company };
  if (scope.has('description')) {
    if (data.oneLine !== undefined && data.oneLine.trim() !== '') card.oneLine = data.oneLine;
    if (data.stage !== undefined) card.stage = STAGE_LABELS[data.stage];
  }
  if (scope.has('website')) {
    const website = safeWebsite(data.website);
    if (website !== undefined) card.website = website;
  }
  return card;
}

/** The cards of every entry that may be shown, in the order given. An empty list means the page shows its one fixed sentence. */
export function showcaseCards(entries: readonly PortfolioData[]): ShowcaseCard[] {
  const cards: ShowcaseCard[] = [];
  for (const entry of entries) {
    const card = showcaseCard(entry);
    if (card !== null) cards.push(card);
  }
  return cards;
}
