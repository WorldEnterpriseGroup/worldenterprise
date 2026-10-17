import { z } from 'astro/zod';
import { CLAIM_IDS, isClaimUsable } from '../data/claims.ts';
import type { ClaimId } from '../data/claims.ts';
import { AUDIENCES, BRIEF_IDS, SEGMENT_SLUGS, COMPARISONS, INDUSTRIES, JOURNEY, SEGMENTS } from '../data/families.ts';
import { DESK_ENUM } from '../data/desks.ts';
import { site } from '../data/site.ts';
import { TITLE_MAX } from './seo.ts';

/**
 * The zod schema of every content collection (SAGE-PLAN 6.4; docs/wave8-contracts.md sections 2, 5.2, 7, 8). They live here, not in
 * `src/content.config.ts`, because that file imports `astro:content`, which plain Node cannot load: this module can, so the unit
 * tests parse real and fabricated frontmatter against the same objects the build uses. `content.config.ts` only adds the loaders.
 * Every object is strict: unknown frontmatter keys fail the build. `draft: true` entries (fixtures and unfinished work) are
 * excluded from nav, sitemap and search, and fail PUBLIC_RELEASE builds.
 */

const claimId = z
  .enum(CLAIM_IDS)
  .refine((id) => isClaimUsable(id as ClaimId), { message: 'Claim is excluded or switched off; content may not cite it.' });

const claimsUsed = z.array(claimId).default([]);
const draft = z.boolean().default(false);

/**
 * Optional short title for the document title and social cards, for headings that cannot fit in 60 characters once
 * " | World Enterprise" is added. The heading itself is never shortened.
 */
const seoTitle = z.string().min(1).max(TITLE_MAX - ` | ${site.titleSuffix}`.length).optional();
const serviceLine = z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G']);

export const sourceSchema = z.strictObject({
  id: z.string().min(1),
  title: z.string().min(1),
  publisher: z.string().min(1),
  url: z.url(),
  accessed: z.coerce.date().optional(),
});

/** The `pages` hero buttons (`ctas`). Not the CTA resolution override below. */
const heroCta = z.strictObject({
  label: z.string().min(1),
  href: z.string().startsWith('/'),
  variant: z.enum(['primary', 'secondary', 'quiet']).default('primary'),
});

/** CTA variants (contracts section 6.1). `src/data/cta/index.ts` derives its `CtaVariant` type from this tuple. */
export const CTA_VARIANTS = ['apply', 'brief', 'investor-interest', 'partner-enquiry', 'tools', 'contact'] as const;

/** Optional override of the CTA resolution for one document (contracts section 6.1). */
const ctaOverride = z
  .strictObject({
    variant: z.enum(CTA_VARIANTS),
    briefId: z.string().optional(),
  })
  .refine((c) => c.briefId === undefined || BRIEF_IDS.includes(c.briefId), { message: 'briefId is not a brief in the registry.', path: ['briefId'] })
  .refine((c) => c.variant === 'brief' || c.briefId === undefined, { message: 'briefId only goes with the brief variant.', path: ['briefId'] });

const audience = z.enum(AUDIENCES);
const deskId = z.enum(DESK_ENUM);

/** A ledger path in frontmatter. Liveness is checked where it renders (fail-closed), not here. */
const ledgerPath = z.string().regex(/^\/[a-z0-9\-/]*\/$|^\/$/, { message: 'A ledger path starts and ends with a slash.' });

// ---------------------------------------------------------------------------------------------------------------------------------
// Page families (contracts section 8.2)
// ---------------------------------------------------------------------------------------------------------------------------------

const familySource = z.strictObject({
  id: z.string().min(1),
  title: z.string().min(1),
  publisher: z.string().min(1),
  url: z.url(),
  accessed: z.coerce.date(),
});

const slugOf = (entries: readonly { readonly slug: string }[]): readonly string[] => entries.map((e) => e.slug);
const slugIn = (allowed: readonly string[], what: string) =>
  z.string().refine((s) => allowed.includes(s), { message: `Not a slug in the ${what} registry (src/data/families.ts).` });

