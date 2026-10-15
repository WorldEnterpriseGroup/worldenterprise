import assert from 'node:assert/strict';
import test from 'node:test';
import * as claimsAudit from '../../../scripts/audit-claims.mjs';
import { INTRODUCTIONS_DISCLAIMER } from '../../../src/components/blocks/introductions.ts';
import { assembleTwins } from '../../../src/components/geo/assemble.ts';
import { fileToRoute, routeExists } from '../../../src/lib/route-core.ts';
import {
  absolutizeLinks,
  buildTwin,
  faqTwinBody,
  isPlainMarkdown,
  lintMarkdown,
  renderTwin,
  requiredStatements,
  routeOfTwin,
  stripFrontmatter,
  twinParam,
  twinPath,
  twinUrl,
} from '../../../src/lib/markdown-twins.ts';
import { assembleReal, loadContent, REQUIRED } from './content.ts';

const audit = claimsAudit as unknown as {
  scan(text: string, options: { route: string; plain: boolean }): { rule: string; match: string }[];
  textRouteOf(path: string): string;
};

test('a twin path follows the contract: /insights/x/ is /insights/x.md, / is /index.md', () => {
  assert.equal(twinPath('/insights/x/'), '/insights/x.md');
  assert.equal(twinPath('/pricing/'), '/pricing.md');
  assert.equal(twinPath('/'), '/index.md');
  assert.equal(twinUrl('/about/facts/'), 'https://worldenterprise.org/about/facts.md');
  assert.equal(twinParam('/insights/x/'), 'insights/x');
});

