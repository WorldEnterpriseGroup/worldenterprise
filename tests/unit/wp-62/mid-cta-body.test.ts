import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { markdownToHtml } from 'satteri';
import { createMidCtaPlugin, MID_CTA_FROM, MID_CTA_UNTIL, wordCount } from '../../../src/lib/rehype-mid-cta.ts';

/**
 * The shape of ai-regulation-for-a-small-saas-company-what-to-ask-counsel: an article of about 1,600 words whose layout adds a long tail
 * to the same container after the body (the timeline offer, the "In the data" figures, the sources, the citation box). The band is placed
 * by the words of the body alone, so its place must be in [0.5, 0.9] of the body, and the e2e spec must measure the same body (it stops
 * at the first piece of furniture) rather than the whole container.
 */
const root = new URL('../../../', import.meta.url).pathname;
const file = 'src/content/insights/ai/ai-regulation-for-a-small-saas-company-what-to-ask-counsel.mdx';

test('the placer puts the band inside [0.5, 0.9] of the body of the AI-regulation article, by the same word count the spec uses', async () => {
  const source = readFileSync(`${root}${file}`, 'utf8').replace(/^---[\s\S]*?\n---\n/, '');
  const plugin = createMidCtaPlugin({ isLive: () => true });
  const { html } = await markdownToHtml(source, { hastPlugins: [plugin], fileURL: new URL(`file:///repo/${file}`), features: { gfm: true } });
  const at = html.indexOf('<aside class="cta-inline"');
  assert.ok(at > 0, 'the article carries a band');
  const end = html.indexOf('</aside>', at) + '</aside>'.length;
  const text = (markup: string): number => wordCount(markup.replace(/<[^>]*>/g, ' '));
  const before = text(html.slice(0, at));
  const total = before + text(html.slice(end));
  const share = before / total;
  assert.ok(share >= MID_CTA_FROM - 0.02 && share <= MID_CTA_UNTIL, `the band sits at ${(share * 100).toFixed(1)} percent of the body`);
  assert.ok(total >= 900, 'the body is a document of 900 words or more');
});

test('the e2e spec measures the body, not the layout furniture that follows it', () => {
  const spec = readFileSync(`${root}tests/e2e/wave8/wp-62/surface-matrix.spec.ts`, 'utf8');
  for (const marker of ['[data-cta-mid]', '[data-insight-figures]', '.sources', '[data-cite-this]']) assert.ok(spec.includes(marker), `the spec stops counting at ${marker}`);
});
