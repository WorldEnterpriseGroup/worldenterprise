import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import test from 'node:test';
import { getRssString } from '@astrojs/rss';
import { needlesOf, readBrief, searchTree } from '../../../scripts/lib/gated-briefs.mjs';
import { assembleTwins } from '../../../src/components/geo/assemble.ts';
import type { TwinContent } from '../../../src/components/geo/assemble.ts';
import { feedItems } from '../../../src/components/geo/feed.ts';
import { deskGroups, familyGroups, fullTiers } from '../../../src/components/geo/llms-plan.ts';
import { buildPaletteCommands } from '../../../src/components/nav/commands.ts';
import { site } from '../../../src/data/site.ts';
import { buildLlmsFullTxt, buildLlmsTxt, planLlmsFull } from '../../../src/lib/llms.ts';
import type { LlmsInput } from '../../../src/lib/llms.ts';
import { buildTwin, renderTwin, twinPath } from '../../../src/lib/markdown-twins.ts';
import type { RenderedTwin } from '../../../src/lib/markdown-twins.ts';
import { REQUIRED, ROOT } from '../wp-41/content.ts';

/** D-23: the full text of a gated brief never enters a twin, an llms file, the feed or the palette. Only the open abstract may. */

const SENTINEL = 'The harbour ledger of an idle workshop records every lantern that was lit before the first frost arrived.';
const filler = (n: number): string => `Paragraph ${n} of the gated text covers a plain subject in short words and ties to nothing else in this fixture, which is the whole point of it.`;

function gatedBrief(): string {
  const lines: string[] = [];
  for (let i = 1; i <= 30; i += 1) lines.push(i === 15 ? SENTINEL : filler(i), '');
  return ['---', 'id: fixture-brief', 'title: Fixture brief', 'audience: [startup]', `sentinel: "${SENTINEL}"`, '---', '', '## A section', '', ...lines].join('\n');
}

const ABSTRACT = 'This open abstract says what the brief covers and who it is for, in words that appear nowhere in the gated text.';
const day = new Date('2026-10-01');
const allLive = (): boolean => true;

function content(abstract: string): TwinContent {
  return {
    insights: [{ id: 'dream/a-post', body: 'A short article about a topic.', data: { title: 'A post', description: 'About a post.', topic: 'dream', publishedDate: day, sources: [] } }],
    research: [],
    pages: [],
    services: [],
    playbooks: [],
    briefs: [{ id: 'fixture-brief', body: abstract, data: { title: 'Fixture brief', description: 'What the brief covers.', outline: ['A section'], updated: day } }],
    faq: [],
    glossary: [],
    referenceUpdated: day,
  };
}

function llmsInput(overrides: Partial<LlmsInput>): LlmsInput {
  return {
    site: { name: site.name, legalName: site.legalName, tagline: site.tagline, description: site.description, origin: site.origin },
    serviceLines: [],
    keyPages: [],
    optionalPages: [],
    howWeDecide: null,
    twinRoutes: new Set<string>(),
    contactRoute: null,
    applyRoute: null,
    addOnStatement: 'x',
    calendarStatement: 'y',
    ...overrides,
  };
}

