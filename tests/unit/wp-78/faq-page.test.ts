import assert from 'node:assert/strict';
import test from 'node:test';
import { anchorId, faqPageNode } from '../../../src/components/reference/jsonld.ts';
import { SECTIONS, SEE_ALSO_TITLES, buildSections, jumpLinks, slugify } from '../../../src/pages/faq/_model.ts';
import type { FaqEntry } from '../../../src/pages/faq/_model.ts';
import { liveRoutesAt } from '../wp-60/live-routes.ts';
import { faqRows, read, root } from './faq.ts';

/**
 * What the FAQ page builds from the data (WP-78, docs/wave8-contracts.md section 8.4): audience first, then topic, with unique anchors, a
 * fail-closed "Read more" line and one JSON-LD Question per entry. The model is pure, so the test builds the sections the page builds.
 */
const entries: FaqEntry[] = faqRows()
  .filter((row) => !row.draft)
  .map((row) => ({ id: row.id, question: row.question, answer: row.answer, group: row.group, audience: row.audience, seeAlso: row.seeAlso }));

const none = (): boolean => false;
const all = (): boolean => true;
const live = liveRoutesAt(root);
const isLive = (path: string): boolean => live.has(path);

const sectionsNone = buildSections(entries, none);

test('the sections come in the reading order: everyone, startups, investors, partners, corporate teams', () => {
  assert.deepEqual(SECTIONS.map((s) => s.id), ['general', 'startup', 'investor', 'partner', 'corporate']);
  assert.deepEqual(sectionsNone.map((s) => s.label), ['For everyone', 'For startups', 'For investors', 'For partners', 'For corporate teams']);
});

test('every entry appears exactly once, in the section of its audience', () => {
  const seen = sectionsNone.flatMap((section) => section.groups.flatMap((g) => g.items.map((item) => ({ id: item.id, section: section.id }))));
  assert.deepEqual(seen.map((s) => s.id).sort(), entries.map((e) => e.id).sort());
  for (const { id, section } of seen) assert.equal(entries.find((e) => e.id === id)?.audience ?? 'general', section, id);
});

test('the original groups keep the ids they have always had, so a saved link to a question still works', () => {
  const general = sectionsNone.find((s) => s.id === 'general');
  assert.ok(general !== undefined);
  const about = general.groups.find((g) => g.slug === 'about-we');
  assert.ok(about !== undefined, 'the "About WE" group lost its slug');
  assert.equal(`faq-group-${about.slug}`, 'faq-group-about-we');
  assert.equal(anchorId('faq', 'not-for'), 'faq-not-for');
});

test('every anchor, group id and accordion name on the page is unique', () => {
  const names = sectionsNone.flatMap((section) => [section.slug, ...section.groups.flatMap((g) => [`faq-group-${g.slug}`, `faq-${g.slug}`, ...g.items.map((i) => anchorId('faq', i.id))])]);
  assert.deepEqual(names.filter((n, i) => names.indexOf(n) !== i), []);
});

test('a topic two audiences share does not collide: the audience leads the slug', () => {
  const shared = buildSections(
    [
      { id: 'a', question: 'A?', answer: 'A.', group: 'What WE does and does not do', audience: 'investor', seeAlso: [] },
      { id: 'b', question: 'B?', answer: 'B.', group: 'What WE does and does not do', audience: 'corporate', seeAlso: [] },
    ],
    none,
  );
  assert.deepEqual(shared.flatMap((s) => s.groups.map((g) => g.slug)), ['investor-what-we-does-and-does-not-do', 'corporate-what-we-does-and-does-not-do']);
});

test('the model throws when two entries would share an anchor', () => {
  const twice = [
    { id: 'x', question: 'X?', answer: 'X.', group: 'One', seeAlso: [] },
    { id: 'x', question: 'Y?', answer: 'Y.', group: 'One', seeAlso: [] },
  ];
  assert.throws(() => buildSections(twice, none), /twice/);
});

test('a section with no entry is left out', () => {
  const onlyStartup = buildSections([{ id: 's', question: 'S?', answer: 'S.', group: 'G', audience: 'startup', seeAlso: [] }], none);
  assert.deepEqual(onlyStartup.map((s) => s.id), ['startup']);
});

