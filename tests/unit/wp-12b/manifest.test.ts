import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import sharp from 'sharp';
import { ALL_SLOT_IDS, MODEL_MAX_EDGE, SLOT_SPECS } from '../../../src/assets/photo/slots.ts';
import { checkManifest, expectedMaster, sha256 } from './manifest-check.ts';
import type { Extract, Manifest, ManifestRow } from './manifest-check.ts';

const ROOT = new URL('../../../', import.meta.url).pathname;
const readJson = <T>(path: string): T => JSON.parse(readFileSync(`${ROOT}${path}`, 'utf8')) as T;

const extract = readJson<Extract & { meta: { sources: Record<string, { sha256: string }> } }>('.astro-magazine/media/shotlist-extract.json');
const manifest = readJson<Manifest>('src/assets/photo/manifest.json');

function clone(): Manifest {
  return structuredClone(manifest);
}

function row(copy: Manifest, id: string): ManifestRow {
  const found = copy.slots.find((slot) => slot.id === id);
  if (!found) throw new Error(`no row ${id}`);
  return found;
}

/** A manifest with `id` turned into a generated image, the way phase B records one. */
function withGenerated(id: string, patch: Partial<ManifestRow> = {}): Manifest {
  const copy = clone();
  const prompt = 'Editorial still life photograph of a hand-built tabletop model, deep blue, white, soft grey, one small warm amber accent';
  Object.assign(row(copy, id), {
    source: 'generated',
    model: 'Boogu/Boogu-Image-0.1-Turbo',
    prompt,
    promptSha256: sha256(prompt),
    generatedAt: '2026-10-10',
    alt: 'A tabletop model of hexagonal paper tiles in blue and white with one small amber tile.',
    ...patch,
  });
  return copy;
}

test('the shotlist extract covers the 47 slots and the policy counts: 13 may carry a figure, 34 may not', () => {
  assert.equal(extract.slots.length, 47);
  assert.deepEqual(extract.slots.map((s) => s.id), [...ALL_SLOT_IDS]);
  const count = (people: string): number => extract.slots.filter((s) => s.people === people).length;
  assert.equal(count('recommended'), 5);
  assert.equal(count('optional'), 8);
  assert.equal(count('forbidden'), 34);
  assert.equal(extract.peoplePolicy.caps.figureSlotsAtLaunch, 6);
  for (const source of Object.values(extract.meta.sources)) assert.match(source.sha256, /^[0-9a-f]{64}$/);
});

test('the committed manifest is valid against the shotlist: every slot present, sizes, aspects, widths, people, provenance and alt', () => {
  assert.deepEqual(checkManifest(manifest, extract), []);
});

test('raster masters are the shotlist size scaled to the model edge, and OG cards keep their size', () => {
  const sizeOf = (id: string): [number, number] => {
    const slot = extract.slots.find((s) => s.id === id);
    if (!slot) throw new Error(id);
    return expectedMaster(slot);
  };
  assert.deepEqual(sizeOf('band-1'), [1024, 576], 'the 2048x1152 band is waived to 1x (P-1)');
  assert.deepEqual(sizeOf('band-3'), [1024, 576], 'the 1536x864 band is waived to 1x');
  assert.deepEqual(sizeOf('svc-a'), [1024, 768]);
  assert.deepEqual(sizeOf('og-home'), [1200, 630]);
  for (const spec of SLOT_SPECS) {
    if (spec.group !== 'og') assert.ok(Math.max(spec.width, spec.height) <= MODEL_MAX_EDGE, `${spec.id} is within the model edge`);
  }
});

test('every committed AVIF has the size and byte count the manifest records', async () => {
  for (const slot of manifest.slots) {
    assert.equal(statSync(`${ROOT}${slot.path}`).size, slot.bytes, `${slot.id} bytes`);
    const meta = await sharp(`${ROOT}${slot.path}`).metadata();
    assert.equal(meta.format, 'heif', `${slot.id} is AVIF`);
    assert.deepEqual([meta.width, meta.height], [slot.width, slot.height], `${slot.id} pixel size`);
  }
});

test('every slot file hashes to a distinct image, so no two slots share a file by accident', () => {
  const seen = new Map<string, string>();
  for (const slot of manifest.slots) {
    const hash = createHash('sha256').update(readFileSync(`${ROOT}${slot.path}`)).digest('hex');
    assert.equal(seen.get(hash), undefined, `${slot.id} duplicates ${seen.get(hash) ?? ''}`);
    seen.set(hash, slot.id);
  }
});

test('a missing, extra or duplicated slot is reported', () => {
  const missing = clone();
  missing.slots = missing.slots.filter((slot) => slot.id !== 'svc-c');
  assert.match(checkManifest(missing, extract).join('\n'), /svc-c: is in the shotlist but missing/);
  const extra = clone();
  extra.slots.push({ ...row(extra, 'svc-c'), id: 'svc-z' });
  assert.match(checkManifest(extra, extract).join('\n'), /svc-z: is in the manifest but not in the shotlist/);
  const twice = clone();
  twice.slots.push({ ...row(twice, 'svc-c') });
  assert.match(checkManifest(twice, extract).join('\n'), /svc-c: appears twice/);
});

