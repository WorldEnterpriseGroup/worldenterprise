import { glob, file } from 'astro/loaders';
import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { CLAIM_IDS, isClaimUsable } from './data/claims.ts';
import type { ClaimId } from './data/claims.ts';
import { site } from './data/site.ts';
import { TITLE_MAX } from './lib/seo.ts';

/**
 * Content collections (SAGE-PLAN 6.4). Every object is strict: unknown frontmatter keys fail the build.
 * `draft: true` entries (fixtures and unfinished work) are excluded from nav, sitemap and search, and fail
 * PUBLIC_RELEASE builds.
 */

const claimId = z
  .enum(CLAIM_IDS)
  .refine((id) => isClaimUsable(id as ClaimId), { message: 'Claim is excluded or switched off; content may not cite it.' });

const claimsUsed = z.array(claimId).default([]);
const draft = z.boolean().default(false);

/**
 * Optional short title for the document title and social cards, for headings that cannot fit in 60 characters once
 * " | World Enterprise Incubator" is added. The heading itself is never shortened.
 */
const seoTitle = z.string().min(1).max(TITLE_MAX - ` | ${site.titleSuffix}`.length).optional();
const serviceLine = z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G']);

const source = z.strictObject({
  id: z.string().min(1),
  title: z.string().min(1),
  publisher: z.string().min(1),
  url: z.url(),
  accessed: z.coerce.date().optional(),
});

const cta = z.strictObject({
  label: z.string().min(1),
  href: z.string().startsWith('/'),
  variant: z.enum(['primary', 'secondary', 'quiet']).default('primary'),
});

const mdLoader = (base: string) => glob({ pattern: '**/*.{md,mdx}', base });

const pages = defineCollection({
  loader: mdLoader('./src/content/pages'),
  schema: z.strictObject({
    title: z.string().min(1).max(70),
    seoTitle,
    description: z.string().min(50).max(160),
    eyebrow: z.string().optional(),
    hero: z.enum(['H1', 'H2', 'H3', 'H4', 'H5']).default('H2'),
    updated: z.coerce.date(),
    ctas: z.array(cta).default([]),
    claimsUsed,
    faqRefs: z.array(z.string()).default([]),
    draft,
  }),
});

const services = defineCollection({
  loader: mdLoader('./src/content/services'),
  schema: z.strictObject({
    line: serviceLine,
    title: z.string().min(1),
    shortTitle: z.string().min(1),
    summary: z.string().min(20),
    covers: z.array(z.string().min(1)).min(1),
    doesNotCover: z.array(z.string().min(1)).min(1),
    icon: serviceLine,
    relatedPlaybooks: z.array(z.string()).default([]),
    faqRefs: z.array(z.string()).default([]),
    claimsUsed,
    updated: z.coerce.date(),
    draft,
  }),
});

const playbooks = defineCollection({
  loader: mdLoader('./src/content/playbooks'),
  schema: z.strictObject({
    stage: z.enum(['dream', 'build', 'grow']),
    order: z.number().int().min(1),
    title: z.string().min(1),
    description: z.string().min(50).max(160),
    steps: z.array(z.strictObject({ title: z.string().min(1), body: z.string().min(1) })).min(1),
    artifacts: z.array(z.string()).default([]),
    relatedLibrary: z.array(z.string()).default([]),
    claimsUsed,
    updated: z.coerce.date(),
    draft,
  }),
});

const guides = defineCollection({
  loader: mdLoader('./src/content/guides'),
  schema: z
    .strictObject({
      section: z.enum(['fundability', 'trust']),
      title: z.string().min(1),
      description: z.string().min(50).max(160),
      disclaimers: z.array(z.enum(['no-funding', 'not-legal-advice', 'generic-definition'])).default([]),
      sources: z.array(source).default([]),
      claimsUsed,
      updated: z.coerce.date(),
      draft,
    })
    .refine((g) => g.section !== 'fundability' || g.disclaimers.includes('no-funding'), {
      message: 'Fundability guides must carry the no-funding disclaimer (claim C-05).',
      path: ['disclaimers'],
    }),
});

const insights = defineCollection({
  loader: mdLoader('./src/content/insights'),
  schema: z
    .strictObject({
      title: z.string().min(1),
      seoTitle,
      description: z.string().min(50).max(160),
      topic: z.enum(['dream', 'build', 'grow', 'fundable']),
      publishedDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      author: z.literal('World Enterprise Editorial').default('World Enterprise Editorial'),
      sources: z.array(source).default([]),
      noStatistics: z.boolean().default(false),
      evidence: z.array(z.string()).default([]),
      relatedServices: z.array(serviceLine).default([]),
      relatedPlaybook: z.string().optional(),
      relatedTemplate: z.string().optional(),
      cover: z.string().optional(),
      claimsUsed,
      draft,
    })
    .refine((i) => i.noStatistics || i.sources.length >= 2, {
      message: 'An insight needs at least two sources, or noStatistics: true.',
      path: ['sources'],
    }),
});

const research = defineCollection({
  loader: mdLoader('./src/content/research'),
  schema: z.strictObject({
    title: z.string().min(1),
    subtitle: z.string().min(1),
    description: z.string().min(50).max(160),
    publishedDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    version: z.string().default('1.0'),
    methodology: z.string().min(40),
    limitations: z.string().min(40),
    sources: z.array(source).min(5),
    appendix: z.string().optional(),
    claimsUsed,
    draft,
  }),
});

const library = defineCollection({
  loader: mdLoader('./src/content/library'),
  schema: z.strictObject({
    title: z.string().min(1),
    description: z.string().min(50).max(160),
    kind: z.enum(['template', 'checklist', 'worksheet', 'guide']),
    instructions: z.string().min(20),
    markdownDownload: z.literal(true).default(true),
    claimsUsed,
    updated: z.coerce.date(),
    draft,
  }),
});

const faq = defineCollection({
  loader: file('src/data/faq.yaml'),
  schema: z.strictObject({
    id: z.string(),
    question: z.string().min(1),
    answer: z.string().min(1),
    group: z.string().min(1),
    claimsUsed,
    related: z.array(z.string()).default([]),
    draft,
  }),
});

const glossary = defineCollection({
  loader: file('src/data/glossary.yaml'),
  schema: z.strictObject({
    id: z.string(),
    term: z.string().min(1),
    definition: z.string().min(1),
    group: z.string().min(1),
    claimsUsed,
    related: z.array(z.string()).default([]),
    draft,
  }),
});

/** L2 collections: schema defined, collection empty. `source` is required so nothing can launch unsourced. */
const l2Source = z.string().min(1);

const people = defineCollection({
  loader: mdLoader('./src/content/people'),
  schema: z.strictObject({
    name: z.string().min(1),
    role: z.string().min(1),
    source: l2Source,
    consent: z.literal(true),
    draft,
  }),
});

const events = defineCollection({
  loader: mdLoader('./src/content/events'),
  schema: z.strictObject({
    title: z.string().min(1),
    start: z.coerce.date(),
    source: l2Source,
    draft,
  }),
});

const portfolio = defineCollection({
  loader: mdLoader('./src/content/portfolio'),
  schema: z.strictObject({
    company: z.string().min(1),
    source: l2Source,
    consent: z.literal(true),
    draft,
  }),
});

export const collections = { pages, services, playbooks, guides, insights, research, library, faq, glossary, people, events, portfolio };
