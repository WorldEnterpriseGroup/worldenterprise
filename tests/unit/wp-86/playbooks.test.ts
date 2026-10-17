import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import * as claimsAudit from '../../../scripts/audit-claims.mjs';
import { LIBRARY_REFS, PLAYBOOK_BRIEFS, PLAYBOOK_RELATED, PLAYBOOK_SEQUENCE, PLAYBOOK_TOOLS, artifactRefs, liveSequence, nextLive } from '../../../src/components/playbooks/meta.ts';
import { BRIEFS } from '../../../src/data/families.ts';
import { TOOLS } from '../../../src/components/tools/registry.ts';
import { slugify } from '../wp-60/sources.ts';
import { enumeratePlaybook, plain, sentencesOf, splitFrontmatter, uniqueEntries } from './enumerate.ts';
import { resolveSlug } from './build-ledger.ts';
import { PLAYBOOKS } from './ledger-spec.ts';

/**
 * WP-86: the ten playbooks. What the content must hold (the six elements, the chain and its one terminal, the examples, the facts), what the
 * truth policy forbids, and what the chain code does with a route that is not live. The sentence ledger has its own test (ledger.test.ts).
 */
interface Hit {
  readonly rule: string;
  readonly match: string;
}
const audit = claimsAudit as unknown as { scan(text: string, options?: { route?: string; plain?: boolean; flagValues?: object }): Hit[] };

