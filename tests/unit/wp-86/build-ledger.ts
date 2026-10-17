import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SentenceRecord } from '../wp-60/sources.ts';
import { enumerateHub, enumeratePlaybook, sentencesOf, uniqueEntries } from './enumerate.ts';
import type { Entry } from './enumerate.ts';
import { CHAIN_REGISTRY, CLAIM_SENTENCES, FACTS, FETCHES, HUB_COPY, HUB_LEAD, HUB_PAGE, PLAYBOOKS, TEMPLATE_PLAYBOOK } from './ledger-spec.ts';
import type { Mapping } from './ledger-spec.ts';

/**
 * Writes .astro-magazine/sources/wp-86.json from the playbook files and the mapping in ledger-spec.ts:
 *   node tests/unit/wp-86/build-ledger.ts
 * The unit test (ledger.test.ts) enumerates the same files and fails when the JSON has drifted from them, so run this after any copy edit.
 */
export const root = new URL('../../../', import.meta.url).pathname;
export const LEDGER_PATH = '.astro-magazine/sources/wp-86.json';
export const playbookPath = (slug: string): string => `src/content/playbooks/${slug}.mdx`;

const MAX_LABEL_WORDS = 7;
const LABEL_KINDS: ReadonlySet<Entry['kind']> = new Set(['title', 'heading', 'caption', 'column']);
const wordCount = (text: string): number => text.split(/\s+/).filter(Boolean).length;

/** The content file a slug names: an article in any desk, a research brief or a template. */
export function resolveSlug(slug: string): string {
  const candidates: string[] = [];
  const insights = join(root, 'src/content/insights');
  for (const desk of readdirSync(insights, { withFileTypes: true })) {
    if (desk.isDirectory()) candidates.push(`src/content/insights/${desk.name}/${slug}`);
  }
  candidates.push(`src/content/research/${slug}`, `src/content/library/${slug}`);
  for (const base of candidates) {
    for (const ext of ['.mdx', '.md']) if (existsSync(join(root, base + ext))) return base + ext;
  }
  throw new Error(`No article, research brief or template has the slug "${slug}"`);
}

/** The slug at the end of an internal route (`/insights/<slug>/`). */
export const slugOfRoute = (route: string): string => route.split('/').filter(Boolean).at(-1) ?? '';

const factSentences = (slug: string): ReadonlySet<string> => new Set(FACTS.filter((f) => f.slug === slug).map((f) => f.sentence));

function fromMapping(mapping: Mapping | string): Mapping {
  return typeof mapping === 'string' ? { page: resolveSlug(mapping) } : mapping;
}

/** The mapping of one sentence of a playbook. A sentence the spec cannot place throws, so nothing is mapped by default. */
export function mapPlaybookEntry(slug: string, entry: Entry): SentenceRecord {
  const spec = PLAYBOOKS[slug];
  if (spec === undefined) throw new Error(`${slug} has no entry in ledger-spec.ts`);
  const text = entry.text;
  if (factSentences(slug).has(text)) return { text, decision: 'W8-9' };
  const claim = CLAIM_SENTENCES[text];
  if (claim !== undefined) return { text, claim };
  if (LABEL_KINDS.has(entry.kind) && wordCount(text) <= MAX_LABEL_WORDS) return { text, label: true };
  if (entry.kind === 'link') {
    if (entry.external !== undefined) return { text, decision: 'W8-9' };
    return { text, page: resolveSlug(slugOfRoute(entry.route ?? '')) };
  }
  const area = entry.area;
  if (area.endsWith('#example')) return { text, decision: 'W8-24' };
  if (area === 'front') return { text, page: resolveSlug(spec.front) };
  if (area === 'intro') {
    if (spec.intro === undefined) throw new Error(`${slug}: text before the first H2 and no "intro" page in the spec: "${text}"`);
    return { text, page: resolveSlug(spec.intro) };
  }
  if (area === 'what-good-looks-like') return { text, page: resolveSlug(spec.good) };
  if (area.startsWith('decision-aid')) return { text, page: resolveSlug(spec.decision) };
  if (area === 'common-mistakes') return { text, page: resolveSlug(spec.mistakes) };
  if (area === 'evidence-to-check-before-you-move-on') return { text, page: resolveSlug(spec.evidence) };
  if (area === 'where-we-can-help') return { text, claim: 'C-04' };
  if (area === 'sources') return { text, decision: 'W8-9' };
  const extra = spec.extra?.[area];
  if (extra !== undefined) return { text, ...fromMapping(extra) };
  throw new Error(`${slug}: no mapping for the area "${area}" ("${text}")`);
}

/** The hub page's sentences: the chain registry holds the order and the stages, the template playbook holds the structure. */
export function mapHubEntry(entry: Entry): SentenceRecord {
  const text = entry.text;
  const claim = CLAIM_SENTENCES[text];
  if (claim !== undefined) return { text, claim };
  if (entry.kind === 'title') return { text, label: true };
  if (text.startsWith('Each worked example') || text.startsWith('The playbooks are general working guides') || text.startsWith('They are not a promise')) {
    return { text, decision: 'W8-24' };
  }
  if (text.startsWith('The playbooks on company setup')) return { text, page: 'src/content/playbooks/set-up-the-company.mdx' };
  if (/^(Each playbook|Every step|You do not need|If you cannot)/.test(text)) return { text, page: TEMPLATE_PLAYBOOK };
  return { text, page: CHAIN_REGISTRY };
}

export function hubCopyEntries(): Entry[] {
  return sentencesOf(HUB_LEAD).map((text) => ({ text, kind: 'prose' as const, area: 'front' }));
}

export function buildLedger(): unknown {
  const documents: unknown[] = [];
  for (const slug of Object.keys(PLAYBOOKS)) {
    const path = playbookPath(slug);
    const entries = uniqueEntries(enumeratePlaybook(path, readFileSync(join(root, path), 'utf8')));
    documents.push({ path, sentences: entries.map((entry) => mapPlaybookEntry(slug, entry)) });
  }
  const hub = uniqueEntries(enumerateHub(HUB_PAGE, readFileSync(join(root, HUB_PAGE), 'utf8')));
  documents.push({ path: HUB_PAGE, sentences: hub.map(mapHubEntry) });
  documents.push({ path: HUB_COPY, sentences: hubCopyEntries().map((entry) => ({ text: entry.text, page: TEMPLATE_PLAYBOOK })) });
  return {
    wp: 'WP-86',
    note: 'The sentence ledger of the ten playbooks and the playbooks hub (docs/wave8-contracts.md, section 9). Each sentence maps to one claim, one existing page or one decision; a title or heading that states no fact is a label. The guidance sentences of a playbook map to the article that covers their area; the Sources bullets map to the page they name; the paragraph about WE restates the service line (C-04); each illustrative example is a consideration (W8-24); each sentence that states what an outside page says maps to the source rule (W8-9) and has an entry in facts with the fetch and a verbatim quote. The file is generated: node tests/unit/wp-86/build-ledger.ts. tests/unit/wp-86/ledger.test.ts enumerates the sentences from the content files and fails on one with no mapping and on a mapping with no sentence.',
    fetches: FETCHES,
    documents,
    facts: FACTS.map((fact) => ({ path: playbookPath(fact.slug), sentence: fact.sentence, fetchId: fact.fetchId, quotes: fact.quotes })),
  };
}

if (process.argv[1] !== undefined && process.argv[1].endsWith('build-ledger.ts')) {
  writeFileSync(join(root, LEDGER_PATH), `${JSON.stringify(buildLedger(), null, 2)}\n`);
  process.stdout.write(`wrote ${LEDGER_PATH}\n`);
}
