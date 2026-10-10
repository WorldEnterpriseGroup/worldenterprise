import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { webApplicationNode } from '../../../src/components/tools/webApplicationNode.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** The keys the JSON-LD validator forbids on a WebApplication (WP-41): a price claim in any form. */
const FORBIDDEN_KEYS = ['offers', 'offer', 'price', 'priceCurrency', 'priceRange', 'aggregateRating', 'review'];

const TOOLS = [
  { path: '/tools/metrics-calculator/', page: 'src/pages/tools/metrics-calculator.astro', content: 'src/content/pages/tools/metrics-calculator.mdx' },
  { path: '/tools/evidence-room/', page: 'src/pages/tools/evidence-room.astro', content: 'src/content/pages/tools/evidence-room.mdx' },
];

for (const tool of TOOLS) {
  test(`${tool.path}: the WebApplication node has an @id, a name and a url, and no price`, () => {
    const node = webApplicationNode({ path: tool.path, name: 'A tool', description: 'What it does.' });
    assert.equal(node['@type'], 'WebApplication');
    assert.equal(node['url'], `https://worldenterprise.org${tool.path}`);
    assert.equal(node['@id'], `https://worldenterprise.org${tool.path}#app`);
    assert.equal(node['name'], 'A tool');
    for (const key of FORBIDDEN_KEYS) assert.equal(key in node, false, key);
    assert.doesNotMatch(JSON.stringify(node), /price|offer|free|\$/i);
    assert.deepEqual(JSON.parse(JSON.stringify(node)), node, 'it survives serialisation unchanged');
  });
}

for (const tool of TOOLS) {
  test(`${tool.page} builds the WebApplication node for its own route and hands it to the layout`, () => {
    const source = readFileSync(join(root, tool.page), 'utf8');
    assert.match(source, /import \{ webApplicationNode \} from '\.\.\/\.\.\/components\/tools\/webApplicationNode\.ts';/);
    assert.ok(source.includes(`const PATH = '${tool.path}';`), `${tool.page} names its route once`);
    assert.match(source, /path=\{PATH\}/);
    assert.match(source, /jsonLd=\{\[webApplicationNode\(\{ path: PATH, name: data\.title, description: data\.description \}\)\]\}/);
  });
}

test('each tool page has a content entry the schema accepts: a title, a description of 50 to 160 characters and the funding claim', () => {
  for (const rel of ['src/content/pages/tools/index.mdx', ...TOOLS.map((tool) => tool.content)]) {
    const source = readFileSync(join(root, rel), 'utf8');
    const front = /^---\n([\s\S]*?)\n---/.exec(source)?.[1] ?? '';
    const title = /^title: (.+)$/m.exec(front)?.[1] ?? '';
    const description = (/^description: (.+)$/m.exec(front)?.[1] ?? '').replace(/^"(.*)"$/, '$1');
    assert.ok(title.length > 0 && title.length <= 70, `${rel}: title`);
    assert.ok(description.length >= 50 && description.length <= 160, `${rel}: description is ${description.length}`);
    assert.match(front, /^claimsUsed: \[C-05\]$/m, rel);
    assert.match(source, /WE makes no promise of funding\./, `${rel} says WE makes no promise of funding`);
  }
});
