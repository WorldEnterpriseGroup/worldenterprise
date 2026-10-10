// The words WP-43 puts on the site, gathered in one place so tests can enumerate them. Every string here must be mapped in
// .astro-magazine/sources/wp-43.json (sources.test.ts) and must pass the claims denylist.
import { readFileSync } from 'node:fs';
import { ASIDE_COPY, DECIDE_COPY, plainLine } from '../../../src/components/apply/decide-copy.ts';
import { APPLY_FIELDS, PACKAGE_EMPTY_LABEL, PACKAGE_NOT_SURE_LABEL, PACKAGE_PRICING_NOTE, REVIEW_COPY, STAGE_OPTIONS } from '../../../src/components/apply/fields.ts';
import { FIT_HEADING, FITS, NOT_FIT_HEADING, NOT_FITS } from '../../../src/components/apply/fit.ts';
import { APPLY_STEPS } from '../../../src/components/apply/steps.ts';
import { buildReviewGroups, stepStatus } from '../../../src/components/apply/stepper.ts';
import { packages } from '../../../src/data/packages.ts';

export interface Surface {
  /** The page or component the strings appear on. */
  readonly where: string;
  readonly strings: readonly string[];
}

const read = (path: string): string => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');

/** The front matter fields that publish text, and the body of an mdx file. */
function mdx(path: string): { frontmatter: Record<string, string>; ctas: string[]; body: string[] } {
  const text = read(path);
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (match === null) throw new Error(`${path}: no front matter`);
  const frontmatter: Record<string, string> = {};
  for (const line of (match[1] ?? '').split('\n')) {
    const field = /^(title|description|eyebrow):\s*(.*)$/.exec(line);
    if (field !== null) frontmatter[field[1] ?? ''] = (field[2] ?? '').replace(/^"(.*)"$/, '$1');
  }
  const ctas = [...(match[1] ?? '').matchAll(/label:\s*([^,}]+)/g)].map((m) => (m[1] ?? '').trim());
  const body = (match[2] ?? '').split(/\n{2,}/).map((p) => p.trim()).filter((p) => p !== '');
  return { frontmatter, ctas, body };
}

/** Split a paragraph into sentences. A colon or a semicolon does not end one. */
/** The sentences of apply.mdx that WP-43 did not touch (they read the same on wp/40). Everything else on that page is new text. */
const APPLY_MDX_UNCHANGED: readonly string[] = [
  'Tell WE about the idea.',
  'WE is fully remote, so there is nothing to book and nowhere to travel.',
  'You apply from where you are.',
];

export function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.?!])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

/**
 * Interface text that is not page copy: the stepper's status line and review labels, built by src/components/apply/stepper.ts. It is
 * scanned against the claims denylist but needs no source, because it states no fact about WE.
 */
export function interfaceStrings(): string[] {
  const values = { name: '', email: '', company: '', stage: '', seats: '', topic: '', message: '', consent: false, website: '' };
  const groups = buildReviewGroups(values);
  return [
    ...APPLY_STEPS.map((_, index) => stepStatus(index)),
    ...groups.flatMap((g) => [g.title, `Change ${g.title.toLowerCase()}`, ...g.rows.map((r) => r.label)]),
    REVIEW_COPY.back,
    REVIEW_COPY.next,
    'There is 1 item to fix before you continue.',
    'There are 2 items to fix before you continue.',
    ', completed',
    ', current step',
  ];
}

export function surfaces(): Surface[] {
  const decide = mdx('src/content/pages/program/how-we-decide.mdx');
  const apply = mdx('src/content/pages/apply/apply.mdx');
  const { read: how, fit, send, no, decide: not, cta } = DECIDE_COPY;
  const stages = STAGE_OPTIONS.filter((o) => o.value !== '').map((o) => o.label);
  const fieldStrings = Object.values(APPLY_FIELDS).flatMap((f) => [f.label, ...('hint' in f ? [f.hint] : [])]);
  return [
    {
      where: 'src/content/pages/program/how-we-decide.mdx',
      strings: [...Object.values(decide.frontmatter), ...decide.ctas, ...decide.body.flatMap(sentencesOf)],
    },
    {
      where: 'src/pages/program/how-we-decide.astro',
      strings: [
        DECIDE_COPY.lead,
        how.heading,
        ...sentencesOf(how.intro),
        ...how.steps.flatMap((s) => [s.title, ...sentencesOf(s.body)]),
        how.note,
        plainLine(how.more),
        FIT_HEADING,
        ...sentencesOf(fit.intro),
        ...FITS,
        NOT_FIT_HEADING,
        ...NOT_FITS,
        send.heading,
        ...sentencesOf(send.intro),
        ...fieldStrings,
        ...stages,
        PACKAGE_EMPTY_LABEL,
        ...packages.map((p) => p.name),
        PACKAGE_NOT_SURE_LABEL,
        no.heading,
        ...no.lines,
        plainLine(no.more),
        not.heading,
        ...not.rows.flatMap((r) => [r.term, ...sentencesOf(r.text)]),
        cta.title,
        cta.text,
        ...DECIDE_COPY.next.flatMap((n) => [n.title, ...sentencesOf(n.description)]),
      ],
    },
    {
      where: 'src/pages/apply/index.astro',
      strings: [ASIDE_COPY.heading, ...sentencesOf(ASIDE_COPY.reads), ...sentencesOf(plainLine(ASIDE_COPY.page).trim())],
    },
    { where: 'src/pages/contact/index.astro', strings: sentencesOf(plainLine(ASIDE_COPY.contact).trim()) },
    {
      where: 'src/content/pages/apply/apply.mdx',
      strings: apply.body.flatMap(sentencesOf).filter((sentence) => !APPLY_MDX_UNCHANGED.includes(sentence)),
    },
    {
      where: 'src/components/forms/ApplyForm.astro',
      strings: [
        ...APPLY_STEPS.map((s) => s.title),
        ...sentencesOf(REVIEW_COPY.intro),
        REVIEW_COPY.title,
        REVIEW_COPY.empty,
        ...sentencesOf(PACKAGE_PRICING_NOTE.before + PACKAGE_PRICING_NOTE.link.text + PACKAGE_PRICING_NOTE.after),
      ],
    },
  ];
}
