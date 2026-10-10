import assert from 'node:assert/strict';
import test from 'node:test';
import { parse } from 'yaml';
import * as claimsAudit from '../../../scripts/audit-claims.mjs';
import * as geoAudit from '../../../scripts/audit-geo.mjs';
import { addOnStatementFrom, calendarStatementFrom } from '../../../src/components/geo/qa.ts';
import { packages } from '../../../src/data/packages.ts';
import { site } from '../../../src/data/site.ts';
import { INTRODUCTIONS_DISCLAIMER, INTRODUCTIONS_FLAT_FEE } from '../../../src/components/blocks/introductions.ts';
import { LLMS_FULL_MAX_BYTES, NO_FUNDING_SENTENCE, buildLlmsFullTxt, buildLlmsTxt, LlmsFullTooLargeError } from '../../../src/lib/llms.ts';
import type { LlmsInput } from '../../../src/lib/llms.ts';
import { buildTwin } from '../../../src/lib/markdown-twins.ts';
import { assembleReal, read } from './content.ts';

const audit = claimsAudit as unknown as {
  scan(text: string, options: { route: string; plain: boolean }): { rule: string; match: string }[];
};
const geo = geoAudit as unknown as {
  auditLlmsStructure(name: string, text: string): string[];
  auditLlmsDenylist(file: string, text: string, set: unknown): string[];
};

const addOnStatement = addOnStatementFrom(read('src/content/pages/about/facts.mdx').replace(/^---[\s\S]*?\n---\n/, ''));

const faqYaml = parse(read('src/data/faq.yaml')) as { id: string; answer: string }[];
const accelerator = faqYaml.find((e) => /\bdemo day\b/.test(e.answer))?.answer;
const calendarStatement = calendarStatementFrom(accelerator);

function input(overrides: Partial<LlmsInput> = {}): LlmsInput {
  const twins = assembleReal().twins;
  return {
    site: { name: site.name, legalName: site.legalName, tagline: site.tagline, description: site.description, origin: site.origin },
    packages: packages.map((p) => ({ name: p.name, stageFit: p.stageFit, depth: p.depth })),
    serviceLines: ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((line) => ({ line, title: `Line ${line}`, route: `/services/line-${line.toLowerCase()}/`, summary: `Summary of line ${line}.` })),
    keyPages: [
      { route: '/about/facts/', title: 'Facts about WE', description: 'Plain answers.' },
      { route: '/pricing/', title: 'Pricing', description: 'Packages.' },
    ],
    optionalPages: [{ route: '/about/manifesto/', title: 'Manifesto' }],
    howWeDecide: null,
    twinRoutes: new Set(twins.map((t) => t.route)),
    contactRoute: '/contact/',
    applyRoute: '/apply/',
    addOnStatement,
    calendarStatement,
    ...overrides,
  };
}

test('the add-on statement is taken from the facts page and carries the verbatim disclaimer and the flat-fee sentence', () => {
  assert.ok(addOnStatement.includes(INTRODUCTIONS_DISCLAIMER));
  assert.ok(addOnStatement.includes(INTRODUCTIONS_FLAT_FEE));
  assert.match(addOnStatement, /separate, paid add-on with a flat fee/);
  assert.throws(() => addOnStatementFrom('## A question\n\nAn answer.'), /no answer about the paid add-on/);
});

test('llms.txt has the contract outline and both required sentences', () => {
  const text = buildLlmsTxt(input());
  assert.ok(text.startsWith(`# ${site.name}\n`));
  assert.deepEqual(geo.auditLlmsStructure('llms.txt', text), []);
  assert.ok(text.includes(NO_FUNDING_SENTENCE));
  assert.ok(text.includes(INTRODUCTIONS_DISCLAIMER));
  const headings = text.split('\n').filter((l) => l.startsWith('## '));
  assert.deepEqual(headings, ['## What WE is', '## What WE offers', '## What WE does not do', '## Published commercial facts', '## Key pages', '## Contact', '## Optional']);
});

test('llms.txt and llms-full.txt are built from data: a renamed package changes both', () => {
  const renamed = packages.map((p, i) => ({ name: i === 0 ? 'Ignite' : p.name, stageFit: p.stageFit, depth: p.depth }));
  // The page text is typed in the MDX (facts.test.ts pins it to packages.ts), so the head of the full file is what the data drives.
  const pages: ReturnType<typeof buildTwin>[] = [];
  const before = input();
  const after = input({ packages: renamed });
  for (const [a, b] of [
    [buildLlmsTxt(before), buildLlmsTxt(after)],
    [buildLlmsFullTxt(before, pages), buildLlmsFullTxt(after, pages)],
  ] as const) {
    assert.ok(a.includes('Spark') && !a.includes('Ignite'));
    assert.ok(b.includes('Ignite') && !b.includes('Spark'));
  }
});

test('a link goes to the Markdown twin when there is one and to the page otherwise', () => {
  const text = buildLlmsTxt(input());
  assert.match(text, /\(https:\/\/worldenterprise\.org\/about\/facts\.md\)/);
  assert.match(text, /\(https:\/\/worldenterprise\.org\/pricing\/\)/, 'pricing has no twin yet');
});