/** A `sourceId` anywhere in a family object must name an `id` in `family.sources`. */
function checkSourceIds(
  ctx: z.RefinementCtx,
  sources: readonly { readonly id: string }[],
  refs: readonly { readonly sourceId: string; readonly path: (string | number)[] }[],
): void {
  const known = new Set(sources.map((s) => s.id));
  if (known.size !== sources.length) ctx.addIssue({ code: 'custom', message: 'family.sources ids must be unique.', path: ['sources'] });
  for (const ref of refs) {
    if (!known.has(ref.sourceId)) ctx.addIssue({ code: 'custom', message: `sourceId "${ref.sourceId}" is not in family.sources.`, path: ref.path });
  }
}

const segmentsFamily = z.strictObject({
  id: z.literal('segments'),
  slug: slugIn(slugOf(SEGMENTS.entries), 'segments'),
  whoFor: z.string().min(80).max(400),
  challenges: z
    .array(z.strictObject({ title: z.string().min(1).max(60), text: z.string().min(40).max(260) }))
    .min(3)
    .max(5),
  sources: z.array(familySource).default([]),
});

const industriesFamily = z
  .strictObject({
    id: z.literal('industries'),
    slug: slugIn(slugOf(INDUSTRIES.entries), 'industries'),
    buyer: z.string().min(40).max(500),
    perimeter: z
      .array(
        z.strictObject({
          title: z.string().min(1).max(80),
          text: z.string().min(40).max(400),
          jurisdiction: z.string().min(1),
          asOf: z.coerce.date(),
          sourceId: z.string().min(1),
        }),
      )
      .min(3)
      .max(6),
    dataQuestions: z.array(z.string().min(10)).min(3).max(6),
    salesCycle: z.string().min(40).max(600),
    sources: z.array(familySource).min(2),
  })
  .superRefine((f, ctx) => checkSourceIds(ctx, f.sources, f.perimeter.map((p, i) => ({ sourceId: p.sourceId, path: ['perimeter', i, 'sourceId'] }))));

const compareSide = z.strictObject({
  name: z.string().min(1).max(80),
  whatItIs: z.string().min(40).max(400),
  whoItFits: z.string().min(40).max(400),
  asksOfFounder: z.string().min(40).max(400),
  askThis: z.array(z.string().min(10)).min(2).max(5),
});

const compareFamily = z
  .strictObject({
    id: z.literal('compare'),
    slug: slugIn(slugOf(COMPARISONS.entries), 'compare'),
    sides: z.tuple([compareSide, compareSide]),
    whereEachFits: z.tuple([z.string().min(40).max(300), z.string().min(40).max(300)]),
    definitions: z.array(z.strictObject({ term: z.string().min(1), text: z.string().min(40).max(300), sourceId: z.string().min(1) })).min(2),
    sources: z.array(familySource).min(2),
  })
  .superRefine((f, ctx) => checkSourceIds(ctx, f.sources, f.definitions.map((d, i) => ({ sourceId: d.sourceId, path: ['definitions', i, 'sourceId'] }))));

const journeyFamily = z.strictObject({
  id: z.literal('journey'),
  // The hub is `index.mdx`.
  slug: slugIn(['index', ...slugOf(JOURNEY.entries)], 'journey'),
  stage: z.enum(['awareness', 'consideration', 'conversion', 'onboarding', 'advocacy']),
  step: z.number().int().min(1).max(5).optional(),
  questions: z.array(z.string().min(10)).default([]),
  checklist: z
    .array(z.strictObject({ id: z.string().min(1), text: z.string().min(10), href: ledgerPath.optional() }))
    .optional()
    .refine((items) => items === undefined || new Set(items.map((i) => i.id)).size === items.length, { message: 'Checklist ids must be unique.' }),
  sources: z.array(familySource).default([]),
});

export const familySchema = z.discriminatedUnion('id', [segmentsFamily, industriesFamily, compareFamily, journeyFamily]);

// ---------------------------------------------------------------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------------------------------------------------------------

