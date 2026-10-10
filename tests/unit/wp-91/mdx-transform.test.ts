import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  CLAIMS_MARKER_REASON,
  KNOWN_COMPONENTS,
  NO_FUNDING_TEXT,
  SERVICE_DISCLAIMER_REFUSAL,
  NO_FUNDING_TITLE,
  transformMdx,
} from '../../../src/components/geo/mdx-transform.ts';
import type { MdxTransformOptions } from '../../../src/components/geo/mdx-transform.ts';
import { lintMarkdown } from '../../../src/lib/markdown-twins.ts';
import { loadContent, ROOT } from '../wp-41/content.ts';

const live: MdxTransformOptions = { isLive: () => true };
const dead: MdxTransformOptions = { isLive: () => false };
const only = (paths: readonly string[]): MdxTransformOptions => ({ isLive: (path) => paths.includes(path) });

function ok(source: string, options: MdxTransformOptions = live): string {
  const result = transformMdx(source, options);
  assert.ok(result.ok, result.ok ? '' : result.reason);
  return result.markdown;
}

function rejects(source: string, pattern: RegExp): void {
  const result = transformMdx(source, live);
  assert.ok(!result.ok, 'expected the transform to refuse the source');
  assert.match(result.reason, pattern);
}

test('plain Markdown passes through unchanged', () => {
  const source = '## Heading\n\nA paragraph with *emphasis* and a [link](https://example.org/).\n\n- one\n- two';
  assert.equal(ok(source), source);
});

test('import lines of components are dropped, and a fenced code block is left alone', () => {
  const source = "import Callout from '../../../components/ui/Callout.astro';\n\nText.\n\n```mdx\n<Callout>kept as code</Callout>\nimport X from 'y.astro';\n```\n";
  assert.equal(ok(source), 'Text.\n\n```mdx\n<Callout>kept as code</Callout>\nimport X from \'y.astro\';\n```');
});

test('DataTable becomes a captioned Markdown table and escapes the characters that would break a cell', () => {
  const source = `<DataTable
  caption="First pass"
  columns={['Part', 'Lean']}
  rows={[
    ['Auth | sessions', 'Buy *mature* code'],
    ['Email', 'Buy delivery'],
  ]}
/>`;
  assert.equal(
    ok(source),
    ['Table: First pass', '', '| Part | Lean |', '| --- | --- |', '| Auth \\| sessions | Buy \\*mature\\* code |', '| Email | Buy delivery |'].join('\n'),
  );
});

test('a DataTable row with the wrong number of cells is refused, so no twin carries a ragged table', () => {
  rejects(`<DataTable caption="x" columns={['a', 'b']} rows={[['only one']]} />`, /different number of cells/);
});

test('CellTrail becomes a numbered list and links a cell only when its route is live', () => {
  const source = `<CellTrail label="Path" cells={[{ label: 'First', href: '/a/' }, { label: 'Second', href: '/b/' }, { label: 'Third' }]} />`;
  assert.equal(ok(source, only(['/a/'])), 'Path:\n\n1. [First](/a/)\n2. Second\n3. Third');
});

test('Steps becomes the numbered list that playbook twins use', () => {
  const source = `<Steps headingLevel={3} steps={[{ title: 'Name it', body: 'Write one sentence.' }, { title: 'Why?', body: 'Because.' }]} />`;
  assert.equal(ok(source), '1. **Name it.** Write one sentence.\n2. **Why?** Because.');
});

test('Callout becomes a blockquote with a bold title, and keeps the links inside it', () => {
  const source = `Before.

<Callout title="A check">
  Ask three questions. See the <MaybeLink path="/faq/">FAQ</MaybeLink>.
</Callout>

After.`;
  assert.equal(ok(source), 'Before.\n\n> **A check**\n>\n> Ask three questions. See the [FAQ](/faq/).\n\nAfter.');
  assert.equal(ok('<Callout tone="notice">Plain.</Callout>'), '> Plain.');
});

test('MaybeLink keeps the text and drops the link when the route is not live, as the component does', () => {
  const source = 'Read the <MaybeLink path="/about/frameworks/">frameworks overview</MaybeLink> next.';
  assert.equal(ok(source, live), 'Read the [frameworks overview](/about/frameworks/) next.');
  assert.equal(ok(source, dead), 'Read the frameworks overview next.');
});

test('inline code that mentions a component is not converted', () => {
  assert.equal(ok('Write `<MaybeLink path="/x/">` in MDX.'), 'Write `<MaybeLink path="/x/">` in MDX.');
});