test('a wrong master size, aspect, widths or people class is reported', () => {
  const size = clone();
  row(size, 'band-1').width = 2048;
  row(size, 'band-1').height = 1152;
  assert.match(checkManifest(size, extract).join('\n'), /band-1: master is 2048x1152, expected 1024x576/);
  const aspect = clone();
  row(aspect, 'svc-a').aspect = '16:9';
  assert.match(checkManifest(aspect, extract).join('\n'), /svc-a: aspect 16:9/);
  const widths = clone();
  row(widths, 'svc-a').widths = [512, 768, 2048];
  assert.match(checkManifest(widths, extract).join('\n'), /svc-a: widths/);
  const people = clone();
  row(people, 'svc-c').people = 'optional';
  assert.match(checkManifest(people, extract).join('\n'), /svc-c: people class optional/);
});

test('generic, short, filler and repeated alt text is reported', () => {
  for (const alt of ['', 'Photo of a model on a table with blue tiles', 'Image', 'Blue tiles', 'A tabletop model']) {
    const copy = clone();
    row(copy, 'svc-a').alt = alt;
    assert.notDeepEqual(checkManifest(copy, extract), [], `alt "${alt}" is rejected`);
  }
  const twin = clone();
  row(twin, 'svc-b').alt = row(twin, 'svc-a').alt;
  assert.match(checkManifest(twin, extract).join('\n'), /svc-b: alt is identical to svc-a/);
});

test('a generated slot needs a model, a prompt and a matching prompt hash, and a new alt that names no identity', () => {
  assert.deepEqual(checkManifest(withGenerated('svc-a'), extract), []);
  assert.match(checkManifest(withGenerated('svc-a', { model: null }), extract).join('\n'), /svc-a: generated without a model/);
  assert.match(checkManifest(withGenerated('svc-a', { prompt: '' }), extract).join('\n'), /svc-a: generated without a prompt/);
  assert.match(checkManifest(withGenerated('svc-a', { promptSha256: 'f'.repeat(64) }), extract).join('\n'), /promptSha256 does not match/);
  assert.match(checkManifest(withGenerated('svc-a', { generatedAt: 'last week' }), extract).join('\n'), /generatedAt/);
  assert.match(checkManifest(withGenerated('svc-a', { alt: 'A founder reviewing a tabletop model of blue hexagonal tiles.' }), extract).join('\n'), /names an identity or role/);
  assert.match(checkManifest(withGenerated('svc-a', { alt: 'Two people working at a tabletop model of blue hexagonal tiles.' }), extract).join('\n'), /mentions a person but figures is 0/);
  assert.match(checkManifest(withGenerated('og-home'), extract).join('\n'), /og-home: an OG card is composed from SVG/);
});

test('the seed is the slot seed plus a candidate offset, and a vector slot uses the slot seed itself', () => {
  assert.match(checkManifest(withGenerated('svc-a', { seed: 7011 + 501 }), extract).join('\n'), /svc-a: seed 7512/);
  assert.deepEqual(checkManifest(withGenerated('svc-a', { seed: 7011 + 500 }), extract), []);
  assert.deepEqual(checkManifest(withGenerated('svc-b', { seed: 7012 + 2500, figures: 1, alt: 'A person at a tabletop model of blue hexagonal tiles.' }), extract).filter((p) => !/mentions a person/.test(p)), []);
  const vector = clone();
  row(vector, 'svc-a').seed = 7011 + 500;
  assert.match(checkManifest(vector, extract).join('\n'), /svc-a: vector seed/);
});

test('the people class is respected: no figure on a forbidden slot, none beyond the caps, one per page, the stage trio together', () => {
  const figure = { figures: 1, alt: 'One person seen from the chest down, working at a tabletop model of blue hexagonal tiles.' };
  const withFigure = (id: string, copy: Manifest): Manifest => {
    Object.assign(row(copy, id), figure, {
      source: 'generated',
      model: 'Boogu/Boogu-Image-0.1-Turbo',
      prompt: `figure ${id}`,
      promptSha256: sha256(`figure ${id}`),
      generatedAt: '2026-10-10',
    });
    row(copy, id).alt = `${figure.alt.replace('.', '')} for ${id}.`;
    return copy;
  };
  const forbidden = withFigure('svc-c', clone());
  assert.match(checkManifest(forbidden, extract).join('\n'), /svc-c: carries a figure but the people policy forbids one/);
  const allowed = withFigure('svc-b', clone());
  assert.deepEqual(checkManifest(allowed, extract), [], 'a recommended slot may carry one figure');
  const pageTwice = withFigure('inset-playbooks', withFigure('pb-1', clone()));
  assert.match(checkManifest(pageTwice, extract).join('\n'), /more than one figure image on a page/);
  const stageOne = withFigure('stage-dream', clone());
  assert.match(checkManifest(stageOne, extract).join('\n'), /three stage images must all carry a figure or none/);
  let all = clone();
  for (const id of ['stage-dream', 'stage-build', 'stage-grow', 'svc-a', 'svc-b', 'svc-d', 'research-4']) all = withFigure(id, all);
  assert.match(checkManifest(all, extract).join('\n'), /7 figure images, the cap is 6/);
});