export const pagesSchema = z.strictObject({
  title: z.string().min(1).max(70),
  seoTitle,
  description: z.string().min(50).max(160),
  eyebrow: z.string().optional(),
  hero: z.enum(['H1', 'H2', 'H3', 'H4', 'H5']).default('H2'),
  updated: z.coerce.date(),
  ctas: z.array(heroCta).default([]),
  cta: ctaOverride.optional(),
  family: familySchema.optional(),
  claimsUsed,
  faqRefs: z.array(z.string()).default([]),
  draft,
});

export const servicesSchema = z.strictObject({
  line: serviceLine,
  title: z.string().min(1),
  shortTitle: z.string().min(1),
  summary: z.string().min(20),
  covers: z.array(z.string().min(1)).min(1),
  doesNotCover: z.array(z.string().min(1)).min(1),
  /** What the founder receives from this line: one row per artifact. The layout renders it as "What you receive". */
  artifacts: z.array(z.strictObject({ name: z.string().min(1), purpose: z.string().min(1) })).default([]),
  icon: serviceLine,
  relatedPlaybooks: z.array(z.string()).default([]),
  faqRefs: z.array(z.string()).default([]),
  claimsUsed,
  updated: z.coerce.date(),
  draft,
});

export const playbooksSchema = z.strictObject({
  stage: z.enum(['dream', 'build', 'grow']),
  order: z.number().int().min(1),
  title: z.string().min(1),
  description: z.string().min(50).max(160),
  steps: z.array(z.strictObject({ title: z.string().min(1), body: z.string().min(1) })).min(1),
  artifacts: z.array(z.string()).default([]),
  relatedLibrary: z.array(z.string()).default([]),
  cta: ctaOverride.optional(),
  claimsUsed,
  updated: z.coerce.date(),
  draft,
});

export const guidesSchema = z
  .strictObject({
    section: z.enum(['fundability', 'trust']),
    title: z.string().min(1),
    description: z.string().min(50).max(160),
    disclaimers: z.array(z.enum(['no-funding', 'not-legal-advice', 'generic-definition'])).default([]),
    sources: z.array(sourceSchema).default([]),
    cta: ctaOverride.optional(),
    claimsUsed,
    updated: z.coerce.date(),
    draft,
  })
  .refine((g) => g.section !== 'fundability' || g.disclaimers.includes('no-funding'), {
    message: 'Fundability guides must carry the no-funding disclaimer (claim C-05).',
    path: ['disclaimers'],
  });

export const insightsSchema = z
  .strictObject({
    title: z.string().min(1),
    seoTitle,
    description: z.string().min(50).max(160),
    // The desk list is derived from src/data/desks.ts, the only place a desk is defined.
    topic: deskId,
    publishedDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    author: z.literal('World Enterprise Editorial').default('World Enterprise Editorial'),
    sources: z.array(sourceSchema).default([]),
    noStatistics: z.boolean().default(false),
    evidence: z.array(z.string()).default([]),
    relatedServices: z.array(serviceLine).default([]),
    relatedPlaybook: z.string().optional(),
    relatedTemplate: z.string().optional(),
    /** Founder segments the article speaks to (registry slugs); the segment pages list matching articles. */
    segments: z.array(slugIn(SEGMENT_SLUGS, 'segments')).default([]),
    /** Slugs of other articles. A slug that is not live is dropped at build (fail-closed, `pickRelatedArticles`). */
    related: z.array(z.string().min(1)).default([]),
    cta: ctaOverride.optional(),
    cover: z.string().optional(),
    claimsUsed,
    draft,
  })
  .refine((i) => i.noStatistics || i.sources.length >= 2, {
    message: 'An insight needs at least two sources, or noStatistics: true.',
    path: ['sources'],
  });

export const researchSchema = z.strictObject({
  title: z.string().min(1),
  subtitle: z.string().min(1),
  description: z.string().min(50).max(160),
  publishedDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  version: z.string().default('1.0'),
  methodology: z.string().min(40),
  limitations: z.string().min(40),
  sources: z.array(sourceSchema).min(5),
  appendix: z.string().optional(),
  cta: ctaOverride.optional(),
  claimsUsed,
  draft,
});

