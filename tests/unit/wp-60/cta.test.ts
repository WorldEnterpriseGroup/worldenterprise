import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { markdownToHtml } from 'satteri';
import type { HastNode } from 'satteri';
import * as claimsAudit from '../../../scripts/audit-claims.mjs';
import { AUDIENCE_LINKS } from '../../../src/data/cta/audiences.ts';
import { allKeys, ctaForTarget, findSurface, resolveCta, resolveMidCta, SURFACES, targetFor } from '../../../src/data/cta/index.ts';
import type { CtaCollection, CtaModel, ResolveInput, TargetKey } from '../../../src/data/cta/index.ts';
import { DESKS } from '../../../src/data/desks.ts';
import { AUDIENCES, BRIEFS, FAMILIES, familyPaths } from '../../../src/data/families.ts';
import { routes } from '../../../src/data/routes.ts';
import { listInsightFiles } from '../../../src/lib/content-files.ts';
import { isDraftFile } from '../../../src/data/cta/live.ts';
import { FORM_NOTICES } from '../../../src/components/forms/copy.ts';
import { createMidCtaPlugin, findAnchor, inputFromFile, midCtaNode, MID_CTA_MIN_WORDS, placeMidCta, wordCount } from '../../../src/lib/rehype-mid-cta.ts';
import type { MidCtaContext } from '../../../src/lib/rehype-mid-cta.ts';

/**
 * The CTA skeleton (docs/wave8-contracts.md, section 6): the default map covers every surface, every target is a launched route and says
 * honest things, a dead target is dropped, and the mid-body plugin puts one band where the contract says and nowhere else.
 */
const root = new URL('../../../', import.meta.url).pathname;
const live = (): boolean => true;
const only =
  (...paths: string[]) =>
  (path: string): boolean =>
    paths.includes(path);

interface AuditModule {
  scan(text: string, options?: { route?: string }): { rule: string }[];
}
const audit = claimsAudit as unknown as AuditModule;

const ledger = new Map(routes.map((r) => [r.path, r]));
const insightDesk = new Map(listInsightFiles(root).map((f) => [f.slug, f.desk]));

