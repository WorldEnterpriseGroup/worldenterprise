import type { CTA_VARIANTS } from '../../lib/content-schemas.ts';
import type { Audience } from '../families.ts';
import type { DeskId } from '../desks.ts';

/**
 * The CTA types (docs/wave8-contracts.md, section 6.1). Plain types with no runtime code, so the page components, the hast plugin and
 * `node --test` all import them without pulling in Astro.
 */

export type CtaVariant = (typeof CTA_VARIANTS)[number];
export type CtaPlacement = 'end' | 'mid' | 'aside';

/** `href` is a ledger path; a unit test holds every default target to a launched route. */
export interface CtaAction {
  readonly label: string;
  readonly href: string;
}

export interface CtaModel {
  /** Stable, for example 'brief:funding-paths'. A mid-body model carries the prefix 'mid:'. */
  readonly id: string;
  readonly audience: Audience;
  readonly variant: CtaVariant;
  /** Sentence case, at most 70 characters. */
  readonly heading: string;
  /** One or two sentences that pass the claims denylist. */
  readonly body: string;
  readonly primary: CtaAction;
  readonly secondary?: CtaAction;
  /** An honest qualifier, for example "WE makes no promise of funding." */
  readonly note?: string;
}

export type CtaCollection = 'pages' | 'insights' | 'guides' | 'playbooks' | 'services' | 'library' | 'research' | 'briefs' | 'faq' | 'glossary';

export interface ResolveInput {
  /** '/insights/some-article/' */
  readonly path: string;
  readonly collection: CtaCollection;
  /** Desk id for insights. */
  readonly topic?: string;
  readonly frontmatterCta?: { readonly variant: CtaVariant; readonly briefId?: string };
}

/** Whether a ledger path is a route this build emits. A dead target is dropped, never rendered. */
export type IsLive = (path: string) => boolean;

/**
 * What a surface can point at. A target is a key into the table of `targets.ts`: a fixed destination, a brief by id, or a plain ledger
 * path that only ever serves as a secondary link.
 */
export type TargetKey =
  | 'apply'
  | 'briefs'
  | 'journey'
  | 'contact'
  | 'tools'
  | 'investor-interest'
  | 'partner-enquiry'
  | `brief:${string}`
  | `path:${string}`;

export interface SurfaceMatch {
  /** The exact path. */
  readonly path?: string;
  /** Every path that starts with this. */
  readonly prefix?: string;
  readonly collection?: CtaCollection;
  /** Insights desks. */
  readonly desks?: readonly DeskId[];
}

/** One row of the default map (contracts section 6.2). The first row that matches a document decides its band. */
export interface SurfaceRule {
  readonly id: string;
  readonly audience: Audience;
  readonly match: SurfaceMatch;
  /** Candidates in order; the first with a live target is the primary. Empty: no band on this surface. */
  readonly primary: readonly TargetKey[];
  /** Candidates in order; the first live one that is not the primary is the secondary. */
  readonly secondary: readonly TargetKey[];
  /** The target of the mid-body band for documents of 900 words or more. Absent: no mid band. */
  readonly mid?: TargetKey;
  /** Which slot the frontmatter `cta` override fills. Default 'primary'; the founder segment pages use 'secondary'. */
  readonly frontmatter?: 'primary' | 'secondary';
}