export const librarySchema = z.strictObject({
  title: z.string().min(1),
  description: z.string().min(50).max(160),
  kind: z.enum(['template', 'checklist', 'worksheet', 'guide']),
  instructions: z.string().min(20),
  markdownDownload: z.literal(true).default(true),
  cta: ctaOverride.optional(),
  claimsUsed,
  updated: z.coerce.date(),
  draft,
});

/** The open abstract of a gated brief (contracts section 5.2). The full text lives outside every path the build reads. */
export const briefsSchema = z.strictObject({
  title: z.string().min(1),
  subtitle: z.string().min(1),
  description: z.string().min(50).max(160),
  topics: z.array(deskId).min(1).max(2),
  audience: z.array(audience).min(1),
  outline: z.array(z.string().min(1)).min(1),
  updated: z.coerce.date(),
  claimsUsed,
  draft,
});

/** Group names of the glossary and the FAQ are free text, validated for presence only; the lists are fixed by their owners' tests. */
const referenceGroup = z.string().min(1);

export const faqSchema = z.strictObject({
  id: z.string(),
  question: z.string().min(1),
  answer: z.string().min(1),
  group: referenceGroup,
  /** Absent means general: the page renders it first, under "For everyone". */
  audience: audience.optional(),
  seeAlso: z.array(ledgerPath).default([]),
  claimsUsed,
  related: z.array(z.string()).default([]),
  draft,
});

/** The claims-denylist rules a glossary definition may be allowed past (contracts section 8.4); each use is recorded in the sources file. */
export const CLAIM_ALLOW_RULES = ['C-13-peers', 'C-14-success-based', 'W7-C09-no-equity'] as const;

export const glossarySchema = z.strictObject({
  id: z.string(),
  term: z.string().min(1),
  definition: z.string().min(1),
  group: referenceGroup,
  /** Wraps the definition in `data-generic-definition`: required for the SAFE-mechanics terms. */
  genericDefinition: z.boolean().default(false),
  /** Wraps the definition in `data-claim-allow` for each rule id. */
  claimAllow: z.array(z.enum(CLAIM_ALLOW_RULES)).default([]),
  seeAlso: z.array(ledgerPath).default([]),
  claimsUsed,
  related: z.array(z.string()).default([]),
  draft,
});

/** L2 collections: schema defined, collection empty. `source` is required so nothing can launch unsourced. */
const l2Source = z.string().min(1);

export const peopleSchema = z.strictObject({
  name: z.string().min(1),
  role: z.string().min(1),
  source: l2Source,
  consent: z.literal(true),
  draft,
});

export const eventsSchema = z.strictObject({
  title: z.string().min(1),
  start: z.coerce.date(),
  source: l2Source,
  draft,
});

/**
 * A company WE lists, only with the founder's written consent (D-12 as amended by D-21; contracts section 7). No metrics, logos,
 * founder names, valuations or amounts exist in the schema, so none can be added without a counsel-reviewed schema change.
 */
export const portfolioSchema = z.strictObject({
  company: z.string().min(1).max(120),
  website: z.url().optional(),
  oneLine: z.string().min(10).max(160).optional(),
  stage: z.enum(['idea', 'validating', 'building', 'launched']).optional(),
  /** A draft without consent cannot parse. */
  consent: z.literal(true),
  consentRecord: z.strictObject({
    recordedOn: z.coerce.date(),
    scope: z.array(z.enum(['name', 'description', 'website', 'investor-introductions'])).min(1),
    /** A pointer into the private consent register, never the document itself. */
    reference: z.string().min(1),
  }),
  source: z.strictObject({
    kind: z.enum(['founder-written', 'agreement', 'public-record']),
    reference: z.string().min(1),
  }),
  draft,
});

export const schemas = {
  pages: pagesSchema,
  services: servicesSchema,
  playbooks: playbooksSchema,
  guides: guidesSchema,
  insights: insightsSchema,
  research: researchSchema,
  library: librarySchema,
  briefs: briefsSchema,
  faq: faqSchema,
  glossary: glossarySchema,
  people: peopleSchema,
  events: eventsSchema,
  portfolio: portfolioSchema,
} as const;