const root = new URL('../../../', import.meta.url).pathname;
const read = (path: string): string => readFileSync(join(root, path), 'utf8');
const DIR = 'src/content/playbooks';
const SLUGS = PLAYBOOK_SEQUENCE.map((p) => p.slug);
const raw = (slug: string): string => read(`${DIR}/${slug}.mdx`);
const h2s = (text: string): string[] => [...text.matchAll(/^##[ \t]+(.+?)[ \t]*$/gm)].map((m) => m[1] ?? '');
const STAGE_RANK: Readonly<Record<string, number>> = { dream: 0, build: 1, grow: 2 };

/** What the truth policy forbids in any playbook sentence (the claims denylist runs as well). */
const FORBIDDEN: readonly { readonly name: string; readonly re: RegExp }[] = [
  { name: 'free', re: /\bfree\b/i },
  { name: 'no fee', re: /\bno (?:fee|equity|stake)\b/i },
  { name: 'success fee', re: /success[- ]fee/i },
  { name: 'perks', re: /\bperks?\b/i },
  { name: 'accelerator', re: /\baccelerator\b/i },
  { name: 'cohort', re: /\bcohorts?\b/i },
  { name: 'mentor', re: /\bmentors?\b/i },
  { name: 'investor introductions', re: /investor introductions?|introductions? to (?:or with )?investors/i },
  { name: '30/60/90', re: /30\s*\/\s*60\s*\/\s*90/ },
  { name: 'exclamation mark', re: /!/ },
  { name: 'UK spelling', re: /\b(?:organis|prioritis|recognis|cancelled|cancelling|labour|colour|behaviour|programme)\w*/i },
  { name: 'currency amount', re: /[$£€]\s?\d/ },
  { name: 'percentage', re: /\d\s?%/ },
];

test('the chain has ten playbooks, one file each, and no other file sits in the folder', () => {
  assert.equal(SLUGS.length, 10);
  assert.equal(new Set(SLUGS).size, 10);
  assert.deepEqual(readdirSync(join(root, DIR)).filter((f) => f.endsWith('.mdx')).sort(), SLUGS.map((s) => `${s}.mdx`).sort());
  assert.deepEqual(Object.keys(PLAYBOOKS), SLUGS, 'the ledger spec lists the playbooks in chain order');
});

test('the order field of each file is its position in the chain and the stages never go backwards', () => {
  let rank = 0;
  SLUGS.forEach((slug, i) => {
    const { data } = splitFrontmatter(slug, raw(slug));
    assert.equal(data.order, i + 1, `${slug} order`);
    const stage = STAGE_RANK[String(data.stage)];
    assert.ok(stage !== undefined, `${slug} has a stage`);
    assert.ok(stage >= rank, `${slug} goes back a stage`);
    rank = stage;
  });
});

test('the chain starts in Dream and ends in Grow', () => {
  assert.equal(splitFrontmatter('first', raw(SLUGS[0] ?? '')).data.stage, 'dream');
  assert.equal(splitFrontmatter('last', raw(SLUGS.at(-1) ?? '')).data.stage, 'grow');
});

for (const slug of SLUGS) {
  const text = raw(slug);
  const { data, body } = splitFrontmatter(slug, text);
  const entries = enumeratePlaybook(slug, text);
  const headings = h2s(body);

  test(`${slug}: frontmatter is complete and the description fits 50 to 160 characters`, () => {
    assert.ok(typeof data.title === 'string' && data.title !== '');
    const description = String(data.description);
    assert.ok(description.length >= 50 && description.length <= 160, `description is ${description.length} characters`);
    assert.ok(Array.isArray(data.steps) && data.steps.length >= 5, 'at least five steps');
    assert.ok(Array.isArray(data.artifacts) && data.artifacts.length >= 3, 'at least three artifacts');
    assert.equal(String(data.updated).slice(0, 10), '2026-10-10');
    assert.equal(data.draft, undefined, 'a playbook is not a draft');
  });

  test(`${slug}: holds the six elements in order`, () => {
    const expected: readonly (string | RegExp)[] = ['What good looks like', /^Decision aid: /, 'Common mistakes', 'Evidence to check before you move on', 'Where WE can help', 'Sources'];
    const picked = expected.map((e) => headings.findIndex((h) => (typeof e === 'string' ? h === e : e.test(h))));
    picked.forEach((index, i) => assert.ok(index !== -1, `missing H2 ${String(expected[i])}`));
    assert.deepEqual([...picked].sort((a, b) => a - b), picked, 'the six H2s keep their order');
    assert.equal(headings.at(-1), 'Sources', 'the evidence block is last');
    assert.equal(headings.filter((h) => /^Decision aid: /.test(h)).length, 1, 'exactly one decision aid');
    for (const heading of headings) assert.ok(heading === heading.charAt(0).toUpperCase() + heading.slice(1) && !/\b[A-Z][a-z]+ [A-Z][a-z]+ [A-Z][a-z]+/.test(heading.replace(/WE/g, 'we')), `"${heading}" is sentence case`);
  });

  test(`${slug}: one Callout, labeled exactly, with a paragraph and no mention of WE`, () => {
    const callouts = [...body.matchAll(/<Callout\s+title="([^"]*)">([\s\S]*?)<\/Callout>/g)];
    assert.equal(callouts.length, 1);
    assert.equal(callouts[0]?.[1], 'Illustrative example, not a real company');
    const example = plain(callouts[0]?.[2] ?? '');
    assert.ok(example.split(/\s+/).length >= 60, 'the example is a worked one');
    assert.doesNotMatch(example, /\bWE\b/, 'an example never names WE');
    assert.doesNotMatch(example, /\d{2,}/, 'an example carries no figures');
    assert.ok(headings.indexOf('What good looks like') !== -1 && body.indexOf('<Callout') > body.indexOf('## What good looks like'), 'the example sits under what good looks like');
  });

  test(`${slug}: the decision aid and the common mistakes are tables with JSON cells`, () => {
    const tables = [...body.matchAll(/<DataTable[\s\S]*?\n\/>/g)].map((m) => m[0]);
    assert.ok(tables.length >= 2, 'a decision aid and a mistakes table');
    for (const entry of entries.filter((e) => e.kind === 'cell' || e.kind === 'column' || e.kind === 'caption')) {
      assert.doesNotMatch(entry.text, /[{}<>]|\]\(/, `"${entry.text}" holds markup`);
    }
    const mistakes = body.slice(body.indexOf('## Common mistakes'), body.indexOf('## Evidence to check'));
    assert.match(mistakes, /columns=\{\["Mistake", "Why it costs you", "Do this instead"\]\}/);
    assert.ok([...mistakes.matchAll(/^\s+\["/gm)].length >= 5, 'at least five mistakes');
  });

  test(`${slug}: only Callout, DataTable and MaybeLink are used, with no HowTo, JSON-LD or image`, () => {
    const used = new Set([...body.matchAll(/<([A-Z][A-Za-z]+)/g)].map((m) => m[1]));
    for (const name of used) assert.ok(['Callout', 'DataTable', 'MaybeLink'].includes(name ?? ''), `component ${name} is not allowed`);
    const imports = [...body.matchAll(/^import\s+(\w+)\s+from\s+'([^']+)';$/gm)];
    for (const [, name, from] of imports) {
      assert.ok(used.has(name), `${name} is imported and never used`);
      assert.ok(existsSync(join(root, DIR, from ?? '')), `${from} does not resolve`);
    }
    assert.doesNotMatch(text, /HowTo|ld\+json|@context|@type|<script|<img|!\[|\.avif|\.png|\.jpe?g/i);
    assert.doesNotMatch(body, /^\s*<[a-z]/m, 'no raw HTML');
  });

  test(`${slug}: every internal link is to a page that exists in the repository or in the chain`, () => {
    for (const [, path] of body.matchAll(/<MaybeLink\s+path="([^"]+)"/g)) {
      const route = path ?? '';
      assert.match(route, /^\/[a-z0-9\-/]+\/$/, `${route} is a clean route`);
      const [, section, second] = route.split('/');
      if (section === 'playbooks') assert.ok(SLUGS.includes(second ?? ''), `${route} is not a playbook`);
      else if (section === 'insights' || section === 'research' || section === 'library') assert.doesNotThrow(() => resolveSlug(second ?? ''), `${route} has no file`);
      else if (section === 'services') assert.ok(existsSync(join(root, `src/content/services/${second}.mdx`)), `${route} has no file`);
      else if (section === 'fundability') {
        const guide = `src/content/guides/${second}.mdx`;
        assert.ok(second === '' || existsSync(join(root, guide)), `${route} has no guide`);
      } else assert.fail(`${route} is not a section the playbooks link to`);
    }
    assert.doesNotMatch(body, /\]\((?!https:\/\/)[^)]*\)/, 'a markdown link is external only');
  });

  test(`${slug}: the Sources section lists at least five sources, each one link`, () => {
    const sources = body.slice(body.indexOf('## Sources'));
    const bullets = sources.split('\n').filter((l) => l.startsWith('- '));
    assert.ok(bullets.length >= 5, `${bullets.length} sources`);
    for (const bullet of bullets) assert.match(bullet, /^- (?:<MaybeLink path="[^"]+">[^<]+<\/MaybeLink>|\[[^\]]+\]\(https:\/\/[^)\s]+\))$/, `"${bullet}" is not a single link`);
    for (const [, route, label] of sources.matchAll(/^- <MaybeLink path="([^"]+)">([^<]+)<\/MaybeLink>$/gm)) {
      const name = (route ?? '').split('/')[2] ?? '';
      const file = resolveSlug(name);
      assert.equal(label, splitFrontmatter(file, read(file)).data.title, `${route} is listed under the title of its page`);
    }
    for (const bullet of bullets.filter((b) => b.startsWith('- [')))assert.match(bullet, /read October 10, 2026\]/, 'an outside source says when it was read');
  });

  test(`${slug}: the truth policy and the claims denylist pass on every sentence and on the whole page`, () => {
    for (const entry of uniqueEntries(entries)) {
      for (const rule of FORBIDDEN) assert.doesNotMatch(entry.text, rule.re, `${rule.name} in "${entry.text}"`);
      const hits = audit.scan(entry.text, { route: `/playbooks/${slug}/`, plain: true, flagValues: {} });
      assert.deepEqual(hits, [], `claims rule in "${entry.text}"`);
    }
    const whole = entries.map((e) => e.text).join('\n');
    assert.deepEqual(audit.scan(whole, { route: `/playbooks/${slug}/`, plain: true, flagValues: {} }), []);
    assert.doesNotMatch(whole, /\bWE (?:will|guarantee|guarantees|promise|promises)\b/);
  });

  test(`${slug}: step titles and headings are sentence case and WE is capitalized`, () => {
    assert.doesNotMatch(text, /\bWe\b(?! (?:do|are|sees))/, 'WE is written in capitals');
    assert.doesNotMatch(String(data.title), /\b[A-Z][a-z]+ [A-Z][a-z]+ [A-Z][a-z]+/, 'title is sentence case');
  });
}

test('every playbook but the last points to the next one in the Evidence section, and the last points to no playbook', () => {
  SLUGS.forEach((slug, i) => {
    const { body } = splitFrontmatter(slug, raw(slug));
    const evidence = body.slice(body.indexOf('## Evidence to check before you move on'), body.indexOf('## Where WE can help'));
    const next = SLUGS[i + 1];
    const targets = [...evidence.matchAll(/<MaybeLink\s+path="\/playbooks\/([a-z0-9-]+)\/"/g)].map((m) => m[1]);
    if (next === undefined) {
      assert.deepEqual(targets, [], `${slug} is the terminal and links to no playbook`);
      assert.match(evidence, /last playbook in the chain/);
    } else {
      assert.ok(targets.includes(next), `${slug} does not point to ${next}`);
      const first = evidence.indexOf(`/playbooks/${next}/`);
      assert.ok(first !== -1 && first < evidence.indexOf('- '), `${slug} names its next playbook before the checklist`);
    }
  });
});

test('the legal and funding playbooks say what to ask counsel and never state a rule as the answer', () => {
  for (const slug of ['set-up-the-company', 'hire-your-first-team-member', 'run-your-first-outbound-sequence', 'prepare-for-investor-conversations']) {
    const text = raw(slug);
    assert.match(text, /does not give (?:legal|employment)/i, `${slug} says it gives no advice`);
    assert.match(text, /\bcounsel\b/);
    assert.doesNotMatch(text, /\byou (?:must|should) (?:form|incorporate|register|file|issue|sell)\b/i, `${slug} tells the reader what to file or form`);
  }
});

test('the investor playbook carries the funding disclaimer verbatim and never names the add-on', () => {
  const text = raw('prepare-for-investor-conversations');
  assert.ok(text.includes('WE makes no promise of funding.'));
  assert.doesNotMatch(text, /introductions?/i);
  assert.match(splitFrontmatter('x', text).body, /^This playbook does not give legal, tax or investment advice/m);
  assert.deepEqual(splitFrontmatter('x', text).data.claimsUsed, ['C-05']);
});

test('the hub page lists the order, keeps the disclaimer and promises no outcome', () => {
  const hub = read('src/content/pages/playbooks/index.mdx');
  assert.ok(hub.includes('WE makes no promise of funding.'));
  const { data } = splitFrontmatter('hub', hub);
  assert.ok(String(data.description).length >= 50 && String(data.description).length <= 160);
  assert.ok(String(data.description).length >= 50);
  for (const phrase of ['validate the problem', 'design the product', 'set up the company', 'build and ship version one', 'hire the first team member', 'price the product', 'earn the first customers', 'first outbound sequence', 'growth that repeats', 'prepare for investor conversations']) {
    assert.ok(hub.includes(phrase), `the hub names "${phrase}"`);
  }
  assert.ok(hub.indexOf('validate the problem') < hub.indexOf('design the product') && hub.indexOf('hire the first team member') < hub.indexOf('price the product'));
  for (const rule of FORBIDDEN) assert.doesNotMatch(plain(hub.split('---').slice(2).join('')), rule.re, rule.name);
  for (const sentence of sentencesOf(plain(hub))) assert.deepEqual(audit.scan(sentence, { route: '/playbooks/', plain: true, flagValues: {} }), [], sentence);
});

test('the hub and the trail read the chain from the registry and its live filter', () => {
  const index = read('src/pages/playbooks/index.astro');
  const trail = read('src/components/playbooks/PlaybookTrail.astro');
  const page = read('src/pages/playbooks/[slug].astro');
  assert.match(index, /liveSequence\(/);
  assert.match(trail, /liveSequence\(/);
  assert.match(page, /liveSequence\(/);
  assert.match(page, /nextLive\(/);
  assert.match(page, /slot="cta-end"/);
  assert.doesNotMatch(trail, /CellTrail/, 'the trail does not use the five-cell component');
  assert.match(trail, /aria-current=\{[^}]*'step'/);
});

// ---------------------------------------------------------------------------------------------------------------------------------
// The chain code
// ---------------------------------------------------------------------------------------------------------------------------------

const livePaths = (slugs: readonly string[]) => (path: string): boolean => slugs.some((s) => path === `/playbooks/${s}/`);

test('liveSequence keeps chain order and drops a playbook that is not live', () => {
  assert.deepEqual(liveSequence(livePaths(SLUGS)).map((p) => p.slug), SLUGS);
  assert.deepEqual(liveSequence(() => false), []);
  const five = ['validate-the-problem', 'design-the-product', 'build-and-ship-v1', 'earn-your-first-customers', 'build-repeatable-growth'];
  assert.deepEqual(liveSequence(livePaths([...five].reverse())).map((p) => p.slug), five, 'order comes from the registry, not from the predicate');
});

test('nextLive skips what is not live and ends at the terminal', () => {
  const five = ['validate-the-problem', 'design-the-product', 'build-and-ship-v1', 'earn-your-first-customers', 'build-repeatable-growth'];
  assert.equal(nextLive('design-the-product', livePaths(five))?.slug, 'build-and-ship-v1');
  assert.equal(nextLive('build-repeatable-growth', livePaths(five)), undefined);
  assert.equal(nextLive('design-the-product', livePaths(SLUGS))?.slug, 'set-up-the-company');
  assert.equal(nextLive('prepare-for-investor-conversations', livePaths(SLUGS)), undefined);
  assert.equal(nextLive('not-a-playbook', livePaths(SLUGS)), undefined);
  assert.equal(nextLive('set-up-the-company', livePaths(five)), undefined, 'a playbook outside the live chain has no next');
});

test('only the five original playbooks have a photo slot', () => {
  assert.deepEqual(PLAYBOOK_SEQUENCE.filter((p) => p.slot !== undefined).map((p) => p.slot), ['pb-1', 'pb-2', 'pb-3', 'pb-4', 'pb-5']);
});

test('artifactRefs lists the playbook templates, then tools, then briefs, and only names that the registries know', () => {
  for (const [slug, hrefs] of Object.entries(PLAYBOOK_TOOLS)) {
    assert.ok(SLUGS.includes(slug), `${slug} is a playbook`);
    for (const href of hrefs) assert.ok(TOOLS.some((t) => t.href === href), `${href} is a tool`);
  }
  for (const [slug, ids] of Object.entries(PLAYBOOK_BRIEFS)) {
    assert.ok(SLUGS.includes(slug));
    for (const id of ids) assert.ok(BRIEFS.entries.some((e) => e.slug === id), `${id} is a brief`);
  }
  for (const slug of SLUGS) {
    const library = (splitFrontmatter(slug, raw(slug)).data.relatedLibrary ?? []) as string[];
    for (const id of library) assert.ok(LIBRARY_REFS[id] !== undefined, `${id} is a template`);
    const refs = artifactRefs(slug, library);
    const hrefs = refs.map((r) => r.href);
    assert.equal(new Set(hrefs).size, hrefs.length, `${slug} links nothing twice`);
    const lastTemplate = Math.max(-1, ...library.map((id) => hrefs.indexOf(`/library/${id}/`)));
    const firstTool = hrefs.findIndex((h) => h.startsWith('/tools/'));
    if (firstTool !== -1) assert.ok(lastTemplate < firstTool, `${slug} lists templates before tools`);
    for (const ref of refs.filter((r) => r.title.startsWith('Brief: '))) assert.ok(BRIEFS.entries.some((e) => e.path === ref.href));
  }
  assert.deepEqual(artifactRefs('unknown', []), []);
  assert.deepEqual(artifactRefs('prepare-for-investor-conversations', ['seed-data-room-checklist']).map((r) => r.href).slice(0, 1), ['/library/seed-data-room-checklist/']);
});

test('the related reading of each playbook names real articles and one service line', () => {
  const mismatches: string[] = [];
  for (const slug of SLUGS) {
    const related = PLAYBOOK_RELATED[slug] ?? [];
    assert.ok(related.length >= 2, `${slug} has related reading`);
    for (const item of related) {
      const section = item.href.split('/')[1];
      const name = item.href.split('/')[2] ?? '';
      const file = section === 'services' ? `src/content/services/${name}.mdx` : resolveSlug(name);
      assert.ok(existsSync(join(root, file)), item.href);
      mismatches.push(...(item.title === splitFrontmatter(file, read(file)).data.title ? [] : [`${item.href}: "${item.title}" is "${String(splitFrontmatter(file, read(file)).data.title)}"`]));
      assert.notEqual(slugify(item.title), '');
    }
  }
  assert.deepEqual(mismatches, [], 'each related title is the title of its page');
});
