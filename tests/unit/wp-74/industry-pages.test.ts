import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { SCOPE_HEADING, SCOPE_ITEMS } from '../../../src/components/industries/scope-copy.ts';
import { TITLE_MAX } from '../../../src/lib/seo.ts';
import { site } from '../../../src/data/site.ts';
import { allPagePaths, bodyParagraphs, FOLDER, familyOf, HUB_PATH, industrySlugs, pageFile, pagePath, pageText, parsedPage, root } from './pages.ts';

/**
 * WP-74: the seven industry pages and the /industries/ hub. The build parses the same frontmatter; these tests bring a failure to the unit
 * stage and pin what the package promised: one file per registry entry, a perimeter whose every item names its jurisdiction, its date and a
 * source, a body that adds no heading, link or markup of its own, and copy that states no amount, no outcome and nothing about WE but the seat scope.
 */

test('the folder holds one page per registry entry and the hub, and nothing else', () => {
  const files = readdirSync(join(root, FOLDER)).sort();
  assert.deepEqual(files, [...industrySlugs.map((s) => `${s}.mdx`), 'index.mdx'].sort());
});

test('the registry names the seven verticals of the plan', () => {
  assert.deepEqual([...industrySlugs].sort(), ['climate-tech', 'edtech', 'fintech', 'healthtech', 'legaltech', 'logistics', 'proptech']);
});

test('every page parses under the pages schema; the hub carries no family object and each vertical carries its own', () => {
  for (const path of allPagePaths) {
    const { data } = parsedPage(path);
    assert.equal(data.draft, false, `${path} is a draft`);
    assert.deepEqual(data.claimsUsed, ['C-29'], `${path} cites exactly the claim its scope sentence restates`);
    if (path === HUB_PATH) assert.equal(data.family, undefined, 'the hub has no family object');
    else assert.equal(familyOf(path).slug, path.split('/').pop()?.replace(/\.mdx$/, ''), `${path} names its own slug`);
  }
});

test('every title fits the 60-character document title once the site suffix is added, and sets no seoTitle the family templates would ignore', () => {
  const room = TITLE_MAX - ` | ${site.titleSuffix}`.length;
  for (const path of allPagePaths) {
    const { data } = parsedPage(path);
    assert.ok(data.title.length <= room, `${path}: title is ${data.title.length} characters, room is ${room}`);
    assert.equal(data.seoTitle, undefined, `${path}: the family templates pass title, not seoTitle, to the layout`);
  }
});

test('the seat scope component carries no <style> block: an MDX page emits it as an inline style the page CSP does not hash', () => {
  const source = readFileSync(join(root, 'src/components/industries/SeatScope.astro'), 'utf8');
  assert.doesNotMatch(source, /^<style[\s>]/m);
});

test('each perimeter item names a jurisdiction, a date and a source of its page, and the date is the day the source was read', () => {
  for (const slug of industrySlugs) {
    const family = familyOf(pagePath(slug));
    const byId = new Map(family.sources.map((s) => [s.id, s]));
    const distinct = new Set(family.sources.map((s) => s.url));
    assert.ok(distinct.size >= 2, `${slug} has ${distinct.size} distinct sources`);
    for (const item of family.perimeter) {
      const source = byId.get(item.sourceId);
      assert.ok(source, `${slug}: ${item.title} names ${item.sourceId}, which is not in its sources`);
      assert.equal(item.asOf.toISOString().slice(0, 10), source.accessed.toISOString().slice(0, 10), `${slug}: ${item.title} is dated differently from its source`);
      assert.ok(item.jurisdiction.trim() !== '', `${slug}: ${item.title} has no jurisdiction`);
    }
    const used = new Set(family.perimeter.map((p) => p.sourceId));
    assert.deepEqual([...byId.keys()].filter((id) => !used.has(id)), [], `${slug} lists a source no perimeter item uses`);
  }
});

test('a jurisdiction stays short: it renders as a badge that never wraps, and a long one pushes the perimeter list past a 320px screen', () => {
  for (const slug of industrySlugs) {
    for (const item of familyOf(pagePath(slug)).perimeter) {
      assert.ok(item.jurisdiction.length <= 30, `${slug}: "${item.jurisdiction}" is ${item.jurisdiction.length} characters`);
    }
  }
});

