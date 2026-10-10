import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { assembleTwins } from '../../../src/components/geo/assemble.ts';
import type { AssembledTwins, TwinContent } from '../../../src/components/geo/assemble.ts';
import { routes } from '../../../src/data/routes.ts';
import type { RequiredRuleLike } from '../../../src/lib/markdown-twins.ts';

/** The content collections read from disk, so a unit test runs the real twin assembly over the real entries. */
export const ROOT = new URL('../../../', import.meta.url).pathname;
export const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');

interface Loaded {
  readonly id: string;
  readonly body: string;
  readonly data: Record<string, unknown>;
}

function files(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (name.startsWith('_')) continue;
    if (statSync(full).isDirectory()) out.push(...files(full));
    else if (/\.(md|mdx)$/.test(name)) out.push(full);
  }
  return out;
}

/** Published entries of a glob collection: id is the path under the collection folder without the extension. */
function collection(name: string): Loaded[] {
  const base = join(ROOT, 'src/content', name);
  return files(base)
    .map((file) => {
      const raw = readFileSync(file, 'utf8');
      const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw);
      if (match === null) throw new Error(`${file} has no frontmatter`);
      const data = (parse(match[1] ?? '') ?? {}) as Record<string, unknown>;
      return { id: file.slice(base.length + 1).replace(/\.(md|mdx)$/, ''), body: match[2] ?? '', data };
    })
    .filter((entry) => entry.data['draft'] !== true);
}

const date = (value: unknown): Date => new Date(String(value));
const optionalDate = (value: unknown): Date | undefined => (value === undefined || value === null ? undefined : date(value));
const list = (value: unknown): readonly never[] => (Array.isArray(value) ? (value as never[]) : []);

export function loadContent(): TwinContent {
  const faq = parse(read('src/data/faq.yaml')) as { question: string; answer: string; group: string }[];
  const glossary = parse(read('src/data/glossary.yaml')) as { term: string; definition: string; group: string }[];
  return {
    insights: collection('insights').map((e) => ({
      id: e.id,
      body: e.body,
      data: { title: String(e.data['title']), description: String(e.data['description']), topic: String(e.data['topic']), publishedDate: date(e.data['publishedDate']), updatedDate: optionalDate(e.data['updatedDate']), sources: list(e.data['sources']) },
    })),
    research: collection('research').map((e) => ({
      id: e.id,
      body: e.body,
      data: {
        title: String(e.data['title']),
        subtitle: String(e.data['subtitle']),
        publishedDate: date(e.data['publishedDate']),
        updatedDate: optionalDate(e.data['updatedDate']),
        methodology: String(e.data['methodology']),
        limitations: String(e.data['limitations']),
        sources: list(e.data['sources']),
      },
    })),
    pages: collection('pages').map((e) => ({ id: e.id, body: e.body, data: { title: String(e.data['title']), updated: date(e.data['updated']) } })),
    guides: collection('guides').map((e) => ({
      id: e.id,
      body: e.body,
      data: { section: String(e.data['section']), title: String(e.data['title']), description: String(e.data['description']), sources: list(e.data['sources']), updated: date(e.data['updated']) },
    })),
    services: collection('services').map((e) => ({
      id: e.id,
      body: e.body,
      data: { title: String(e.data['title']), summary: String(e.data['summary']), covers: list(e.data['covers']), artifacts: list(e.data['artifacts']), doesNotCover: list(e.data['doesNotCover']), updated: date(e.data['updated']) },
    })),
    playbooks: collection('playbooks').map((e) => ({
      id: e.id,
      body: e.body,
      data: { title: String(e.data['title']), description: String(e.data['description']), steps: list(e.data['steps']), artifacts: list(e.data['artifacts']), updated: date(e.data['updated']) },
    })),
    faq,
    glossary,
    referenceUpdated: new Date('2026-10-06'),
  };
}

const denylist = JSON.parse(read('claims-denylist.json')) as { required: RequiredRuleLike[] };
export const REQUIRED: readonly RequiredRuleLike[] = denylist.required;

const indexable = new Set(routes.filter((r) => r.indexable).map((r) => r.path));

/** The twins of the real content, with every indexable route treated as built. */
export function assembleReal(): AssembledTwins {
  return assembleTwins(loadContent(), { isEligible: (route) => indexable.has(route), required: REQUIRED });
}