test('"Read more" is fail-closed: with no live route there are no links', () => {
  for (const section of sectionsNone) for (const g of section.groups) assert.deepEqual(g.seeAlso, [], g.slug);
});

test('"Read more" shows only live routes, once each, with the title of the page', () => {
  const sections = buildSections(entries, isLive);
  for (const section of sections) {
    for (const g of section.groups) {
      const paths = g.seeAlso.map((l) => l.href);
      assert.deepEqual(paths.filter((p, i) => paths.indexOf(p) !== i), [], `${g.slug} repeats a link`);
      for (const link of g.seeAlso) {
        assert.ok(isLive(link.href), `${g.slug} links ${link.href}, which is not live`);
        assert.equal(link.title, SEE_ALSO_TITLES[link.href]);
      }
    }
  }
  const linked = new Set(sections.flatMap((s) => s.groups.flatMap((g) => g.seeAlso.map((l) => l.href))));
  assert.ok(linked.has('/program/how-it-works/'), 'a live page is not linked');
  // WP-44 (2e08abf) put /investors/interest/ on demo after WP-78 branched, so the line follows the route's state instead of assuming it
  // has no page: linked exactly when live. The fail-closed case with no live route at all is the test above.
  assert.equal(linked.has('/investors/interest/'), isLive('/investors/interest/'), 'the investor interest link does not follow its route');
});

test('a live route with no link title is an error, never a bare-path link', () => {
  const lost = [{ id: 'l', question: 'L?', answer: 'L.', group: 'G', seeAlso: ['/no-such-page/'] }];
  assert.throws(() => buildSections(lost, all), /no title/);
});

test('the jump list has one in-page link per section, each pointing at a heading that exists', () => {
  const jump = jumpLinks(sectionsNone);
  assert.deepEqual(jump.map((j) => j.href), sectionsNone.map((s) => `#${s.slug}`));
  assert.deepEqual(jump.map((j) => j.label), sectionsNone.map((s) => s.label));
  assert.equal(slugify('For corporate teams'), 'for-corporate-teams');
});

test('the page JSON-LD has one Question per entry, in the order the page shows them', () => {
  const items = sectionsNone.flatMap((s) => s.groups.flatMap((g) => g.items));
  const node = faqPageNode('/faq/', items) as { mainEntity: { '@type': string; '@id': string; name: string }[] };
  assert.equal(node.mainEntity.length, entries.length);
  assert.ok(node.mainEntity.every((q) => q['@type'] === 'Question'));
  assert.deepEqual(node.mainEntity.map((q) => q.name), items.map((i) => i.question));
  const ids = node.mainEntity.map((q) => q['@id']);
  assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), []);
});

test('the page source keeps what other tests and the sitemap pin, and needs no JavaScript', () => {
  const page = read('src/pages/faq/index.astro');
  assert.match(page, /import FaqList from '\.\.\/\.\.\/components\/cards\/FaqList\.astro'/);
  assert.ok(page.includes('name={`faq-${g.slug}`}'));
  assert.ok(page.includes("anchorId('faq', item.id)"));
  assert.ok(page.includes("faqPageNode('/faq/', items)"));
  assert.match(page, /title="FAQ"/);
  assert.match(page, /path="\/faq\/"/);
  assert.match(page, /description="Short, plain answers about World Enterprise Incubator: what a seat is, how the remote model works, what WE does not do, and how to apply\."/);
  assert.doesNotMatch(page, /<script/, 'the page works without JavaScript and adds none');
});

test('the jump list is a navigation landmark of plain anchor links with its own label', () => {
  const page = read('src/pages/faq/index.astro');
  assert.match(page, /<nav class="faq-jump" aria-label="Jump to a set of questions">/);
  assert.match(page, /<a href=\{link\.href\}>\{link\.label\}<\/a>/);
  const nav = /<nav class="faq-jump"[\s\S]*?<\/nav>/.exec(page)?.[0] ?? '';
  assert.doesNotMatch(nav, /<button|onclick|tabindex/i, 'the jump list needs no widget: anchors are keyboard-operable');
  assert.match(page, /min-block-size: 2\.75rem/, 'a jump link keeps a touch target of at least 44px');
});
