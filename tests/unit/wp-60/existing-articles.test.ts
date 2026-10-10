import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

/**
 * The 18 articles that existed before wave 8 keep their files byte for byte (contracts section 1.3): not rewritten, not renamed, not
 * moved. Wave 8 adds articles around them; it never edits them. The ledger gives them the desk owner of their folder and nothing else
 * changes. A correction to one of them goes to the handoff of the package that finds it (decision W8-28 covers reference data alike).
 */
const root = new URL('../../../', import.meta.url).pathname;

const pinned = JSON.parse(readFileSync(new URL('fixtures/existing-articles.json', import.meta.url), 'utf8')) as Record<string, string>;

test('the pin holds the 18 original articles, so the check cannot pass over an empty list', () => {
  assert.equal(Object.keys(pinned).length, 18);
  for (const path of Object.keys(pinned)) assert.match(path, /^src\/content\/insights\/(dream|build|grow|fundable)\/[a-z0-9-]+\.mdx?$/, path);
});

for (const [path, hash] of Object.entries(pinned)) {
  test(`${path} is unchanged`, () => {
    let bytes: Buffer;
    try {
      bytes = readFileSync(`${root}${path}`);
    } catch (error) {
      throw new Error(`${path} is missing: an original article was moved, renamed or removed (${(error as Error).message}).`);
    }
    assert.equal(createHash('sha256').update(bytes).digest('hex'), hash, `${path} was edited; send the correction to the handoff instead`);
  });
}
