import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { markdownToHtml, mdxToJs } from 'satteri';
import type { HastNode } from 'satteri';
import { labelTables, tableWrapPlugin, wrapTables, type TableWrapContext } from '../../../src/lib/rehype-table-wrap.ts';

const ROOT = new URL('../../../', import.meta.url).pathname;

type ElementNode = Extract<HastNode, { type: 'element' }>;
type Content = ElementNode['children'][number];
type WrapperArg = Parameters<TableWrapContext['wrapNode']>[1];

const text = (value: string): Content => ({ type: 'text', value });
const el = (tagName: string, children: Content[] = [], properties: ElementNode['properties'] = {}): ElementNode => ({ type: 'element', tagName, properties, children });
const root = (...children: Content[]): HastNode => ({ type: 'root', children });
const textOf = (node: HastNode): string => (node.type === 'text' ? node.value : 'children' in node ? node.children.map(textOf).join('') : '');
const table = (...headers: string[]): ElementNode => el('table', [el('thead', [el('tr', headers.map((h) => el('th', [text(h)])))]), el('tbody')]);

interface Recorded {
  readonly wraps: { node: HastNode; wrapper: WrapperArg }[];
  readonly props: { node: HastNode; key: string; value: unknown }[];
}

function recorder(frontmatter?: Record<string, unknown>): { ctx: TableWrapContext; seen: Recorded } {
  const seen: Recorded = { wraps: [], props: [] };
  const ctx: TableWrapContext = {
    data: frontmatter === undefined ? {} : { astro: { frontmatter } },
    textContent: textOf,
    setProperty: (node, key, value) => seen.props.push({ node, key, value }),
    wrapNode: (node, wrapper) => seen.wraps.push({ node, wrapper }),
  };
  return { ctx, seen };
}

/** The properties of the frame that wrapNode was asked to build, which is always an element. */
function frameProps(arg: WrapperArg | undefined): Record<string, unknown> {
  assert.ok(arg !== undefined && 'properties' in arg && arg.properties !== undefined, 'the wrapper is an element with properties');
  return { ...arg.properties };
}

test('a table is framed as a labelled, focusable region named after the heading above it', () => {
  const t = table('Metric', 'Definition');
  const { ctx, seen } = recorder();
  const count = wrapTables(root(el('h2', [text('Weekly   metrics')]), el('p', [text('Intro')]), t), ctx);
  assert.equal(count, 1);
  assert.equal(seen.wraps.length, 1);
  assert.equal(seen.wraps[0]?.node, t);
  assert.deepEqual(frameProps(seen.wraps[0]?.wrapper), { className: ['table-wrap'], tabIndex: 0, role: 'region', ariaLabel: 'Table: Weekly metrics' });
  const wrapper = seen.wraps[0]?.wrapper;
  assert.ok(wrapper !== undefined && 'children' in wrapper);
  assert.equal(wrapper.children.length, 0, 'the wrapped table must become the only child');
});

test('the table takes the data-table class and its header cells take scope="col"', () => {
  const t = table('A', 'B');
  const { ctx, seen } = recorder();
  wrapTables(root(t), ctx);
  assert.deepEqual(seen.props.filter((p) => p.node === t), [{ node: t, key: 'className', value: ['data-table'] }]);
  const scopes = seen.props.filter((p) => p.key === 'scope');
  assert.equal(scopes.length, 2);
  assert.ok(scopes.every((p) => p.value === 'col'));
});

test('existing classes and scopes are kept', () => {
  const th = el('th', [text('A')], { scope: 'row' });
  const t = el('table', [el('thead', [el('tr', [th])])], { className: ['prose-table'] });
  const { ctx, seen } = recorder();
  wrapTables(root(t), ctx);
  assert.deepEqual(seen.props.find((p) => p.node === t), { node: t, key: 'className', value: ['prose-table', 'data-table'] });
  assert.equal(seen.props.some((p) => p.node === th), false, 'a declared scope is not overwritten');
});

test('a caption wins over the heading, and the page title is the last resort', () => {
  const captioned = el('table', [el('caption', [text('Seat roles')]), el('thead', [el('tr', [el('th', [text('A')])])])]);
  const a = recorder();
  wrapTables(root(el('h3', [text('Heading')]), captioned), a.ctx);
  assert.equal(frameProps(a.seen.wraps[0]?.wrapper).ariaLabel, 'Table: Seat roles');

  const b = recorder({ title: 'Security baseline' });
  wrapTables(root(table('A')), b.ctx);
  assert.equal(frameProps(b.seen.wraps[0]?.wrapper).ariaLabel, 'Table: Security baseline');

  const c = recorder();
  wrapTables(root(table('A')), c.ctx);
  assert.equal(frameProps(c.seen.wraps[0]?.wrapper).ariaLabel, 'Table');
});

test('region names stay unique on a page that has several tables under one heading', () => {
  const { ctx, seen } = recorder();
  wrapTables(root(el('h2', [text('Checklist')]), table('A'), table('B'), el('h2', [text('Other')]), table('C')), ctx);
  const labels = seen.wraps.map((w) => frameProps(w.wrapper).ariaLabel);
  assert.deepEqual(labels, ['Table: Checklist (1 of 2)', 'Table: Checklist (2 of 2)', 'Table: Other']);
  assert.equal(new Set(labels).size, labels.length);
});

test('tables inside a container are found, and a table that already has a frame is left alone', () => {
  const inner = table('A');
  const framed = el('div', [table('B')], { className: ['table-wrap'] });
  const jsx: Content = { type: 'mdxJsxFlowElement', name: 'Figure', attributes: [], children: [inner] };
  const { ctx, seen } = recorder();
  const count = wrapTables(root(jsx, framed), ctx);
  assert.equal(count, 1);
  assert.equal(seen.wraps[0]?.node, inner);
});

test('labelTables numbers only the labels that repeat', () => {
  assert.deepEqual(labelTables(['', 'A', 'A', 'B']), ['Table', 'Table: A (1 of 2)', 'Table: A (2 of 2)', 'Table: B']);
});

function frontmatterFree(path: string): string {
  return readFileSync(`${ROOT}${path}`, 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '');
}

test('through the real Sätteri pipeline every table of a Markdown page ends up in a framed region', async () => {
  const source = frontmatterFree('src/content/research/saas-security-baseline-year-one.md');
  const { html } = await markdownToHtml(source, { hastPlugins: [tableWrapPlugin], features: { gfm: true } });
  const tables = html.match(/<table\b/g)?.length ?? 0;
  const frames = html.match(/<div class="table-wrap" tabindex="0" role="region" aria-label="Table[^"]*"><table class="data-table">/g)?.length ?? 0;
  assert.ok(tables > 0, 'the research brief has tables');
  assert.equal(frames, tables);
  assert.match(html, /<th scope="col">/);
  const labels = [...html.matchAll(/aria-label="(Table[^"]*)"/g)].map((m) => m[1]);
  assert.equal(new Set(labels).size, labels.length, 'region names are unique');
});

test('through the real MDX pipeline the tables of an .mdx insight are framed too', async () => {
  const source = frontmatterFree('src/content/insights/fundable/the-founder-time-budget-of-a-raise.mdx');
  const { code } = await mdxToJs(source, { hastPlugins: [tableWrapPlugin] });
  const tables = code.match(/_components\.table\b/g)?.length ?? 0;
  assert.ok(tables > 0, 'the insight has a table');
  const frames = code.match(/className: "table-wrap"/g)?.length ?? 0;
  assert.equal(frames, tables);
  assert.match(code, /role: "region"/);
});
