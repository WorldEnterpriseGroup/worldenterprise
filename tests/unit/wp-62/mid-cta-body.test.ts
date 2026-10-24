import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { mdxToJs } from 'satteri';
import type { HastNode } from 'satteri';
import { ARTICLE_FURNITURE_SELECTOR, blockWords, findAnchor, MID_CTA_FROM, MID_CTA_UNTIL } from '../../../src/lib/rehype-mid-cta.ts';

/**
 * Two articles whose MDX components render their words from props (a table, a list of steps), which `textContent` of a component node
 * does not hold. The placer counts those props, so the share it computes is the share of the words the page shows. The AI-regulation
 * article is also long in its tail (the layout adds figures, sources and a citation box after the body), and the e2e spec stops counting
 * at ARTICLE_FURNITURE_SELECTOR, the constant it shares with the plugin.
 */
const root = new URL('../../../', import.meta.url).pathname;
const articles = [
  'src/content/insights/ai/ai-regulation-for-a-small-saas-company-what-to-ask-counsel.mdx',
  'src/content/insights/ops/burnout-recognizing-it-and-what-to-change.mdx',
];

interface Placement {
  readonly share: number;
  readonly total: number;
  readonly anchored: boolean;
  readonly components: Record<string, number>;
}

/** Runs the real Sätteri MDX pipeline over a file and reports where findAnchor puts the band, by the words the blocks show. */
function place(file: string): Placement {
  const source = readFileSync(`${root}${file}`, 'utf8').replace(/^---[\s\S]*?\n---\n/, '');
  let result: Placement | undefined;
  const probe = {
    name: 'probe',
    before(tree: HastNode, ctx: Parameters<typeof findAnchor>[1] & Parameters<typeof blockWords>[1]): void {
      const blocks: HastNode[] = 'children' in tree ? tree.children.filter((node) => !(node.type === 'text' && node.value.trim() === '')) : [];
      const words = blocks.map((node) => blockWords(node, ctx));
      const total = words.reduce((sum, count) => sum + count, 0);
      const anchor = findAnchor(tree, ctx);
      const at = anchor === undefined ? -1 : blocks.indexOf(anchor);
      const components: Record<string, number> = {};
      blocks.forEach((node, index) => {
        if (node.type === 'mdxJsxFlowElement' && 'name' in node && typeof node.name === 'string') components[node.name] = words[index] ?? 0;
      });
      result = { share: at === -1 ? 0 : words.slice(0, at + 1).reduce((sum, count) => sum + count, 0) / total, total, anchored: at !== -1, components };
    },
  };
  mdxToJs(source, { hastPlugins: [probe] } as never);
  assert.ok(result !== undefined, `${file} went through the pipeline`);
  return result;
}

for (const file of articles) {
  test(`${file.split('/').pop()}: the band is placed in [0.5, 0.9] of the words the page shows, components included`, () => {
    const placement = place(file);
    assert.ok(placement.anchored, 'the article has a place for the band');
    assert.ok(placement.total >= 900, 'the body is a document of 900 words or more');
    assert.ok(placement.share >= MID_CTA_FROM && placement.share <= MID_CTA_UNTIL + 0.02, `the band follows ${(placement.share * 100).toFixed(1)} percent of the body`);
  });
}

test('a table and a list of steps given as props count as the words they render', () => {
  const placement = place(articles[1] ?? '');
  assert.ok((placement.components['DataTable'] ?? 0) >= 100, `the table counts its cells (${placement.components['DataTable']} words)`);
  assert.ok((placement.components['Steps'] ?? 0) >= 60, `the steps count their titles and bodies (${placement.components['Steps']} words)`);
});

test('the e2e spec measures the body with the selector the plugin exports, and does not loop every article inside one test', () => {
  const spec = readFileSync(`${root}tests/e2e/wave8/wp-62/surface-matrix.spec.ts`, 'utf8');
  assert.ok(spec.includes('ARTICLE_FURNITURE_SELECTOR'), 'the spec imports the shared selector');
  assert.ok(!spec.includes(ARTICLE_FURNITURE_SELECTOR), 'the spec holds no second copy of the selector');
  assert.ok(!spec.includes('setTimeout(240_000)'), 'the loop has no raised timeout');
});
