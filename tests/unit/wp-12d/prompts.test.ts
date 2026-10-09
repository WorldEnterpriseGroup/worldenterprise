import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { MODEL_MAX_EDGE } from '../../../src/assets/photo/slots.ts';
import { checkAll, loadPromptFiles } from '../../../scripts/photo/build-prompts.mjs';
import { MODEL_MAX_EDGE as RIG_MAX_EDGE, FIGURE_OFFSETS, OBJECT_OFFSETS, masterSize, parseArgs, rasterSlots, seedBase } from '../../../scripts/photo/lib/common.mjs';
import { FIGURE_PREFIX, OBJECT_PREFIX, buildPrompts, candidatePlan, figureSubject, hashPrompts, lintAssembled, lintParts } from '../../../scripts/photo/lib/prompt.mjs';
import { buildWorkList } from '../../../scripts/photo/generate.mjs';

const ROOT = new URL('../../../', import.meta.url).pathname;

interface ExtractSlot {
  id: string;
  group: string;
  kind: string;
  size: [number, number];
  people: 'forbidden' | 'optional' | 'recommended';
  generateNow: boolean;
  routes: string[];
  srcsetWidths: number[];
}
interface PromptFile {
  id: string;
  group: string;
  people: string;
  generateNow: boolean;
  hold: string | null;
  copy: { routes: string[]; anchor: string; convey: string; avoid: string };
  object: { subject: string; accent: string };
  figure: { count: number; garments: string; posture: string; table: string; activity: string; model: string; accent: string } | null;
  prompts: { object: string; figure: string | null };
  promptSha256: { object: string; figure: string | null };
}

const extract = JSON.parse(readFileSync(`${ROOT}.astro-magazine/media/shotlist-extract.json`, 'utf8')) as { slots: ExtractSlot[] };
const files = loadPromptFiles() as PromptFile[];
const raster = extract.slots.filter((slot) => slot.kind === 'raster');

function file(id: string): PromptFile {
  const found = files.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`no prompt file ${id}`);
  return structuredClone(found);
}

test('there is one prompt file per raster slot, clean, current and matching the shotlist', () => {
  assert.equal(raster.length, 38);
  assert.equal(files.length, 38);
  assert.deepEqual(checkAll(files, extract), []);
});

test('a prompt file records the page copy it sits beside, and the shotlist routes', () => {
  for (const slot of raster) {
    const prompt = file(slot.id);
    assert.deepEqual(prompt.copy.routes, slot.routes, `${slot.id} routes`);
    assert.ok(prompt.copy.anchor.length > 40, `${slot.id} names the copy it matches`);
    assert.ok(prompt.copy.convey.length > 10 && prompt.copy.avoid.length > 10, `${slot.id} says what it conveys and what it must not suggest`);
    assert.equal(prompt.generateNow, slot.generateNow, `${slot.id} generateNow`);
  }
});

test('the eight hold slots carry a reason and the thirty hold nothing', () => {
  const held = files.filter((candidate) => !candidate.generateNow).map((candidate) => candidate.id).sort();
  assert.deepEqual(held, ['band-2', 'band-3', 'inset-about', 'inset-resources', 'topic-build', 'topic-dream', 'topic-fundable', 'topic-grow']);
  for (const candidate of files) assert.equal(candidate.hold !== null, !candidate.generateNow, candidate.id);
});

test('figure variants exist on exactly the 13 slots the people policy allows (5 recommended, 8 optional)', () => {
  const withFigure = files.filter((candidate) => candidate.figure !== null);
  assert.equal(withFigure.length, 13);
  for (const candidate of withFigure) assert.notEqual(raster.find((slot) => slot.id === candidate.id)?.people, 'forbidden', candidate.id);
  assert.equal(withFigure.filter((candidate) => candidate.people === 'recommended').length, 5);
  assert.equal(withFigure.filter((candidate) => candidate.people === 'optional').length, 8);
  for (const candidate of files.filter((entry) => entry.people === 'forbidden')) assert.equal(candidate.prompts.figure, null, candidate.id);
});

test('every prompt names exactly one amber object, in the accent clause, and nothing else says amber', () => {
  for (const candidate of files) {
    for (const kind of ['object', 'figure'] as const) {
      const text = candidate.prompts[kind];
      if (text === null) continue;
      // The template says "one amber object" once and the accent names it once.
      assert.equal((text.match(/\bamber\b/gi) ?? []).length, 2, `${candidate.id} ${kind}`);
    }
  }
});

test('a prompt is the template prefix, the authored subject and the template suffix, with no negation in the authored part', () => {
  for (const candidate of files) {
    assert.ok(candidate.prompts.object.startsWith(OBJECT_PREFIX), candidate.id);
    assert.ok(candidate.prompts.object.includes(candidate.object.subject), candidate.id);
    assert.ok(candidate.prompts.object.endsWith('No text, no logos, no writing.'), candidate.id);
    if (candidate.prompts.figure !== null) {
      assert.ok(candidate.prompts.figure.startsWith(FIGURE_PREFIX), candidate.id);
      assert.match(candidate.prompts.figure, /Close-up at table height. The picture shows only .* pairs? of forearms and hands/);
      assert.match(candidate.prompts.figure, /knit|cardigan|sweater/i);
    }
    assert.ok(candidate.prompts.object.length < 1400, candidate.id);
  }
});

