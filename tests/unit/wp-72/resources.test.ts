import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import * as claimsAudit from '../../../scripts/audit-claims.mjs';
import { DESK_DEFINITIONS, deskPath } from '../../../src/data/desks.ts';
import { BRIEFS, COMPARISONS, INDUSTRIES, SEGMENTS } from '../../../src/data/families.ts';
import { routes } from '../../../src/data/routes.ts';
import { kindGroups, liveGroups, metaLookup, RESOURCE_STRIP, RESOURCES_COPY, routeOfEntry, STATIC_META } from '../../../src/components/reference/resources.ts';
import type { LedgerRow, MetaEntry, ResourceGroup } from '../../../src/components/reference/resources.ts';
import { repoViewAt } from '../wp-60/repo-view.ts';
import { checkSentences } from '../wp-60/sources.ts';
import type { SourcesFile } from '../wp-60/sources.ts';
import { readDiskEntries, routeStateOnDisk } from './disk-meta.ts';
import { derivedSentences, derivedSources, ownedSentences } from './resources-copy.ts';

/**
 * The rebuilt Resources hub (WP-72). The hub lists only routes that are live (fail-closed, D-11), covers every live route of every
 * library family, takes each title and description from the page's own content entry, and never lists a route twice in the stage path.
 */
interface Hit {
  readonly rule: string;
  readonly match: string;
}
const audit = claimsAudit as unknown as { scan(text: string, options?: { route?: string; plain?: boolean; flagValues?: object }): Hit[] };

const root = new URL('../../../', import.meta.url).pathname;
const entries = readDiskEntries(root);
const meta = metaLookup(entries);
const ledger: readonly LedgerRow[] = routes;
/** The build's own route state, computed over the tree on disk: a route is live when it is launched and its page file and entry exist. */
const state = routeStateOnDisk(root);
const built = (path: string): boolean => state.isLive(path);
const pathsOf = (groups: readonly ResourceGroup[]): string[] => groups.flatMap((g) => g.items.map((i) => i.path));

// A fixture ledger: a few rows of each library-family layout, with one row of each that is not live.
const fixtureRows: readonly LedgerRow[] = [
  { path: '/library/one-page-problem-brief/', layout: 'TemplateLayout' },
  { path: '/library/hidden-template/', layout: 'TemplateLayout' },
  { path: '/playbooks/validate-the-problem/', layout: 'PlaybookLayout' },
  { path: '/fundability/safe-explained/', layout: 'GuideLayout' },
  { path: '/tools/team-composer/', layout: 'ToolLayout' },
  { path: '/tools/hidden-tool/', layout: 'ToolLayout' },
  { path: '/research/some-brief/', layout: 'BriefLayout' },
  { path: '/library/', layout: 'HubLayout' },
];
const fixtureMeta = metaLookup(
  [
    { collection: 'library', id: 'one-page-problem-brief', title: 'One-page problem brief', description: 'A page that states the problem.' },
    { collection: 'library', id: 'hidden-template', title: 'Hidden template' },
    { collection: 'playbooks', id: 'validate-the-problem', title: 'Validate the problem', description: 'Test the problem.' },
    { collection: 'guides', id: 'safe-explained', title: 'SAFE explained', description: 'What a SAFE is.' },
    { collection: 'research', id: 'some-brief', title: 'Some brief', description: 'A brief.' },
  ],
  { ...STATIC_META, '/tools/team-composer/': { title: 'Team composer' }, '/tools/hidden-tool/': { title: 'Hidden tool' }, '/tools/': { title: 'Tools' }, '/research/': { title: 'Research' }, '/playbooks/': { title: 'Playbooks' }, '/fundability/': { title: 'Fundability' } },
);

test('routeOfEntry maps each collection to its public route', () => {
  assert.equal(routeOfEntry('library', 'one-page-problem-brief'), '/library/one-page-problem-brief/');
  assert.equal(routeOfEntry('guides', 'safe-explained'), '/fundability/safe-explained/');
  assert.equal(routeOfEntry('playbooks', 'build-and-ship-v1'), '/playbooks/build-and-ship-v1/');
  assert.equal(routeOfEntry('research', 'x'), '/research/x/');
  assert.equal(routeOfEntry('pages', 'journey/index'), '/journey/');
  assert.equal(routeOfEntry('pages', 'program/how-it-works'), '/program/how-it-works/');
});