/** Runs every machine surface builder over the content and writes each output where a dist keeps it, so the audit's own search can read it. */
async function writeSurfaces(dist: string, abstract: string): Promise<void> {
  const write = (name: string, text: string): void => {
    mkdirSync(join(dist, name, '..'), { recursive: true });
    writeFileSync(join(dist, name), text);
  };
  const { twins } = assembleTwins(content(abstract), { required: REQUIRED, isEligible: allLive });
  assert.ok(twins.some((t) => t.route === '/briefs/fixture-brief/'), 'the brief has a twin made from its abstract');
  const rendered: RenderedTwin[] = twins.map((t) => buildTwin(t));
  for (const twin of twins) write(twinPath(twin.route).slice(1), renderTwin(twin));
  const twinRoutes = new Set(twins.map((t) => t.route));
  const base = llmsInput({
    twinRoutes,
    optionalPages: twins.map((t) => ({ route: t.route, title: t.title, description: t.lead })),
    desks: deskGroups(allLive),
    families: familyGroups(allLive),
  });
  write('llms.txt', buildLlmsTxt(base));
  const plan = planLlmsFull(base, fullTiers({ twins: new Map(rendered.map((t) => [t.route, t])), curated: twins.map((t) => t.route), isLive: allLive }));
  write('llms-full.txt', buildLlmsFullTxt(base, plan.pages));
  const items = feedItems(content(abstract).insights, [], allLive);
  write(
    'rss.xml',
    await getRssString({ title: 'Feed', description: 'A feed.', site: new URL(site.origin), items: items.map((i) => ({ title: i.title, description: i.description, link: i.path, pubDate: i.pubDate })) }),
  );
  const palette = buildPaletteCommands({ items: [], utility: [], apply: { label: 'Apply', href: '/apply/' }, footer: [] }, allLive);
  write('palette.json', JSON.stringify(palette));
}

function withTmp<T>(run: (dir: string) => Promise<T>): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), 'wp91-d23-'));
  return run(dir).finally(() => rmSync(dir, { recursive: true, force: true }));
}

test('no machine surface carries the sentinel or a probe of a gated brief; only the open abstract is used', async () => {
  await withTmp(async (dir) => {
    const briefFile = join(dir, 'infra', 'intake', 'briefs', 'fixture-brief.md');
    mkdirSync(join(dir, 'infra', 'intake', 'briefs'), { recursive: true });
    writeFileSync(briefFile, gatedBrief());
    const brief = readBrief(briefFile, gatedBrief());
    assert.deepEqual(brief.errors, []);
    const needles = needlesOf([brief]);
    assert.equal(needles.length, 4, 'a sentinel and three probes');

    const dist = join(dir, 'dist');
    await writeSurfaces(dist, ABSTRACT);
    const result = searchTree(dist, needles);
    assert.ok(result.files >= 5, `only ${result.files} files were searched`);
    assert.deepEqual(result.findings, []);
    assert.ok(readFileSync(join(dist, 'briefs/fixture-brief.md'), 'utf8').includes(ABSTRACT), 'the abstract is on the surface');
  });
});

test('the search can fail: an abstract that quotes the gated text is found on the brief twin', async () => {
  await withTmp(async (dir) => {
    const briefFile = join(dir, 'fixture-brief.md');
    writeFileSync(briefFile, gatedBrief());
    const needles = needlesOf([readBrief(briefFile, gatedBrief())]);
    const dist = join(dir, 'dist');
    await writeSurfaces(dist, `${ABSTRACT}\n\n${SENTINEL}`);
    const where = searchTree(dist, needles).findings.filter((f) => f.label === 'sentinel').map((f) => f.where);
    assert.ok(where.includes('briefs/fixture-brief.md'), where.join(', '));
  });
});

test('nothing in src reads from infra/intake: the only mentions are comments', () => {
  const offenders: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|mjs|js|astro|json|md|mdx|ya?ml)$/.test(name)) {
        readFileSync(full, 'utf8')
          .split('\n')
          .forEach((line, index) => {
            if (line.includes('infra/intake') && !/^\s*(\/\/|\/\*|\*|<!--|#)/.test(line)) offenders.push(`${relative(ROOT, full)}:${index + 1}`);
          });
      }
    }
  };
  walk(join(ROOT, 'src'));
  assert.deepEqual(offenders, []);
});

test('the briefs collection is read as the open abstract: the twin and feed builders take no field that holds a brief body', () => {
  const sources = ['src/components/geo/assemble.ts', 'src/components/geo/feed.ts', 'src/components/geo/llms-input.ts', 'src/components/geo/twin-sources.ts'].map((file) => readFileSync(join(ROOT, file), 'utf8'));
  for (const text of sources) assert.ok(!/readFileSync|readFile\(|import\.meta\.glob/.test(text), 'a geo builder reads files directly');
});