/** The collection that serves a ledger path, as the layout of that page declares it. */
function inputFor(path: string): ResolveInput {
  const part = (index: number): string => path.split('/')[index] ?? '';
  const one = (collection: CtaCollection): ResolveInput => ({ path, collection });
  switch (part(1)) {
    case 'insights':
      if (part(2) === 'topic' || path === '/insights/') return one('pages');
      return { path, collection: 'insights', topic: insightDesk.get(part(2)) ?? 'funding' };
    case 'playbooks':
      return part(2) === '' ? one('pages') : one('playbooks');
    case 'fundability':
      return part(2) === '' ? one('pages') : one('guides');
    case 'services':
      return part(2) === '' ? one('pages') : one('services');
    case 'library':
      return part(2) === '' ? one('pages') : one('library');
    case 'research':
      return part(2) === '' ? one('pages') : one('research');
    default:
      return one('pages');
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Targets and copy
// ---------------------------------------------------------------------------------------------------------------------------------

test('every target of the default map is a launched ledger route', () => {
  for (const key of allKeys()) {
    const target = targetFor(key);
    assert.ok(target !== undefined, `${key} names no target`);
    const row = ledger.get(target.href);
    assert.ok(row !== undefined, `${key}: ${target.href} is not in the route ledger`);
    // A desk topic page is launched once its desk holds an article; the resolver drops it until then, so only its row is required.
    if (!target.href.startsWith('/insights/topic/')) assert.equal(row.launch, true, `${key}: ${target.href} is not launched`);
  }
});

test('every brief in the registry has a target, and an unknown brief has none', () => {
  for (const entry of BRIEFS.entries) assert.equal(targetFor(`brief:${entry.slug}`)?.href, entry.path);
  assert.equal(targetFor('brief:no-such-brief'), undefined);
  assert.equal(targetFor('path:/not-listed/'), undefined);
});

test('the copy follows the policy: sentence case, at most 70 characters in a heading, no urgency, no scarcity, no outcome promised', () => {
  const urgency = /\b(limited|hurry|last chance|don'?t miss|spots? left|seats? left|only \d|ends (?:soon|today)|act now|today only|now or never|free|guarantee|exclusive|join \d|\d+ (?:founders|startups|companies))\b|!/i;
  for (const key of allKeys()) {
    const target = targetFor(key);
    assert.ok(target !== undefined);
    assert.ok(target.label.length > 0 && target.label.length <= 40, `${key}: the label "${target.label}" is empty or long`);
    assert.doesNotMatch(target.label, urgency, `${key}: the label reads as pressure`);
    const band = target.band;
    if (band === undefined) continue;
    assert.ok(band.heading.length <= 70, `${key}: the heading is ${band.heading.length} characters`);
    assert.match(band.heading, /^[A-Z]/, `${key}: the heading starts with a capital`);
    assert.doesNotMatch(band.heading, /[.!]$/, `${key}: no full stop or exclamation mark ends a heading`);
    for (const text of [band.heading, band.body, band.note ?? '']) assert.doesNotMatch(text, urgency, `${key}: "${text}" reads as pressure`);
    assert.ok(band.body.split(/(?<=[.!?])\s+/).length <= 2, `${key}: the body is one or two sentences`);
  }
});

test('no sentence of a target trips the claims denylist', () => {
  for (const key of allKeys()) {
    const target = targetFor(key);
    assert.ok(target !== undefined);
    const texts = [target.label, target.band?.heading, target.band?.body, target.band?.note].filter((t): t is string => t !== undefined);
    for (const text of texts) assert.deepEqual(audit.scan(text, { route: target.href }), [], `${key}: "${text}"`);
  }
  for (const link of AUDIENCE_LINKS) assert.deepEqual(audit.scan(`${link.label}. ${link.text}`, { route: '/' }), [], link.label);
});

test('the funding qualifier is the one the forms use, and only the funding briefs carry it', () => {
  assert.equal(targetFor('brief:funding-paths')?.band?.note, FORM_NOTICES.noFunding);
  assert.equal(targetFor('brief:pre-seed-evidence-pack')?.band?.note, FORM_NOTICES.noFunding);
  assert.equal(targetFor('brief:company-setup')?.band?.note, undefined);
  assert.equal(targetFor('apply')?.band?.note, undefined);
});

test('the audience strip names the four audiences and each door is a launched route', () => {
  assert.deepEqual(AUDIENCE_LINKS.map((l) => l.audience), [...AUDIENCES]);
  for (const link of AUDIENCE_LINKS) assert.equal(ledger.get(link.href)?.launch, true, `${link.href} is not a launched route`);
});

// ---------------------------------------------------------------------------------------------------------------------------------
// The default map
// ---------------------------------------------------------------------------------------------------------------------------------

test('every row of the map is well formed: known keys, a primary that can carry a band, at most one secondary slot filled', () => {
  const ids = SURFACES.map((s) => s.id);
  assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), [], 'a row id is used twice');
  for (const rule of SURFACES) {
    for (const key of [...rule.primary, ...rule.secondary, ...(rule.mid !== undefined ? [rule.mid] : [])]) assert.ok(targetFor(key) !== undefined, `${rule.id}: ${key} names no target`);
    if (rule.primary.length > 0) {
      assert.ok(rule.primary.some((k) => targetFor(k)?.band !== undefined), `${rule.id}: no primary candidate can carry a band`);
      const [only, ...others] = rule.primary;
      assert.ok(others.length > 0 || !rule.secondary.includes(only as TargetKey), `${rule.id}: the secondary repeats the only primary`);
    } else {
      assert.equal(rule.secondary.length, 0, `${rule.id}: a surface with no band has no secondary`);
      assert.equal(rule.mid, undefined, `${rule.id}: a surface with no band has no mid band`);
    }
    if (rule.mid !== undefined) assert.ok(targetFor(rule.mid)?.band !== undefined, `${rule.id}: the mid target carries no band`);
  }
});

test('every ledger route and every registry family entry has a row of its own, not the layout default', () => {
  const paths = new Set<string>([...routes.map((r) => r.path), ...FAMILIES.flatMap((f) => familyPaths(f))]);
  const famous = new Set(FAMILIES.flatMap((f) => familyPaths(f)));
  for (const path of [...paths].filter((p) => (p.endsWith('/') || p === '/404.html') && (famous.has(p) || ledger.get(p)?.launch === true))) {
    const found = findSurface(inputFor(path));
    assert.equal(found.fallback, false, `${path} has no row in the CTA map (src/data/cta/map.ts)`);
  }
});

test('every desk has an article row, and the brief of the desk comes first where the contract names one', () => {
  const expected: Readonly<Record<string, string | undefined>> = {
    funding: 'brief:funding-paths',
    legal: 'brief:company-setup',
    team: 'brief:first-hires',
    ai: 'brief:ai-native-build',
    gtm: 'brief:first-100-customers',
    grow: 'brief:first-100-customers',
    dream: 'brief:first-100-customers',
    models: 'brief:first-100-customers',
    fundable: 'brief:pre-seed-evidence-pack',
    starting: 'brief:company-setup',
    pathways: 'brief:funding-paths',
    build: 'brief:ai-native-build',
    sectors: 'apply',
    ops: 'tools',
  };
  assert.deepEqual(Object.keys(expected).sort(), [...DESKS].sort());
  for (const desk of DESKS) {
    const { rule, fallback } = findSurface({ path: '/insights/x/', collection: 'insights', topic: desk });
    assert.equal(fallback, false);
    assert.equal(rule.primary[0], expected[desk], desk);
    assert.equal(rule.mid, 'apply', `${desk}: an article has the Apply mid band`);
  }
});

test('the form pages, the thanks pages, the legal pages and the machine pages have no band', () => {
  const none = ['/legal/privacy/', '/legal/accessibility/', '/apply/', '/apply/thanks/', '/contact/', '/newsletter/', '/search/', '/styleguide/', '/sitemap/', '/404.html', '/briefs/thanks/', '/briefs/funding-paths/', '/investors/interest/', '/investors/interest/thanks/', '/network/partners/enquire/', '/network/partners/enquire/thanks/'];
  for (const path of none) assert.equal(resolveCta({ path, collection: 'pages' }, live), null, path);
  assert.equal(resolveCta({ path: '/briefs/funding-paths/', collection: 'briefs' }, live), null);
  assert.equal(resolveCta({ path: '/briefs/', collection: 'pages' }, live)?.primary.href, '/apply/', 'the briefs hub keeps its band');
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------------------------------------------------------------

test('the home page offers Apply and the brief hub', () => {
  const model = resolveCta({ path: '/', collection: 'pages' }, live);
  assert.ok(model !== null);
  assert.equal(model.id, 'apply');
  assert.equal(model.audience, 'startup');
  assert.equal(model.variant, 'apply');
  assert.deepEqual(model.primary, { label: 'Start a readiness review', href: '/apply/' });
  assert.deepEqual(model.secondary, { label: 'Browse the briefs', href: '/briefs/' });
});

test('a funding article offers its brief with the funding qualifier, and falls back to Apply while the brief is not live', () => {
  const input: ResolveInput = { path: '/insights/safe-notes/', collection: 'insights', topic: 'funding' };
  const withBrief = resolveCta(input, live);
  assert.ok(withBrief !== null);
  assert.equal(withBrief.id, 'brief:funding-paths');
  assert.equal(withBrief.primary.href, '/briefs/funding-paths/');
  assert.equal(withBrief.secondary?.href, '/apply/');
  assert.equal(withBrief.note, FORM_NOTICES.noFunding);

  const cut = resolveCta(input, only('/apply/'));
  assert.ok(cut !== null);
  assert.equal(cut.id, 'apply');
  assert.equal(cut.primary.href, '/apply/');
  assert.equal(cut.secondary, undefined, 'a secondary equal to the primary is dropped');
  assert.equal(cut.note, undefined);
});

test('a dead target is dropped: no live primary is no band, a dead secondary is no secondary', () => {
  assert.equal(resolveCta({ path: '/', collection: 'pages' }, () => false), null);
  assert.equal(resolveCta({ path: '/', collection: 'pages' }, only('/briefs/')), null, 'a live secondary cannot stand in for a missing primary');
  const withoutSecondary = resolveCta({ path: '/', collection: 'pages' }, only('/apply/'));
  assert.equal(withoutSecondary?.secondary, undefined);
  assert.equal(withoutSecondary?.primary.href, '/apply/');
});

test('the frontmatter override replaces the primary, or the secondary on a founder segment page', () => {
  const article = resolveCta({ path: '/insights/x/', collection: 'insights', topic: 'ops', frontmatterCta: { variant: 'brief', briefId: 'first-hires' } }, live);
  assert.equal(article?.primary.href, '/briefs/first-hires/');
  assert.equal(article?.secondary?.href, '/apply/');
  const segment = resolveCta({ path: '/founders/solo-founders/', collection: 'pages', frontmatterCta: { variant: 'brief', briefId: 'first-100-customers' } }, live);
  assert.equal(segment?.primary.href, '/apply/');
  assert.equal(segment?.secondary?.href, '/briefs/first-100-customers/');
  const plain = resolveCta({ path: '/founders/solo-founders/', collection: 'pages' }, live);
  assert.equal(plain?.secondary?.href, '/briefs/');
  const dead = resolveCta({ path: '/insights/x/', collection: 'insights', topic: 'ops', frontmatterCta: { variant: 'brief', briefId: 'first-hires' } }, only('/tools/', '/apply/'));
  assert.equal(dead?.primary.href, '/tools/', 'an override whose brief is not live falls back to the surface default');
});

test('the audiences of the surfaces: investors, partners and corporate teams get their own band', () => {
  const investors = resolveCta({ path: '/investors/', collection: 'pages' }, live);
  assert.equal(investors?.audience, 'investor');
  assert.equal(investors?.primary.href, '/investors/interest/');
  assert.equal(investors?.secondary?.href, '/briefs/early-stage-diligence/');
  const partners = resolveCta({ path: '/network/partners/', collection: 'pages' }, live);
  assert.equal(partners?.audience, 'partner');
  assert.equal(partners?.primary.href, '/network/partners/enquire/');
  const corporate = resolveCta({ path: '/founders/corporate-innovators/', collection: 'pages' }, live);
  assert.equal(corporate?.audience, 'corporate');
  assert.equal(corporate?.primary.href, '/briefs/corporate-spinouts/');
  assert.equal(corporate?.secondary?.href, '/contact/');
  const fallback = resolveCta({ path: '/founders/corporate-innovators/', collection: 'pages' }, only('/contact/'));
  assert.equal(fallback?.primary.href, '/contact/');
  assert.equal(fallback?.secondary, undefined);
});

test('every resolved model meets the contract: a short heading, a live primary, never the same page twice', () => {
  const inputs: ResolveInput[] = [...new Set([...routes.map((r) => r.path), ...FAMILIES.flatMap((f) => familyPaths(f))])].map(inputFor);
  // Every launched ledger row is live, as it is once its page exists; a row that is not launched is not.
  const ledgerLive = (path: string): boolean => ledger.get(path)?.launch === true;
  for (const input of inputs) {
    const model = resolveCta(input, ledgerLive);
    if (model === null) continue;
    assert.ok(model.heading.length <= 70, `${input.path}: the heading is long`);
    assert.ok(ledger.get(model.primary.href)?.launch === true, `${input.path}: the primary is not a launched route`);
    if (model.secondary !== undefined) {
      assert.notEqual(model.secondary.href, model.primary.href, `${input.path}: the secondary repeats the primary`);
      assert.ok(ledger.get(model.secondary.href)?.launch === true, `${input.path}: the secondary is not a launched route`);
    }
    assert.notEqual(model.primary.href, input.path, `${input.path}: a page does not point at itself`);
  }
});

test('ctaForTarget builds the band for a variant and a brief, and nothing for a dead target', () => {
  const brief = ctaForTarget('brief', { briefId: 'company-setup', audience: 'startup' }, live);
  assert.equal(brief?.primary.href, '/briefs/company-setup/');
  assert.equal(ctaForTarget('brief', { briefId: 'company-setup' }, only('/apply/')), null);
  assert.equal(ctaForTarget('brief', {}, live)?.primary.href, '/briefs/');
  assert.equal(ctaForTarget('contact', {}, live)?.primary.href, '/contact/');
});

test('the mid-body band: articles and guides have one, the Apply target, and nothing else does', () => {
  const article = resolveMidCta({ path: '/insights/x/', collection: 'insights', topic: 'legal' }, live);
  assert.equal(article?.id, 'mid:apply');
  assert.equal(article?.primary.href, '/apply/');
  assert.equal(article?.secondary, undefined);
  assert.equal(resolveMidCta({ path: '/fundability/safe-explained/', collection: 'guides' }, live)?.primary.href, '/apply/');
  assert.equal(resolveMidCta({ path: '/insights/x/', collection: 'insights', topic: 'legal' }, () => false), null);
  for (const input of [{ path: '/', collection: 'pages' }, { path: '/playbooks/x/', collection: 'playbooks' }, { path: '/library/x/', collection: 'library' }, { path: '/research/x/', collection: 'research' }] as const) {
    assert.equal(resolveMidCta(input, live), null, input.path);
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------
// The hast plugin
// ---------------------------------------------------------------------------------------------------------------------------------

type ElementNode = Extract<HastNode, { type: 'element' }>;
type Content = ElementNode['children'][number];
const text = (value: string): Content => ({ type: 'text', value });
const el = (tagName: string, children: Content[] = [], properties: ElementNode['properties'] = {}): ElementNode => ({ type: 'element', tagName, properties, children });
const textOf = (node: HastNode): string => (node.type === 'text' ? node.value : 'children' in node ? node.children.map(textOf).join('') : '');
const words = (n: number): string => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');
const para = (n: number): ElementNode => el('p', [text(words(n))]);

function recorder(): { ctx: MidCtaContext; inserted: { after: HastNode; node: unknown }[] } {
  const inserted: { after: HastNode; node: unknown }[] = [];
  return { ctx: { textContent: textOf, insertAfter: (after, node) => inserted.push({ after, node }) }, inserted };
}

const model = resolveMidCta({ path: '/insights/x/', collection: 'insights', topic: 'legal' }, live) as CtaModel;

test('wordCount counts pieces with a letter or a digit', () => {
  assert.equal(wordCount('a  b\n--- c | 4'), 4);
});

test('the band goes after the first paragraph that ends at or after the middle, and only once', () => {
  const blocks = [el('h2', [text('Start')]), ...Array.from({ length: 10 }, () => para(100))];
  const rootNode: HastNode = { type: 'root', children: blocks };
  const { ctx, inserted } = recorder();
  assert.equal(placeMidCta(rootNode, ctx, model), true);
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0]?.after, blocks[5], 'five of ten paragraphs is the middle (the heading adds two words)');
  const node = inserted[0]?.node as ElementNode;
  assert.equal(node.tagName, 'aside');
  assert.deepEqual(node.properties, { className: ['cta-inline'], dataCta: 'mid', ariaLabel: 'Next step' });
});

test('a document under 900 words gets no band', () => {
  const { ctx, inserted } = recorder();
  const rootNode: HastNode = { type: 'root', children: Array.from({ length: 8 }, () => para(100)) };
  assert.ok(wordCount(textOf(rootNode)) < MID_CTA_MIN_WORDS);
  assert.equal(placeMidCta(rootNode, ctx, model), false);
  assert.equal(inserted.length, 0);
});

test('the band never goes after a heading, a list, a table, a quote, a figure or code, nor after a paragraph that introduces a list', () => {
  const lead = Array.from({ length: 4 }, () => para(100));
  const middle = [
    el('h2', [text(words(60))]),
    el('ul', [el('li', [text(words(60))])]),
    el('table', [el('tbody', [el('tr', [el('td', [text(words(60))])])])]),
    el('blockquote', [para(60)]),
    el('figure', [el('figcaption', [text(words(60))])]),
    el('pre', [el('code', [text(words(60))])]),
    el('p', [text(`${words(60)} as follows:`)]),
  ];
  const tail = [para(100), para(100), para(100)];
  const intro = el('p', [text(words(20))]);
  const closing = el('p', [text(words(100))]);
  const rootNode: HastNode = { type: 'root', children: [...lead, ...middle, intro, closing, ...tail] };
  const { ctx } = recorder();
  const anchor = findAnchor(rootNode, ctx);
  assert.ok(anchor !== undefined && 'tagName' in anchor && anchor.tagName === 'p');
  assert.ok(!middle.includes(anchor as ElementNode), 'the anchor is not one of the blocks that must be skipped');
});

test('the band never goes in the last 10 percent, and a paragraph that closes the document is not an anchor', () => {
  const { ctx } = recorder();
  const heavy: HastNode = { type: 'root', children: [para(100), el('h2', [text('Middle')]), el('ul', [el('li', [text(words(900))])]), para(40)] };
  assert.equal(findAnchor(heavy, ctx), undefined);
});

test('whitespace between top-level blocks is not a block', () => {
  const { ctx } = recorder();
  const blocks: Content[] = [];
  for (let i = 0; i < 10; i += 1) blocks.push(para(100), text('\n'));
  const anchor = findAnchor({ type: 'root', children: blocks }, ctx);
  assert.equal(anchor, blocks[8], 'the fifth paragraph');
});

test('the plugin and the band render the same label and href for the same model', () => {
  const node = midCtaNode(model);
  const link = (node.children.at(-1) as ElementNode).children[0] as ElementNode;
  assert.equal(link.properties?.href, model.primary.href);
  assert.equal(textOf(link), model.primary.label);
  assert.equal(textOf(node.children[0] as ElementNode), model.heading);
  assert.equal(textOf(node.children[1] as ElementNode), model.body);
  const component = readFileSync(new URL('src/components/cta/CtaBand.astro', `file://${root}`), 'utf8');
  for (const part of ['model.primary.href', 'model.primary.label', 'model.heading', 'model.body']) assert.ok(component.includes(part), `CtaBand.astro does not render ${part}`);
});

test('the note of a model is written, and the title is a paragraph, never a heading', () => {
  const funding = resolveMidCta({ path: '/insights/x/', collection: 'insights', topic: 'funding' }, live) as CtaModel;
  const node = midCtaNode({ ...funding, note: 'A note.' });
  assert.equal(node.children.some((c) => c.type === 'element' && c.properties?.className?.toString() === 'cta-inline__note'), true);
  assert.equal(node.children.some((c) => c.type === 'element' && /^h[1-6]$/.test(c.tagName)), false);
});

test('inputFromFile reads the place of a content file and ignores the rest', () => {
  assert.deepEqual(inputFromFile('/repo/src/content/insights/funding/safe-notes.mdx'), { path: '/insights/safe-notes/', collection: 'insights', topic: 'funding' });
  assert.deepEqual(inputFromFile('/repo/src/content/guides/safe-explained.mdx'), { path: '/fundability/safe-explained/', collection: 'guides' });
  assert.equal(inputFromFile('/repo/src/content/pages/apply/index.mdx'), null);
  assert.equal(inputFromFile('/repo/src/content/insights/loose.mdx'), null);
});

function longDocument(paragraphs: number): string {
  return Array.from({ length: paragraphs }, (_, i) => `Paragraph ${i} ${words(95)}.`).join('\n\n');
}
const fileURL = (path: string): URL => new URL(`file:///repo/${path}`);

test('through the real Sätteri pipeline: one band in a long article, none in a short one, none outside articles and guides', async () => {
  const plugin = createMidCtaPlugin({ isLive: live });
  const render = async (source: string, file: string | undefined): Promise<string> => {
    const { html } = await markdownToHtml(source, { hastPlugins: [plugin], ...(file !== undefined ? { fileURL: fileURL(file) } : {}), features: { gfm: true } });
    return html;
  };
  const long = await render(longDocument(12), 'src/content/insights/funding/safe-notes.md');
  assert.equal(long.split('data-cta="mid"').length - 1, 1, 'exactly one band');
  assert.match(long, /<aside class="cta-inline" data-cta="mid" aria-label="Next step">/);
  assert.match(long, /<a class="btn btn--secondary" href="\/apply\/">Start a readiness review<\/a>/);
  const share = long.indexOf('cta-inline') / long.length;
  assert.ok(share > 0.4 && share < 0.95, `the band sits at ${Math.round(share * 100)} percent of the markup`);
  assert.equal((await render(longDocument(6), 'src/content/insights/funding/safe-notes.md')).includes('cta-inline'), false);
  assert.equal((await render(longDocument(12), 'src/content/pages/founders/solo-founders.md')).includes('cta-inline'), false);
  assert.equal((await render(longDocument(12), undefined)).includes('cta-inline'), false);
  assert.equal((await render(longDocument(12), 'src/content/guides/safe-explained.md')).includes('data-cta="mid"'), true);
  assert.equal((await render(longDocument(12), 'src/content/playbooks/validate-the-problem.md')).includes('cta-inline'), false);

  const preview = createMidCtaPlugin({ isLive: live, base: 'worldenterprise' });
  const { html } = await markdownToHtml(longDocument(12), { hastPlugins: [preview], fileURL: fileURL('src/content/insights/legal/x.md'), features: { gfm: true } });
  assert.match(html, /href="\/worldenterprise\/apply\/"/, 'the preview base is applied as href() applies it');
});

test('through the pipeline, a target that is not live puts no band in the document', async () => {
  const plugin = createMidCtaPlugin({ isLive: () => false });
  const { html } = await markdownToHtml(longDocument(12), { hastPlugins: [plugin], fileURL: fileURL('src/content/insights/funding/x.md'), features: { gfm: true } });
  assert.equal(html.includes('cta-inline'), false);
});

test('the draft check reads the frontmatter block only', () => {
  assert.equal(isDraftFile('---\ntitle: A\ndraft: true\n---\nbody'), true);
  assert.equal(isDraftFile('---\ntitle: A\ndraft: false\n---\ndraft: true'), false);
  assert.equal(isDraftFile('no frontmatter\ndraft: true'), false);
});

test('the layouts: every layout has a cta-end slot, and the policy pages keep none through the map', () => {
  const layouts = ['ArticleHub', 'ArticleLayout', 'BriefLayout', 'FormLayout', 'GuideLayout', 'HomeLayout', 'HubLayout', 'LegalLayout', 'MarketingLayout', 'PlaybookLayout', 'ReferenceLayout', 'ServiceLayout', 'StageLayout', 'TemplateLayout', 'ToolLayout'];
  for (const name of layouts) {
    const source = readFileSync(new URL(`src/layouts/${name}.astro`, `file://${root}`), 'utf8');
    assert.ok(source.includes('<slot name="cta-end"'), `${name} has no cta-end slot`);
  }
});