test('with nothing live, both lists are empty and the hub renders no group', () => {
  assert.deepEqual(liveGroups(() => false, fixtureMeta), []);
  assert.deepEqual(kindGroups(fixtureRows, () => false, fixtureMeta), []);
});

test('the stage path lists only live routes (the wp-08 contract holds)', () => {
  const only = liveGroups((p) => p === '/library/');
  assert.equal(only.length, 1);
  assert.equal(only[0]?.items[0]?.path, '/library/');
  const some = liveGroups((p) => p === '/journey/' || p === '/faq/', metaLookup([{ collection: 'pages', id: 'journey/index', title: 'The journey' }]));
  assert.deepEqual(pathsOf(some), ['/journey/', '/faq/']);
});

test('a route appears at most once across the stage path', () => {
  const paths = pathsOf(liveGroups(built, meta));
  assert.equal(new Set(paths).size, paths.length);
});

test('the kind lists carry exactly the live library-family routes of the fixture ledger, and nothing that is not live', () => {
  const live = new Set(['/library/', '/library/one-page-problem-brief/', '/playbooks/validate-the-problem/', '/fundability/safe-explained/', '/tools/', '/tools/team-composer/', '/research/some-brief/']);
  const groups = kindGroups(fixtureRows, (p) => live.has(p), fixtureMeta);
  const listed = pathsOf(groups);
  assert.deepEqual([...listed].sort(), [...live].sort());
  assert.ok(!listed.includes('/library/hidden-template/'));
  assert.ok(!listed.includes('/tools/hidden-tool/'));
  const templates = groups.find((g) => g.id === 'templates');
  assert.equal(templates?.items[0]?.path, '/library/', 'the hub is listed first');
});

test('a group with nothing live drops out, and a family with only its hub live still shows the hub', () => {
  const groups = kindGroups(fixtureRows, (p) => p === '/tools/' || p === '/tools/team-composer/', fixtureMeta);
  assert.deepEqual(groups.map((g) => g.id), ['tools']);
});

test('a live route with no title is a build error, not a blank card', () => {
  assert.throws(() => kindGroups([{ path: '/tools/untitled/', layout: 'ToolLayout' }], built, () => undefined), /no title/);
  assert.throws(() => liveGroups(built, () => undefined), /no title/);
});

test('a content entry wins over a static row for the same route', () => {
  const lookup = metaLookup([{ collection: 'pages', id: 'faq/index', title: 'Frequently asked' }]);
  assert.equal(lookup('/faq/')?.title, 'Frequently asked');
  assert.equal(lookup('/glossary/')?.title, 'Glossary');
});

test('against the real ledger and content, every live library-family route is listed (coverage)', () => {
  const groups = kindGroups(ledger, built, meta);
  const listed = new Set(pathsOf(groups));
  const families: ReadonlyArray<{ layout: string; prefix: string }> = [
    { layout: 'TemplateLayout', prefix: '/library/' },
    { layout: 'PlaybookLayout', prefix: '/playbooks/' },
    { layout: 'GuideLayout', prefix: '/fundability/' },
    { layout: 'ToolLayout', prefix: '/tools/' },
    { layout: 'BriefLayout', prefix: '/research/' },
  ];
  for (const { layout, prefix } of families) {
    const rows = ledger.filter((r) => r.layout === layout && r.path.startsWith(prefix) && r.path !== prefix && built(r.path));
    assert.ok(rows.length > 0, `the ledger has no ${layout} rows under ${prefix}`);
    for (const row of rows) assert.ok(listed.has(row.path), `${row.path} (${layout}) is missing from the kind lists`);
  }
  for (const desk of DESK_DEFINITIONS.filter((d) => built(deskPath(d.id)))) assert.ok(listed.has(deskPath(desk.id)), `${deskPath(desk.id)} is missing`);
  for (const family of [BRIEFS, SEGMENTS, INDUSTRIES, COMPARISONS]) for (const entry of family.entries.filter((e) => built(e.path))) assert.ok(listed.has(entry.path), `${entry.path} is missing`);
});

test('against the real content, every stage-path route has a title and is a ledger route', () => {
  const known = new Set(ledger.map((r) => r.path));
  for (const group of liveGroups(built, meta)) {
    assert.ok(group.items.length > 0);
    for (const item of group.items) {
      assert.ok(known.has(item.path), `${item.path} is not a ledger route`);
      assert.ok(item.title.length > 0);
    }
  }
});

