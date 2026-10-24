import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { test } from 'node:test';
import { ROOT } from './props.ts';

// WP-45 CSS budget: the global stylesheet stays under 13.5 KB transferred (13,824 bytes). Transfer size is measured the way the
// Lighthouse network report measures it, as the compressed size of the minified sheet; gzip -9 of the comment-stripped,
// whitespace-collapsed concatenation of src/styles/*.css matched the reported 9.4 KB for the stylesheet before this package (9,382 B), so
// it is the proxy here. The real number is read again from the CI Lighthouse network report. The limits below leave the margin that
// minifier differences need, and the scoped component blocks are budgeted separately because they only ship on the pages that use them.

const BUDGET_BYTES = 13.5 * 1024;
/** The global sheet alone. Before WP-45 it measured 9,382 B; WP-109's full-HD layout rules (panels, rails, 76ch measure) brought it to about 11.8 KB. The 13.5 KB budget above is unchanged. */
const GLOBAL_LIMIT = 12_300;
/** The scoped styles of the components WP-45 added, all together, as if one page used every one. */
const VARIANT_LIMIT = 3_800;
const VARIANTS = [
  'src/components/ui/FeatureCard.astro',
  'src/components/ui/LedgerCard.astro',
  'src/components/ui/ClaimCard.astro',
  'src/components/ui/Divider.astro',
  'src/components/program/StageRail.astro',
] as const;

function minify(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};,>])\s*/g, '$1')
    .replace(/;}/g, '}');
}

function styleBlocks(source: string): string {
  return Array.from(source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g))
    .map((match) => match[1] ?? '')
    .join('\n');
}

const gzipSize = (css: string): number => gzipSync(minify(css), { level: 9 }).length;

test('the global stylesheet is well under the 13.5 KB transfer budget', () => {
  const dir = join(ROOT, 'src/styles');
  const sheet = readdirSync(dir)
    .filter((name) => name.endsWith('.css'))
    .sort()
    .map((name) => readFileSync(join(dir, name), 'utf8'))
    .join('\n');
  const size = gzipSize(sheet);
  assert.ok(size < GLOBAL_LIMIT, `src/styles gzips to ${size} B, over the ${GLOBAL_LIMIT} B working limit (budget ${BUDGET_BYTES} B)`);
});

test('the new variants fit the budget even if one page used all of them', () => {
  const dir = join(ROOT, 'src/styles');
  const sheet = readdirSync(dir)
    .filter((name) => name.endsWith('.css'))
    .map((name) => readFileSync(join(dir, name), 'utf8'))
    .join('\n');
  const scoped = VARIANTS.map((file) => styleBlocks(readFileSync(join(ROOT, file), 'utf8'))).join('\n');
  const variantSize = gzipSize(scoped);
  assert.ok(variantSize < VARIANT_LIMIT, `the new components' scoped styles gzip to ${variantSize} B, over ${VARIANT_LIMIT} B`);
  const worstCase = gzipSize(`${sheet}\n${scoped}`);
  assert.ok(worstCase < BUDGET_BYTES, `global sheet plus every new variant gzips to ${worstCase} B, over the ${BUDGET_BYTES} B budget`);
});