test('hexagons are always six-sided and no subject asks for more than seven of anything', () => {
  for (const candidate of files) {
    if (/hexagon/i.test(candidate.object.subject)) assert.match(candidate.object.subject, /six-sided/i, candidate.id);
    assert.doesNotMatch(candidate.object.subject, /\b(?:eight|nine|ten|twelve|dozen)\b/i, candidate.id);
  }
});

test('no two prompt files share a subject, so no two slots draw the same picture', () => {
  const subjects = files.map((candidate) => candidate.object.subject);
  assert.equal(new Set(subjects).size, subjects.length);
});

test('stage prompts keep key elements central (hexagon clip) and bands stay on the centre line (hero crop)', () => {
  for (const id of ['stage-dream', 'stage-build', 'stage-grow']) assert.match(file(id).prompts.object, /every key element near the middle/);
  for (const id of ['band-1', 'band-2', 'band-3', 'band-4']) assert.match(file(id).prompts.object, /horizontal centre line/);
});

test('the builder is deterministic and the stored hashes follow the prompt text', () => {
  for (const candidate of files) {
    const built = buildPrompts(candidate);
    assert.equal(built.object, candidate.prompts.object);
    assert.deepEqual(hashPrompts(built), candidate.promptSha256);
    assert.deepEqual(lintAssembled(candidate), []);
  }
});

test('the figure subject is chest-down with a stated headcount and rejects an impossible one', () => {
  const text = figureSubject({ count: 2, garments: 'navy knitwear', posture: 'seated', table: 'a pale table', activity: 'sketching', model: 'a model' });
  assert.match(text, /^Close-up at table height\. The picture shows only two pairs of forearms and hands, in navy knitwear/);
  assert.throws(() => figureSubject({ count: 4, garments: 'knitwear', posture: 'seated', table: 't', activity: 'a', model: 'm' }), /one to three/);
});

test('lintParts rejects each way a prompt goes wrong', () => {
  const mutate = (id: string, patch: (copy: PromptFile) => void): string[] => {
    const copy = file(id);
    patch(copy);
    return lintParts(copy);
  };
  assert.match(mutate('svc-c', (c) => (c.object.subject += ' There is no flag.')).join('\n'), /negation/);
  assert.match(mutate('svc-c', (c) => (c.object.subject += ' Beside a small flag.')).join('\n'), /banned or summoning noun/);
  assert.match(mutate('svc-c', (c) => (c.object.subject += ' About twelve tiles.')).join('\n'), /count above seven/);
  assert.match(mutate('svc-c', (c) => (c.object.subject = 'A hexagon tile on a table.')).join('\n'), /six-sided/);
  assert.match(mutate('svc-c', (c) => (c.object.accent = 'one tile in amber and another amber one in glass')).join('\n'), /more than once/);
  assert.match(mutate('svc-c', (c) => (c.object.accent = 'one tile in amber')).join('\n'), /no material/);
  assert.match(mutate('svc-c', (c) => (c.object.accent = 'one tile in blue glass')).join('\n'), /does not say amber/);
  assert.match(mutate('svc-c', (c) => (c.object.subject += ' Amber light falls.')).join('\n'), /mentions amber/);
  assert.match(mutate('svc-b', (c) => { if (c.figure) c.figure.garments = 'a dark suit'; }).join('\n'), /knitwear|banned/);
  assert.match(mutate('svc-b', (c) => { if (c.figure) c.figure.activity = 'looking at a laptop'; }).join('\n'), /banned/);
  assert.match(mutate('svc-b', (c) => { if (c.figure) c.figure.count = 3; }).join('\n'), /three figures only in a wide scene/);
  assert.match(mutate('band-1', (c) => { c.figure = { count: 1, garments: 'a grey cardigan', posture: 'seated', table: 'a pale table', activity: 'sketching', model: 'a model', accent: 'one tile in amber glass' }; }).join('\n'), /forbids/);
  assert.deepEqual(lintParts(file('svc-b')), []);
});

test('lintAssembled flags stored text that drifted from the builder', () => {
  const copy = file('svc-c');
  copy.prompts.object += ' extra';
  assert.match(lintAssembled(copy).join('\n'), /differs from the builder output/);
  const stale = file('svc-c');
  stale.promptSha256.object = 'a'.repeat(64);
  assert.match(lintAssembled(stale).join('\n'), /hash is stale/);
});

test('seeds follow the manifest rule: 7000 plus the raster index, with the candidate offsets the manifest check accepts', () => {
  const indexed = { slots: raster };
  assert.equal(seedBase(indexed, 'inset-program'), 7000);
  assert.equal(seedBase(indexed, 'band-1'), 7034);
  assert.throws(() => seedBase(indexed, 'og-default'), /not a raster slot/);
  assert.deepEqual([...OBJECT_OFFSETS], [0, 500]);
  assert.deepEqual([...FIGURE_OFFSETS], [1000, 1500, 2000, 2500]);
});