test('How WE decides is listed only when the page is live', () => {
  assert.ok(!buildLlmsTxt(input()).includes('## How WE decides'));
  const live = buildLlmsTxt(input({ howWeDecide: { route: '/program/how-we-decide/', title: 'How WE decides', description: 'The criteria.' } }));
  assert.match(live, /## How WE decides\n\n- \[How WE decides\]\(https:\/\/worldenterprise\.org\/program\/how-we-decide\/\)/);
  assert.deepEqual(geo.auditLlmsStructure('llms.txt', live), []);
});

test('the contact section lists only the forms that are live and no mailbox', () => {
  const none = buildLlmsTxt(input({ contactRoute: null, applyRoute: null }));
  assert.ok(!/Apply: /.test(none));
  assert.ok(!/Contact form: /.test(none));
  assert.match(none, /no email address yet/);
  assert.ok(!/@/.test(none), 'no mailbox');
});

test('llms.txt and the real llms-full.txt pass the denylist as plain text', () => {
  const full = buildLlmsFullTxt(input(), fullPages());
  const set = (claimsAudit as unknown as { loadDenylist(): unknown }).loadDenylist();
  for (const [route, text] of [['/llms.txt', buildLlmsTxt(input())], ['/llms-full.txt', full]] as const) {
    const hits = audit.scan(text, { route, plain: true });
    assert.deepEqual(hits.map((h) => `${h.rule}: ${h.match}`), [], route);
    assert.deepEqual(geo.auditLlmsDenylist(route.slice(1), text, set), [], `${route} held to the rule the denylist skips`);
  }
});

function fullPages() {
  const prefixes = ['/about/', '/services/', '/playbooks/', '/glossary/'];
  const routes = ['/faq/', '/research/early-stage-saas-metrics-definitions/'];
  return assembleReal()
    .twins.filter((t) => routes.includes(t.route) || prefixes.some((p) => t.route.startsWith(p)))
    .map((t) => buildTwin(t));
}

test('llms-full.txt is under its size cap over the real content, and a lower cap fails loudly', () => {
  const text = buildLlmsFullTxt(input(), fullPages());
  const bytes = new TextEncoder().encode(text).length;
  assert.ok(bytes <= LLMS_FULL_MAX_BYTES, `${bytes} bytes against a cap of ${LLMS_FULL_MAX_BYTES}`);
  assert.ok(bytes > 5_000, 'the file carries real page text');
  assert.throws(() => buildLlmsFullTxt(input(), fullPages(), 1_000), LlmsFullTooLargeError);
});

test('llms-full.txt heads each block with its canonical URL and refuses a twin with lint problems', () => {
  const text = buildLlmsFullTxt(input(), fullPages());
  assert.match(text, /\n---\n\nSource: https:\/\/worldenterprise\.org\/about\/facts\/\n\n# Facts about WE\n/);
  assert.deepEqual(geo.auditLlmsStructure('llms-full.txt', text), []);
  assert.throws(() => buildLlmsFullTxt(input(), [{ route: '/x/', markdown: '# X\n\n<Foo />\n', problems: ['a tag remains'] }]), /lint problems/);
});

test('the facts twin carries the facts page sentences that llms.txt repeats', () => {
  const facts = assembleReal().twins.find((t) => t.route === '/about/facts/');
  assert.ok(facts !== undefined);
  const markdown = buildTwin(facts).markdown;
  assert.ok(markdown.includes(NO_FUNDING_SENTENCE));
  assert.ok(markdown.includes(INTRODUCTIONS_DISCLAIMER));
});

test('the calendar sentence is the FAQ sentence, word for word, in llms.txt, and the FAQ and the metrics brief are in llms-full.txt', () => {
  assert.equal(calendarStatement, 'This site does not describe a cohort calendar or a demo day.');
  assert.ok((accelerator ?? '').includes(calendarStatement));
  assert.ok(buildLlmsTxt(input()).includes(`- ${calendarStatement}`));
  assert.throws(() => calendarStatementFrom('Nothing here.'), /no answer with a sentence about a demo day/);
  const text = buildLlmsFullTxt(input(), fullPages());
  assert.match(text, /Source: https:\/\/worldenterprise\.org\/faq\/\n/);
  assert.match(text, /Source: https:\/\/worldenterprise\.org\/research\/early-stage-saas-metrics-definitions\/\n/);
  assert.ok(text.includes(calendarStatement), 'the FAQ answer is carried whole');
});

test('the audit holds the llms files to the C-13-peers vocabulary that the denylist skips on them', () => {
  const set = (claimsAudit as unknown as { loadDenylist(): unknown }).loadDenylist();
  const head = buildLlmsTxt(input());
  assert.deepEqual(geo.auditLlmsDenylist('llms.txt', head, set), []);
  const stray = `${head}\nWE runs a mentor program for every cohort.\n`;
  assert.match(geo.auditLlmsDenylist('llms.txt', stray, set).join('\n'), /C-13-peers/);
  const faqBlock = `---\n\nSource: https://worldenterprise.org/faq/\n\n# FAQ\n\nCanonical URL: https://worldenterprise.org/faq/\n\nIs WE an accelerator? ${calendarStatement}\n`;
  assert.deepEqual(geo.auditLlmsDenylist('llms-full.txt', `${head}\n${faqBlock}`, set), [], 'the FAQ block is scanned as the FAQ');
  const pricingBlock = faqBlock.split('/faq/').join('/pricing/');
  assert.match(geo.auditLlmsDenylist('llms-full.txt', `${head}\n${pricingBlock}`, set).join('\n'), /C-13-peers/, 'the same words on another page are a hit');
});