test('routeOfTwin inverts twinPath and agrees with the claims audit on which route a twin stands for', () => {
  for (const route of ['/insights/x/', '/pricing/', '/', '/about/facts/']) {
    assert.equal(routeOfTwin(twinPath(route)), route);
    assert.equal(audit.textRouteOf(twinPath(route).replace(/^\//, '')), route);
  }
  assert.equal(routeOfTwin('/robots.txt'), null);
  assert.equal(routeOfTwin('/.md'), null);
});

test('the catch-all twin endpoint matches no route of the ledger, so it cannot make a page look built', () => {
  const page = fileToRoute('/src/pages/[...path].md.ts');
  assert.ok(page !== null);
  assert.equal(page.pattern, '/[...path].md');
  const ctx = { pageRoutes: [page], entryIds: {} };
  for (const path of ['/', '/pricing/', '/insights/x/', '/pricing.md', '/about/facts/']) assert.equal(routeExists(path, ctx), false, path);
});

test('the lint refuses frontmatter, imports, tags, comments and braces, and ignores code and autolinks', () => {
  assert.deepEqual(lintMarkdown('# Title\n\nPlain text with a [link](https://worldenterprise.org/x/) and <https://worldenterprise.org/y/>.\n'), []);
  assert.deepEqual(lintMarkdown('A `<Component />` in code and a block:\n\n```\n<Tag attr={1}>\n```\n'), []);
  assert.ok(lintMarkdown('---\ntitle: x\n---\n\nbody').length > 0, 'frontmatter');
  assert.ok(lintMarkdown("import Callout from '../x.astro';\n\ntext").length > 0, 'import');
  assert.ok(lintMarkdown('text\n\n<Callout title="x">\n\nbody\n\n</Callout>').length > 0, 'component tag');
  assert.ok(lintMarkdown('text <div class="x">raw</div>').length > 0, 'html tag');
  assert.ok(lintMarkdown('text <!-- note -->').length > 0, 'comment');
  assert.ok(lintMarkdown('text {props.value}').length > 0, 'expression');
  assert.equal(isPlainMarkdown('# ok\n\ntext'), true);
  assert.equal(isPlainMarkdown('<Foo />'), false);
});

test('stripFrontmatter and absolutizeLinks', () => {
  assert.equal(stripFrontmatter('---\na: 1\n---\nBody\n'), 'Body\n');
  assert.equal(stripFrontmatter('Body\n'), 'Body\n');
  assert.equal(absolutizeLinks('See [pricing](/pricing/) and [x](https://example.org/a) and [t](/a/ "Title").'), 'See [pricing](https://worldenterprise.org/pricing/) and [x](https://example.org/a) and [t](https://worldenterprise.org/a/ "Title").');
});

test('requiredStatements repeats the no-funding sentence and the disclaimer where the rules require them', () => {
  const facts = requiredStatements('/how-we-work/', 'Plain body.', REQUIRED);
  assert.ok(facts.includes('WE makes no promise of funding.'), 'how-we-work carries the no-funding sentence');
  const named = requiredStatements('/insights/x/', 'Our investor introductions are optional.', REQUIRED);
  assert.ok(named.includes(INTRODUCTIONS_DISCLAIMER), 'a body that names the add-on gets the disclaimer');
  assert.deepEqual(requiredStatements('/insights/x/', `A body that has it. ${INTRODUCTIONS_DISCLAIMER}`, REQUIRED), [], 'a statement already in the body is not repeated');
});

test('renderTwin: H1, lead, canonical URL, date, publisher, body, then the statements that apply', () => {
  const text = renderTwin({
    route: '/insights/x/',
    title: 'A title',
    lead: 'A lead.',
    updated: new Date('2026-10-06T12:00:00Z'),
    body: 'Body with a [link](/pricing/).',
    statements: ['WE makes no promise of funding.'],
  });
  const lines = text.split('\n');
  assert.equal(lines[0], '# A title');
  assert.equal(lines[2], 'A lead.');
  assert.match(text, /^Canonical URL: https:\/\/worldenterprise\.org\/insights\/x\/$/m);
  assert.match(text, /^Last updated: 2026-10-06$/m);
  assert.match(text, /^Publisher: World Enterprise, run by World Enterprise Group Incorporated$/m);
  assert.match(text, /\(https:\/\/worldenterprise\.org\/pricing\/\)/);
  assert.match(text, /## Statements that apply to this page\n\nWE makes no promise of funding\.\n$/);
  assert.deepEqual(buildTwin({ route: '/insights/x/', title: 'A title', body: 'Body.' }).problems, []);
  assert.ok(buildTwin({ route: '/insights/x/', title: 'A title', body: '<Callout />' }).problems.length > 0);
});

test('the FAQ twin keeps every question and answer', () => {
  const body = faqTwinBody([{ question: 'Q one?', answer: 'A one.', group: 'About WE' }, { question: 'Q two?', answer: 'A two.', group: 'About WE' }]);
  assert.match(body, /Q one\?/);
  assert.match(body, /A two\./);
});

test('assembleTwins skips a route that is not eligible and a body that fails the lint, and says why', () => {
  const content = loadContent();
  const broken = { ...content, insights: [{ ...content.insights[0]!, body: 'import X from "./x.astro";\n\n<X />\n' }] };
  const result = assembleTwins(broken, { isEligible: (route) => route !== '/faq/', required: REQUIRED });
  const slug = `/insights/${content.insights[0]!.id.split('/').at(-1)}/`;
  assert.ok(result.skipped.some((s) => s.route === slug), 'the broken body is skipped');
  assert.ok(result.skipped.some((s) => s.route === '/faq/' && /not built/.test(s.reason)), 'the ineligible route is skipped');
  assert.ok(!result.twins.some((t) => t.route === slug || t.route === '/faq/'));
});

test('the real content yields twins that all lint clean, with unique routes, and no library template', () => {
  const { twins } = assembleReal();
  assert.ok(twins.length >= 20, `expected at least 20 twins, got ${twins.length}`);
  assert.equal(new Set(twins.map((t) => t.route)).size, twins.length);
  for (const twin of twins) {
    const built = buildTwin(twin);
    assert.deepEqual(built.problems, [], twin.route);
    assert.ok(!twin.route.startsWith('/library/'), twin.route);
    assert.match(built.markdown, new RegExp(`^# ${twin.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n`), `${twin.route} starts with its title`);
  }
  const routes = new Set(twins.map((t) => t.route));
  for (const route of ['/about/facts/', '/faq/', '/glossary/', '/services/digital-incubation/', '/playbooks/validate-the-problem/']) assert.ok(routes.has(route), route);
});

test('every real twin passes the claims denylist as plain text on the route it stands for', () => {
  for (const twin of assembleReal().twins) {
    const markdown = buildTwin(twin).markdown;
    const hits = audit.scan(markdown, { route: twin.route, plain: true });
    assert.deepEqual(hits.map((h) => `${h.rule}: ${h.match}`), [], twin.route);
  }
});