test('the candidate plan: two objects always, four figures only where the policy and the option allow', () => {
  const recommended = file('svc-b');
  const optional = file('svc-a');
  const forbidden = file('svc-c');
  const names = (plan: { kind: string; offset: number }[]): string[] => plan.map((c) => `${c.kind}-${c.offset}`);
  assert.deepEqual(names(candidatePlan(recommended, 7010, {})), ['object-0', 'object-500', 'figure-1000', 'figure-1500', 'figure-2000', 'figure-2500']);
  assert.deepEqual(names(candidatePlan(optional, 7010, {})), ['object-0', 'object-500']);
  assert.deepEqual(names(candidatePlan(optional, 7010, { figures: 'all' })), ['object-0', 'object-500', 'figure-1000', 'figure-1500', 'figure-2000', 'figure-2500']);
  assert.deepEqual(names(candidatePlan(recommended, 7010, { figures: 'none' })), ['object-0', 'object-500']);
  assert.deepEqual(names(candidatePlan(forbidden, 7010, { figures: 'all' })), ['object-0', 'object-500']);
  assert.deepEqual(names(candidatePlan(recommended, 7010, { candidates: 1 })), ['object-0', 'figure-1000']);
  assert.deepEqual(candidatePlan(recommended, 7010, {}).map((c) => c.seed), [7010, 7510, 8010, 8510, 9010, 9510]);
  assert.throws(() => candidatePlan(recommended, 7010, { figures: 'sometimes' }), /none, recommended or all/);
  for (const c of candidatePlan(recommended, 7010, {})) assert.equal(c.prompt, c.kind === 'object' ? recommended.prompts.object : recommended.prompts.figure);
});

test('the work list covers the 30 generate-now slots by default, the holds on request, and rejects an unknown slot', () => {
  const base = { extract, files, slotIds: undefined, includeHold: false, figures: 'recommended', candidates: Infinity };
  assert.equal(buildWorkList(base).length, 30);
  assert.equal(buildWorkList({ ...base, includeHold: true }).length, 38);
  assert.deepEqual(buildWorkList({ ...base, slotIds: ['band-2'] }).map((item: { slot: ExtractSlot }) => item.slot.id), ['band-2']);
  assert.throws(() => buildWorkList({ ...base, slotIds: ['nope'] }), /Unknown raster slot/);
  const total = buildWorkList(base).reduce((sum: number, item: { plan: unknown[] }) => sum + item.plan.length, 0);
  // 30 slots x 2 objects, plus 4 figure candidates on each recommended generate-now slot (5).
  assert.equal(total, 60 + 5 * 4);
});

test('master sizes follow decision P-1 and the rig cap equals slots.ts', () => {
  assert.equal(RIG_MAX_EDGE, MODEL_MAX_EDGE);
  assert.deepEqual(masterSize(raster.find((s) => s.id === 'band-1')), [1024, 576]);
  assert.deepEqual(masterSize(raster.find((s) => s.id === 'inset-program')), [1024, 768]);
  for (const slot of raster) assert.ok(Math.max(...masterSize(slot)) <= MODEL_MAX_EDGE, slot.id);
});

test('the argument parser takes flags, values and the = form, and refuses a flag with no value', () => {
  assert.deepEqual(parseArgs(['--slots', 'a,b', '--plan', '--candidates=2', 'x'], { booleans: ['plan'] }), { _: ['x'], slots: 'a,b', plan: true, candidates: '2' });
  assert.equal(parseArgs(['--include-hold'], { booleans: ['includeHold'] }).includeHold, true);
  assert.throws(() => parseArgs(['--model']), /needs a value/);
});

test('generate.mjs --plan lists the plan without a key or a network', () => {
  const run = spawnSync(process.execPath, ['scripts/photo/generate.mjs', '--plan', '--slots', 'band-1,svc-b'], { cwd: ROOT, encoding: 'utf8', env: { PATH: process.env.PATH ?? '', NODE_NO_WARNINGS: '1' } });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /band-1\tobject-0\tseed 7034\t1024x576/);
  assert.match(run.stdout, /svc-b\tfigure-2500/);
  assert.doesNotMatch(run.stdout, /band-1\tfigure/);
  assert.match(run.stdout, /8 candidate\(s\) across 2 slot\(s\)/);
});

test('the rig is dev tooling: nothing under src/ or public/ refers to it, and nothing it depends on ships', () => {
  const offenders: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(?:astro|ts|tsx|mjs|js|json|md|mdx|html|css|yaml|yml)$/.test(name) && readFileSync(path, 'utf8').includes('scripts/photo')) offenders.push(path.replace(ROOT, ''));
    }
  };
  walk(`${ROOT}src`);
  try {
    walk(`${ROOT}public`);
  } catch {
    // no public/ directory is fine
  }
  assert.deepEqual(offenders, []);
});