test('every source is a government or standards publisher on https, and the title says what was read', () => {
  for (const slug of industrySlugs) {
    for (const source of familyOf(pagePath(slug)).sources) {
      assert.match(source.url, /^https:\/\//, `${slug}: ${source.id}`);
      assert.ok(source.title.length >= 10, `${slug}: ${source.id} needs a title that names the instrument`);
      assert.ok(source.publisher.length >= 3, `${slug}: ${source.id} needs a publisher`);
    }
  }
});

test('a body is the scope import, two short paragraphs and the scope component: no heading, link, image or raw HTML of its own', () => {
  for (const path of allPagePaths) {
    const { body } = pageFile(path);
    const lines = body.split('\n').map((l) => l.trim()).filter((l) => l !== '');
    const imports = lines.filter((l) => l.startsWith('import '));
    assert.deepEqual(imports, ["import SeatScope from '../../../components/industries/SeatScope.astro';"], `${path} imports only the scope component`);
    assert.equal(lines.filter((l) => l.startsWith('<SeatScope')).length, 1, `${path} places the scope component once`);
    assert.ok(body.trimEnd().endsWith('<SeatScope />'), `${path} ends with the scope component`);
    assert.doesNotMatch(body, /^#{1,6}\s/m, `${path} adds a heading of its own`);
    assert.doesNotMatch(body, /\]\(|<a\s|<img|<script|<iframe|MaybeLink/, `${path} links or embeds something`);
    const paragraphs = bodyParagraphs(body);
    assert.ok(paragraphs.length >= 2 && paragraphs.length <= 3, `${path} has ${paragraphs.length} body paragraphs`);
  }
});

test('the copy states no amount, percentage, count, price or promise of speed', () => {
  for (const path of allPagePaths) {
    const text = pageText(path);
    assert.doesNotMatch(text, /[$€£]|%|\bpercent\b|\bper cent\b/i, `${path}: an amount or a rate`);
    assert.doesNotMatch(text, /\b\d+\s*(?:hours?|days?|weeks?|months?)\b.*\b(?:reply|respond|response|answer)/i, `${path}: a response-time promise`);
    assert.doesNotMatch(text, /\b(?:\d+ applications|applications received|acceptance rate|acceptance|accepted)\b/i, `${path}: an application count or an acceptance rate`);
  }
});

test('the copy never uses the words the brief bans, and has no first-person plural', () => {
  const banned = /\b(?:free|freely|perks?|accelerators?|cohorts?|mentors?|success fees?|no fees?|no equity|no stake|free of charge)\b/i;
  const firstPerson = /\b(?:[Oo]ur|[Oo]urs|[Ww]e|us)\b/;
  for (const path of allPagePaths) {
    assert.doesNotMatch(pageText(path), banned, `${path} uses a banned word`);
    assert.doesNotMatch(pageText(path), firstPerson, `${path} speaks in the first person`);
  }
  for (const item of SCOPE_ITEMS) {
    assert.doesNotMatch(item.text, banned, `scope: ${item.text}`);
    assert.doesNotMatch(item.text, firstPerson, `scope: ${item.text}`);
  }
  assert.doesNotMatch(SCOPE_HEADING, banned);
});

test('the pages describe considerations and name no WE company, client, result or product', () => {
  for (const path of allPagePaths) {
    const text = pageText(path);
    assert.doesNotMatch(text, /\bWE\b/, `${path} speaks about WE outside the scope component`);
    assert.doesNotMatch(text, /\b(?:case stud(?:y|ies)|portfolio|testimonials?|success stor(?:y|ies)|trusted by|used by)\b/i, `${path} names a case, a portfolio or a testimonial`);
  }
});

test('no page says that anything is certified, approved, guaranteed or compliant by WE or by a seat', () => {
  for (const path of allPagePaths) {
    assert.doesNotMatch(pageText(path), /\b(?:certified|certification of WE|approved by|guarantee[sd]?|guaranteed|we comply|is compliant|are compliant)\b/i, `${path}`);
  }
});

test('the scope component states what a seat builds and the five limits, in plain sentences', () => {
  const text = SCOPE_ITEMS.map((i) => i.text);
  assert.equal(SCOPE_ITEMS.length, 7);
  assert.ok(text.some((t) => /digital incubator for SaaS companies/.test(t)));
  assert.ok(text.some((t) => /builds SaaS software/.test(t) && /pilot/.test(t)));
  assert.ok(text.some((t) => /does not run a live service/.test(t)));
  assert.ok(text.some((t) => /does not store or process restricted or regulated data/.test(t)));
  assert.ok(text.some((t) => /no assurance/.test(t) && /audit/.test(t) && /certification/.test(t)));
  assert.ok(text.some((t) => /does not give legal, tax, accounting, insurance or compliance advice/.test(t)));
  assert.ok(text.some((t) => /founder.s own counsel/.test(t)));
  assert.equal(new Set(text).size, text.length, 'no repeated sentence');
  assert.ok(SCOPE_HEADING.split(/\s+/).length <= 7, 'the heading is a short label');
});

test('the perimeter text of each item stays inside the schema limits with room to spare for a later edit', () => {
  for (const slug of industrySlugs) {
    const family = familyOf(pagePath(slug));
    assert.ok(family.perimeter.length >= 3 && family.perimeter.length <= 6, `${slug}: perimeter count`);
    assert.ok(family.dataQuestions.length >= 3 && family.dataQuestions.length <= 6, `${slug}: data question count`);
    for (const item of family.perimeter) assert.ok(item.text.length <= 400, `${slug}: ${item.title}`);
    for (const question of family.dataQuestions) assert.match(question, /\?$/, `${slug}: a data question ends with a question mark`);
  }
});
