import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import * as geoAudit from '../../../scripts/audit-geo.mjs';
import * as seoAudit from '../../../scripts/audit-seo.mjs';
import { INTRODUCTIONS_DISCLAIMER } from '../../../src/components/blocks/introductions.ts';
import { robotsTxt } from '../../../src/lib/seo.ts';

interface Twin {
  file: string;
  route: string;
  text: string;
}
interface Geo {
  LLMS_SECTIONS: { heading: string; optional: boolean }[];
  requiredSentences(): string[];
  markdownLinks(text: string): { text: string; url: string }[];
  targetOfLink(url: string): { kind: string; route: string; file?: string } | null;
  auditLlmsStructure(name: string, text: string): string[];
  markdownAlternates(html: string): (string | undefined)[];
  twinFacts(markdown: string): { heading?: string; canonical?: string };
  lintTwin(markdown: string): string[];
  auditTwin(twin: Twin, pages: Map<string, string>): string[];
  auditAlternates(pages: Map<string, string>, twinFiles: Map<string, string>): string[];
  auditLlmsLinks(name: string, text: string, ctx: { pages: Map<string, string>; twinFiles: Map<string, string> }): string[];
  auditLlmsFullBlocks(text: string, pages: Map<string, string>): string[];
  parseRobots(text: string): { groups: { agents: string[]; allow: string[]; disallow: string[] }[]; sitemaps: string[] };
  auditRobots(text: string, options: { preview: boolean; agents: string[] }): string[];
  readDist(dist: string): { pages: Map<string, string>; twins: Map<string, string>; llms?: string; llmsFull?: string; robots?: string };
  auditGeo(dist: { pages: Map<string, string>; twins: Map<string, string>; llms?: string; llmsFull?: string; robots?: string }, options: { preview: boolean; agents: string[]; maxFullBytes: number }): {
    errors: string[];
    counts: { pages: number; twins: number };
  };
}
interface Seo {
  markdownAlternateLinks(html: string): string[];
  twinUrlOf(route: string): string;
}
const geo = geoAudit as unknown as Geo;
const seo = seoAudit as unknown as Seo;

const AGENTS = ['GPTBot', 'ClaudeBot', 'CCBot'];
const ROBOTS = 'User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nAllow: /\n\nUser-agent: ClaudeBot\nAllow: /\n\nUser-agent: CCBot\nAllow: /\n\nSitemap: https://worldenterprise.org/sitemap-index.xml\n';
const NO_FUNDING = 'WE makes no promise of funding.';

function page(route: string, h1: string, alternate?: string): string {
  const canonical = `https://worldenterprise.org${route}`;
  const link = alternate === undefined ? '' : `<link rel="alternate" type="text/markdown" href="${alternate}">`;
  return `<!doctype html><html lang="en"><head><title>${h1}</title><link rel="canonical" href="${canonical}">${link}</head><body><main id="main"><h1>${h1}</h1></main></body></html>`;
}
function twin(route: string, h1: string): string {
  return `# ${h1}\n\nCanonical URL: https://worldenterprise.org${route}\n\nPlain text.\n`;
}
const LLMS = [
  '# World Enterprise Incubator',
  '',
  '> A digital incubator for SaaS.',
  '',
  '## What WE is',
  '',
  'Text.',
  '',
  '## What WE offers',
  '',
  'Text.',
  '',
  '## What WE does not do',
  '',
  NO_FUNDING,
  '',
  '## Published commercial facts',
  '',
  INTRODUCTIONS_DISCLAIMER,
  '',
  '## Key pages',
  '',
  '- [Facts about WE](https://worldenterprise.org/about/facts.md): Plain answers.',
  '- [Pricing](https://worldenterprise.org/pricing/): Packages.',
  '',
  '## Contact',
  '',
  'There is no email address yet.',
  '',
].join('\n');

function fixture() {
  const pages = new Map<string, string>([
    ['/about/facts/', page('/about/facts/', 'Facts about WE', 'https://worldenterprise.org/about/facts.md')],
    ['/pricing/', page('/pricing/', 'Pricing')],
  ]);
  const twins = new Map<string, string>([['about/facts.md', twin('/about/facts/', 'Facts about WE')]]);
  const full = `${LLMS}\n---\n\nSource: https://worldenterprise.org/about/facts/\n\n${twin('/about/facts/', 'Facts about WE')}`;
  return { pages, twins, llms: LLMS, llmsFull: full, robots: ROBOTS };
}

test('the required sentences are the no-funding sentence and the denylist disclaimer', () => {
  assert.deepEqual(geo.requiredSentences(), [NO_FUNDING, INTRODUCTIONS_DISCLAIMER]);
});

