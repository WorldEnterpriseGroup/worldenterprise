import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { COMPOSITIONS, COMPARE_ANCHOR_X, COMPARE_GROUP, VIEWBOX_HEIGHT, VIEWBOX_WIDTH, renderComposition } from '../../../src/assets/brand/compositions.ts';
import { COMPOSITION_IDS, isCompositionId } from '../../../src/components/brand/types.ts';
import { MAX_COMPOSITION_BYTES, polygons, scanComposition } from './support/scan-composition.ts';

/**
 * The family-hero compositions (issue #51): one per id, at most 12 KB, only hex-cell geometry, no person, logo, product or chart,
 * and the compare scene exactly mirror-symmetric so it cannot favor a side.
 */

test('there is one composition for each id and nothing else', () => {
  assert.deepEqual(Object.keys(COMPOSITIONS).sort(), [...COMPOSITION_IDS].sort());
  for (const id of COMPOSITION_IDS) {
    assert.ok(isCompositionId(id));
    assert.equal(renderComposition(id), COMPOSITIONS[id].svg);
    assert.ok(COMPOSITIONS[id].name.length >= 20, `${id} has a plain description`);
  }
  assert.equal(isCompositionId('portfolio'), false);
});

test('every composition keeps the scan: size, element allowlist, no text, no attributes that fetch or style', () => {
  for (const id of COMPOSITION_IDS) {
    const svg = COMPOSITIONS[id].svg;
    assert.deepEqual(scanComposition(svg), [], `${id} breaks a rule`);
    assert.ok(Buffer.byteLength(svg, 'utf8') <= MAX_COMPOSITION_BYTES, `${id} is over 12 KB`);
  }
  assert.equal(MAX_COMPOSITION_BYTES, 12288);
});

test('every composition is drawn inside its viewBox and has cells', () => {
  for (const id of COMPOSITION_IDS) {
    const cells = polygons(COMPOSITIONS[id].svg);
    assert.ok(cells.length >= 7, `${id} draws at least seven cells`);
    for (const cell of cells) {
      assert.equal(cell.length, 6, `${id}: a cell is a hexagon`);
      for (const p of cell) {
        assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), `${id}: a vertex is a number`);
        assert.ok(p.x >= 0 && p.x <= VIEWBOX_WIDTH && p.y >= 0 && p.y <= VIEWBOX_HEIGHT, `${id}: vertex ${p.x},${p.y} is outside the viewBox`);
      }
    }
  }
});

test('the compare composition is an exact mirror: equal cells on each side, every cell reflected', () => {
  const cells = polygons(COMPOSITIONS.compare.svg);
  const mid = VIEWBOX_WIDTH / 2;
  const centre = (cell: readonly { x: number; y: number }[]): { x: number; y: number } => ({
    x: cell.reduce((s, p) => s + p.x, 0) / cell.length,
    y: cell.reduce((s, p) => s + p.y, 0) / cell.length,
  });
  const left = cells.map(centre).filter((c) => c.x < mid - 1);
  const right = cells.map(centre).filter((c) => c.x > mid + 1);
  assert.equal(left.length, COMPARE_GROUP.length);
  assert.equal(right.length, left.length);
  for (const l of left) {
    const twin = right.find((r) => Math.abs(r.x - (VIEWBOX_WIDTH - l.x)) < 0.2 && Math.abs(r.y - l.y) < 0.2);
    assert.ok(twin !== undefined, `no mirror cell for ${l.x},${l.y}`);
  }
  // The same role on both sides: the markup counts of each class are even apart from the single shared cell.
  const roleCount = (role: string): number => (COMPOSITIONS.compare.svg.match(new RegExp(`class="c-${role}"`, 'g')) ?? []).length;
  assert.equal(roleCount('tone'), 2 * COMPARE_GROUP.length);
  assert.equal(roleCount('soft'), 1);
  assert.equal(roleCount('core') + roleCount('lead') + roleCount('sand'), 0, 'no side is brighter than the other');
  assert.ok(COMPARE_ANCHOR_X < mid);
});

test('the compositions use no raw colour and no style attribute anywhere in the markup', () => {
  for (const id of COMPOSITION_IDS) {
    const svg = COMPOSITIONS[id].svg;
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(svg), `${id} has a hex colour`);
    assert.ok(!/\b(fill|stroke)="/.test(svg), `${id} sets a fill or stroke attribute instead of a class`);
    assert.ok(!/style=/.test(svg), `${id} has a style attribute`);
  }
});

test('the scan catches text, an image, a person, a logo, a product, a chart axis and a style attribute (self-test)', () => {
  const frame = (inner: string): string => `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
  const planted: ReadonlyArray<readonly [string, string, string]> = [
    ['text', frame('<text>12</text>'), 'text'],
    ['digit text', frame('<g>7</g>'), 'text'],
    ['image', frame('<image width="10" height="10"/>'), 'element'],
    ['external use', frame('<use xlink:href="logo.svg#a"/>'), 'element'],
    ['person', frame('<g class="person"><circle r="3"/></g>'), 'subject'],
    ['logo', frame('<path class="logo-mark" d="M0 0"/>'), 'subject'],
    ['product', frame('<rect class="product-ui" width="1" height="1"/>'), 'subject'],
    ['chart axis', frame('<line class="axis" x1="0" y1="0" x2="1" y2="1"/>'), 'subject'],
    ['style attribute', frame('<polygon style="fill:red" points="0,0 1,1 2,2"/>'), 'attribute'],
    ['script', frame('<script>1</script>'), 'element'],
    ['foreignObject', frame('<foreignObject/>'), 'element'],
  ];
  for (const [what, svg, rule] of planted) {
    const found = scanComposition(svg).map((f) => f.rule);
    assert.ok(found.includes(rule), `a planted ${what} is not flagged as "${rule}" (got ${found.join(', ') || 'nothing'})`);
  }
  const oversize = frame(`<g>${'<polygon class="c-tone" points="0,0 1,1 2,2 3,3 4,4 5,5"/>'.repeat(300)}</g>`);
  assert.ok(scanComposition(oversize).some((f) => f.rule === 'size'), 'an oversize composition is flagged');
  assert.ok(scanComposition('<svg><g/></svg>').some((f) => f.rule === 'viewbox'), 'a missing viewBox is flagged');
});

test('Compositions.astro hides an unlabeled figure and names a labeled one', () => {
  const source = readFileSync(new URL('../../../src/components/brand/Compositions.astro', import.meta.url), 'utf8');
  assert.match(source, /role="img" aria-label=\{label\}/);
  assert.match(source, /aria-hidden="true"/);
  assert.match(source, /set:html=\{composition\.svg\}/);
});