test('every title and description comes from the page it links to (no drift)', () => {
  const byRoute = new Map<string, MetaEntry>(entries.map((e) => [routeOfEntry(e.collection, e.id), e]));
  for (const group of [...liveGroups(built, meta), ...kindGroups(ledger, built, meta)]) {
    for (const item of group.items) {
      const entry = byRoute.get(item.path);
      if (entry === undefined) continue;
      assert.equal(item.title, entry.title, item.path);
      assert.equal(item.description, entry.description, item.path);
    }
  }
});

test('no sentence of the hub trips the claims denylist', () => {
  const texts: string[] = [
    ...Object.values(RESOURCES_COPY).flatMap((v) => (typeof v === 'string' ? [v] : Object.values(v))),
    ...RESOURCE_STRIP.map((i) => i.title),
  ];
  for (const group of [...liveGroups(built, meta), ...kindGroups(ledger, built, meta)]) {
    texts.push(group.title, ...(group.intro === undefined ? [] : [group.intro]));
    for (const item of group.items) texts.push(item.title, ...(item.description === undefined ? [] : [item.description]));
  }
  for (const text of new Set(texts)) {
    const hits = audit.scan(text, { route: '/resources/', plain: true, flagValues: {} });
    assert.deepEqual(hits.map((h) => h.rule), [], `"${text}"`);
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------
// The sentence ledger (.astro-magazine/sources/wp-72.json, document src/components/reference/resources.ts)
// ---------------------------------------------------------------------------------------------------------------------------------

const HUB = 'src/components/reference/resources.ts';
const sources = JSON.parse(readFileSync(join(root, '.astro-magazine/sources/wp-72.json'), 'utf8')) as SourcesFile;
const hubRows = sources.documents?.find((d) => d.path === HUB)?.sentences ?? [];
const mapped = new Set(hubRows.map((r) => r.text));

test('the hub is a document of the WP-72 sources file and every mapping is well formed', () => {
  assert.ok(hubRows.length > 0, `${HUB} is not in the WP-72 sources file`);
  assert.deepEqual(checkSentences('WP-72', HUB, hubRows, repoViewAt(root)), []);
});

test('every sentence the hub owns is mapped, and no owned mapping is stale', () => {
  const owned = ownedSentences();
  const missing = owned.filter((text) => !mapped.has(text));
  assert.deepEqual(missing, [], `Unmapped in ${HUB}. Add each to .astro-magazine/sources/wp-72.json:\n${missing.map((m) => `  ${JSON.stringify(m)}`).join('\n')}`);
  const derived = new Set(derivedSentences(entries, ledger, built).map((d) => d.text));
  const sources = derivedSources(entries);
  const stale = hubRows.filter((r) => !owned.includes(r.text) && !derived.has(r.text) && !(r.page !== undefined && sources.has(r.page.replace(/#.*$/, ''))));
  assert.deepEqual(stale.map((r) => r.text), [], 'Stale rows: a mapped sentence the hub no longer shows');
});

test('every title and description the hub reads from another page is mapped to the file it came from', () => {
  for (const item of derivedSentences(entries, ledger, built)) {
    const row = hubRows.find((r) => r.text === item.text);
    // A sentence the hub also owns keeps the owned mapping; one a later package adds is accepted only when its own file holds it.
    if (row === undefined) {
      assert.ok(readFileSync(join(root, item.page), 'utf8').includes(item.text) || item.page.endsWith('.ts'), `"${item.text}" is not in ${item.page}`);
    } else if (!ownedSentences().includes(item.text)) {
      assert.equal(row.page, item.page, `"${item.text}" maps to ${row.page}, but it comes from ${item.page}`);
    }
  }
});

test('the hub states no duration, in its own copy or in the descriptions it shows', () => {
  const unit = '(?:hours?|days?|weeks?|months?|quarters?|years?)';
  const patterns = [new RegExp(`\\d+\\s*[-\\u2013]?\\s*${unit}\\b`, 'i'), /\b30\s*[/-]\s*60\s*[/-]\s*90\b/];
  const texts = [...ownedSentences(), ...derivedSentences(entries, ledger, built).map((d) => d.text)];
  for (const text of texts) for (const pattern of patterns) assert.doesNotMatch(text, pattern, `"${text}"`);
});