test('llms.txt structure: a conforming file passes', () => {
  assert.deepEqual(geo.auditLlmsStructure('llms.txt', LLMS), []);
});

test('llms.txt structure: a wrong title, a missing summary, a missing section and an unknown section are each reported', () => {
  assert.match(geo.auditLlmsStructure('llms.txt', LLMS.replace('# World Enterprise Incubator', '# Something else')).join('\n'), /first line must be/);
  assert.match(geo.auditLlmsStructure('llms.txt', LLMS.replace('> A digital', 'A digital')).join('\n'), /summary blockquote/);
  assert.match(geo.auditLlmsStructure('llms.txt', LLMS.replace('## Contact', '## Reach')).join('\n'), /missing section "## Contact"/);
  assert.match(geo.auditLlmsStructure('llms.txt', LLMS.replace('## Key pages', '## Extras')).join('\n'), /unknown section\(s\): "Extras"/);
});

test('llms.txt structure: sections out of order and a dropped required sentence are reported', () => {
  const swapped = LLMS.replace('## What WE is', '## TEMP').replace('## What WE offers', '## What WE is').replace('## TEMP', '## What WE offers');
  assert.match(geo.auditLlmsStructure('llms.txt', swapped).join('\n'), /out of order/);
  assert.match(geo.auditLlmsStructure('llms.txt', LLMS.replace(NO_FUNDING, '')).join('\n'), /missing the required sentence "WE makes no promise of funding\."/);
  assert.match(geo.auditLlmsStructure('llms.txt', LLMS.replace(INTRODUCTIONS_DISCLAIMER, 'Paraphrase.')).join('\n'), /missing the required sentence/);
});

test('llms-full.txt is checked for its head and sentences but not for the section list', () => {
  assert.deepEqual(geo.auditLlmsStructure('llms-full.txt', `${LLMS}\n## Anything\n`), []);
});

test('links are read from Markdown and sorted into twins, pages and external addresses', () => {
  const links = geo.markdownLinks('See [A](https://worldenterprise.org/a.md), [B](https://worldenterprise.org/b/) and [C](https://example.org/c).');
  assert.equal(links.length, 3);
  assert.deepEqual(geo.targetOfLink('https://worldenterprise.org/about/facts.md'), { kind: 'twin', route: '/about/facts/', file: 'about/facts.md' });
  assert.deepEqual(geo.targetOfLink('https://worldenterprise.org/index.md'), { kind: 'twin', route: '/', file: 'index.md' });
  assert.deepEqual(geo.targetOfLink('https://worldenterprise.org/pricing/'), { kind: 'page', route: '/pricing/' });
  assert.deepEqual(geo.targetOfLink('https://worldenterprise.org'), { kind: 'page', route: '/' });
  assert.equal(geo.targetOfLink('https://example.org/x/'), null);
  assert.equal(geo.targetOfLink('https://worldenterprise.org.evil.example/x/'), null);
});

test('twin facts and the plain-Markdown lint', () => {
  assert.deepEqual(geo.twinFacts(twin('/a/', 'A')), { heading: 'A', canonical: 'https://worldenterprise.org/a/' });
  assert.deepEqual(geo.lintTwin(twin('/a/', 'A')), []);
  assert.ok(geo.lintTwin('---\ntitle: x\n---\n# A\n').includes('frontmatter remains'));
  assert.ok(geo.lintTwin('# A\n\nimport X from "y";\n').includes('an import or export statement remains'));
  assert.ok(geo.lintTwin('# A\n\n<Foo prop="1" />\n').includes('a tag (JSX or HTML) remains'));
  assert.ok(geo.lintTwin('# A\n\n{props.value}\n').includes('a brace (an expression) remains'));
  assert.ok(geo.lintTwin('# A\n\n<!-- note -->\n').includes('an HTML comment remains'));
  assert.deepEqual(geo.lintTwin('# A\n\nUse `<Foo />` and <https://worldenterprise.org/a/>.\n\n```\n{ "code": true }\n```\n'), []);
});

test('a twin that agrees with its page and is advertised by it passes', () => {
  const { pages, twins } = fixture();
  assert.deepEqual(geo.auditTwin({ file: 'about/facts.md', route: '/about/facts/', text: twins.get('about/facts.md') as string }, pages), []);
});