test('the funding disclaimer uses the wording its component renders, and the services disclaimer has no twin', () => {
  const funding = readFileSync(`${ROOT}src/components/blocks/NoFundingDisclaimer.astro`, 'utf8').replace(/\s+/g, ' ');
  assert.ok(funding.includes(`<p class="callout__title">${NO_FUNDING_TITLE}</p>`), 'the funding disclaimer title moved');
  assert.ok(funding.includes(`<p> ${NO_FUNDING_TEXT} </p>`), 'the funding disclaimer wording moved');
  assert.equal(ok('<NoFundingDisclaimer />'), `> **${NO_FUNDING_TITLE}**\n>\n> ${NO_FUNDING_TEXT}`);
  const refused = transformMdx('<IntroductionsDisclaimer />', live);
  assert.ok(!refused.ok && refused.reason === SERVICE_DISCLAIMER_REFUSAL);
});

test('fail closed: an unknown component, an unknown prop, an expression and an unclosed tag all refuse', () => {
  rejects('<PackagePicker />', /does not convert/);
  rejects('<Callout title="x" class="y">Text</Callout>', /prop this transform does not read: class/);
  rejects(`<DataTable caption={'a' + 'b'} columns={['a']} rows={[]} />`, /expected "\}"|unsupported expression/);
  rejects(`<DataTable caption="x" columns={[...cols]} rows={[]} />`, /unsupported expression/);
  rejects('<Callout title="x">Never closed', /never closed/);
  rejects('<Callout title="x"><Callout>inner</Callout></Callout>', /nested in itself/);
  rejects('<MaybeLink path="https://example.org/">x</MaybeLink>', /not a site route/);
});

test('the literal parser reads the escapes and trailing commas that the content uses, and nothing else', () => {
  assert.equal(ok(`<Steps steps={[{ title: 'It\\'s here', body: "A \\"quote\\" and a tab\\there.", },]} />`), '1. **It\'s here.** A "quote" and a tab\there.');
  rejects(`<Steps steps={[{ title: \`tpl\`, body: 'x' }]} />`, /unsupported expression/);
});

test('every published insight converts to lint-clean Markdown with every link live or none, except a page that holds a claims marker or the services disclaimer', () => {
  const insights = loadContent().insights;
  assert.ok(insights.length >= 14, 'the real content should hold at least the 14 launch insights');
  let converted = 0;
  for (const entry of insights) {
    for (const options of [live, dead]) {
      const result = transformMdx(entry.body ?? '', options);
      if (/\bdata-(?:generic-definition|claim-allow)\b/.test(entry.body ?? '')) {
        assert.ok(!result.ok && result.reason === CLAIMS_MARKER_REASON, `${entry.id} holds a marker, so it has no twin`);
        continue;
      }
      if ((entry.body ?? '').includes('<IntroductionsDisclaimer')) {
        assert.ok(!result.ok && result.reason === SERVICE_DISCLAIMER_REFUSAL, `${entry.id} renders the services disclaimer, so it has no twin`);
        continue;
      }
      assert.ok(result.ok, `${entry.id}: ${result.ok ? '' : result.reason}`);
      assert.deepEqual(lintMarkdown(result.markdown), [], entry.id);
      converted += 1;
    }
  }
  assert.ok(converted >= 28, 'at least the 14 launch insights still convert');
});

test('a one-line <p> without attributes or inner markup becomes its paragraph, and anything else of that kind is refused by the lint', () => {
  assert.equal(ok('<p>A quoted passage.</p>'), 'A quoted passage.');
  const kept = ok('<p>With <b>markup</b>.</p>');
  assert.deepEqual(lintMarkdown(kept), ['a tag remains: <p>']);
});

test('a claims marker refuses the twin, in a paragraph or a span, and a fenced example of one does not', () => {
  rejects('<p data-generic-definition>A valuation cap is defined here.</p>', /claims marker/);
  rejects('Text with <span data-claim-allow="C-13-peers">cohort</span> inside.', /claims marker/);
  assert.equal(ok('```html\n<p data-generic-definition>x</p>\n```'), '```html\n<p data-generic-definition>x</p>\n```');
});

test('the known components are exactly the ones the content uses in articles', () => {
  assert.deepEqual([...KNOWN_COMPONENTS].sort(), ['Callout', 'CellTrail', 'DataTable', 'IntroductionsDisclaimer', 'MaybeLink', 'NoFundingDisclaimer', 'Steps']);
});