test('a twin whose H1, canonical or advertisement disagrees with its page is reported', () => {
  const { pages } = fixture();
  const h1 = geo.auditTwin({ file: 'about/facts.md', route: '/about/facts/', text: twin('/about/facts/', 'Another title') }, pages);
  assert.match(h1.join('\n'), /first heading "Another title" differs from the page H1 "Facts about WE"/);
  const canonical = geo.auditTwin({ file: 'about/facts.md', route: '/about/facts/', text: twin('/about/other/', 'Facts about WE') }, pages);
  assert.match(canonical.join('\n'), /canonical .* differs from the page's/);
  const unadvertised = geo.auditTwin({ file: 'pricing.md', route: '/pricing/', text: twin('/pricing/', 'Pricing') }, pages);
  assert.match(unadvertised.join('\n'), /does not advertise it/);
  const orphan = geo.auditTwin({ file: 'nowhere.md', route: '/nowhere/', text: twin('/nowhere/', 'X') }, pages);
  assert.match(orphan.join('\n'), /was not built/);
  const leaking = geo.auditTwin({ file: 'about/facts.md', route: '/about/facts/', text: `${twin('/about/facts/', 'Facts about WE')}\n<Foo />\n` }, pages);
  assert.match(leaking.join('\n'), /not plain Markdown: a tag/);
});

test('a page that advertises a twin that was not built, or an unusable address, is reported', () => {
  const pages = new Map<string, string>([
    ['/a/', page('/a/', 'A', 'https://worldenterprise.org/a.md')],
    ['/b/', page('/b/', 'B', 'https://elsewhere.example/b.md')],
  ]);
  const errors = geo.auditAlternates(pages, new Map());
  assert.match(errors[0] ?? '', /advertises https:\/\/worldenterprise\.org\/a\.md, which was not built/);
  assert.match(errors[1] ?? '', /unusable href/);
  assert.deepEqual(geo.auditAlternates(pages, new Map([['a.md', 'x']])).length, 1);
});

test('alternate links are read only when rel and type both match', () => {
  const html = '<link rel="alternate" type="application/rss+xml" href="/rss.xml"><link rel="alternate" type="text/markdown" href="https://worldenterprise.org/a.md"><link rel="stylesheet" type="text/markdown" href="/x">';
  assert.deepEqual(geo.markdownAlternates(html), ['https://worldenterprise.org/a.md']);
  assert.deepEqual(seo.markdownAlternateLinks(html), ['https://worldenterprise.org/a.md']);
});

test('audit-seo derives the twin URL of a route the same way the site does', () => {
  assert.equal(seo.twinUrlOf('/about/facts/'), 'https://worldenterprise.org/about/facts.md');
  assert.equal(seo.twinUrlOf('/'), 'https://worldenterprise.org/index.md');
});

test('llms links: a link to a missing twin, a mismatched twin or a missing page is reported', () => {
  const { pages, twins } = fixture();
  assert.deepEqual(geo.auditLlmsLinks('llms.txt', LLMS, { pages, twinFiles: twins }), []);
  assert.match(geo.auditLlmsLinks('llms.txt', LLMS, { pages, twinFiles: new Map() }).join('\n'), /about\/facts\.md, which was not built/);
  const wrong = new Map([['about/facts.md', twin('/about/facts/', 'Not the H1')]]);
  assert.match(geo.auditLlmsLinks('llms.txt', LLMS, { pages, twinFiles: wrong }).join('\n'), /linked twin: .*differs from the page H1/);
  const noPricing = new Map(pages);
  noPricing.delete('/pricing/');
  assert.match(geo.auditLlmsLinks('llms.txt', LLMS, { pages: noPricing, twinFiles: twins }).join('\n'), /no page \/pricing\/ was built/);
});

test('llms-full blocks: each Source line must name a built page whose H1 and canonical match', () => {
  const { pages } = fixture();
  const good = `${LLMS}\n---\n\nSource: https://worldenterprise.org/about/facts/\n\n${twin('/about/facts/', 'Facts about WE')}`;
  assert.deepEqual(geo.auditLlmsFullBlocks(good, pages), []);
  assert.match(geo.auditLlmsFullBlocks(LLMS, pages).join('\n'), /has no page blocks/);
  const missing = good.replace('/about/facts/\n', '/about/gone/\n');
  assert.match(geo.auditLlmsFullBlocks(missing, pages).join('\n'), /names a page that was not built/);
  const h1 = good.replace('# Facts about WE', '# Other');
  assert.match(geo.auditLlmsFullBlocks(h1, pages).join('\n'), /starts with "Other", the page H1 is "Facts about WE"/);
  const canonical = good.replace('Canonical URL: https://worldenterprise.org/about/facts/', 'Canonical URL: https://worldenterprise.org/x/');
  assert.match(geo.auditLlmsFullBlocks(canonical, pages).join('\n'), /canonical .* differs/);
});

test('robots.txt is parsed into groups, with several agents sharing one group', () => {
  const parsed = geo.parseRobots('User-agent: A\nUser-agent: B\nAllow: /\n# comment\nUser-agent: *\nDisallow: /x\nSitemap: https://worldenterprise.org/s.xml\n');
  assert.deepEqual(parsed.groups, [
    { agents: ['A', 'B'], allow: ['/'], disallow: [] },
    { agents: ['*'], allow: [], disallow: ['/x'] },
  ]);
  assert.deepEqual(parsed.sitemaps, ['https://worldenterprise.org/s.xml']);
});

test('robots.txt audit: production allows the named crawlers and lists the sitemap', () => {
  assert.deepEqual(geo.auditRobots(ROBOTS, { preview: false, agents: AGENTS }), []);
  assert.match(geo.auditRobots(ROBOTS.replace('User-agent: ClaudeBot\nAllow: /\n\n', ''), { preview: false, agents: AGENTS }).join('\n'), /no group names the crawler ClaudeBot/);
  assert.match(geo.auditRobots(`${ROBOTS}User-agent: Bad\nDisallow: /private\n`, { preview: false, agents: AGENTS }).join('\n'), /must not disallow/);
  assert.match(geo.auditRobots(ROBOTS.replace(/Sitemap:.*\n/, ''), { preview: false, agents: AGENTS }).join('\n'), /must list "Sitemap/);
  assert.match(geo.auditRobots('User-agent: *\nDisallow: /\n', { preview: false, agents: AGENTS }).join('\n'), /production must allow everything/);
});

test('robots.txt audit: a preview build must block everyone and allow nothing', () => {
  assert.deepEqual(geo.auditRobots('User-agent: *\nDisallow: /\n', { preview: true, agents: AGENTS }), []);
  assert.match(geo.auditRobots(ROBOTS, { preview: true, agents: AGENTS }).join('\n'), /must disallow everything/);
});

test('the audit accepts what src/lib/seo.ts emits, in production and in preview', () => {
  const agents = [...(robotsTxt(false).matchAll(/^User-agent: (?!\*)(.+)$/gm))].map((m) => m[1] as string);
  assert.ok(agents.length >= 10);
  assert.deepEqual(geo.auditRobots(robotsTxt(false), { preview: false, agents }), []);
  assert.deepEqual(geo.auditRobots(robotsTxt(true), { preview: true, agents }), []);
});

test('the whole audit passes a conforming fixture and counts what it saw', () => {
  const { errors, counts } = geo.auditGeo(fixture(), { preview: false, agents: AGENTS, maxFullBytes: 100_000 });
  assert.deepEqual(errors, []);
  assert.deepEqual(counts, { pages: 2, twins: 1 });
});

test('the whole audit reports a missing file, an over-cap llms-full.txt and a denylist hit in a twin', () => {
  const base = fixture();
  const missing = geo.auditGeo({ ...base, llms: undefined, llmsFull: undefined, robots: undefined }, { preview: false, agents: AGENTS, maxFullBytes: 100_000 });
  assert.deepEqual(
    missing.errors.filter((e) => /is missing from dist/.test(e)),
    ['llms.txt is missing from dist', 'llms-full.txt is missing from dist', 'robots.txt is missing from dist'],
  );
  assert.match(geo.auditGeo(base, { preview: false, agents: AGENTS, maxFullBytes: 100 }).errors.join('\n'), /over the cap of 100/);
  const twins = new Map([['about/facts.md', `${twin('/about/facts/', 'Facts about WE')}\nWE guarantees funding for every company.\n`]]);
  const hit = geo.auditGeo({ ...base, twins }, { preview: false, agents: AGENTS, maxFullBytes: 100_000 });
  assert.ok(hit.errors.some((e) => e.startsWith('about/facts.md: ') && /guarantees? funding|R-C/.test(e)), hit.errors.join('\n'));
});

test('readDist reads pages, twins and the three root files, and leaves out library files and bundles', () => {
  const dist = mkdtempSync(join(tmpdir(), 'wp41-dist-'));
  for (const dir of ['about/facts', 'library', '_astro', 'pagefind']) mkdirSync(join(dist, dir), { recursive: true });
  writeFileSync(join(dist, 'about/facts/index.html'), page('/about/facts/', 'Facts about WE'));
  writeFileSync(join(dist, 'about/facts.md'), twin('/about/facts/', 'Facts about WE'));
  writeFileSync(join(dist, 'library/notes.md'), '# Library note\n');
  writeFileSync(join(dist, '_astro/x.html'), '<html></html>');
  writeFileSync(join(dist, 'llms.txt'), LLMS);
  writeFileSync(join(dist, 'robots.txt'), ROBOTS);
  const read = geo.readDist(dist);
  assert.deepEqual([...read.pages.keys()], ['/about/facts/']);
  assert.deepEqual([...read.twins.keys()], ['about/facts.md']);
  assert.equal(read.llms, LLMS);
  assert.equal(read.llmsFull, undefined);
  assert.equal(read.robots, ROBOTS);
});
