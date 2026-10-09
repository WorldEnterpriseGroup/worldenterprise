import { createHash } from 'node:crypto';
import { MODEL_MAX_EDGE, SLOT_SPECS } from '../../../src/assets/photo/slots.ts';
import type { PeopleClass, SlotAspect } from '../../../src/assets/photo/slots.ts';

/**
 * Validation of src/assets/photo/manifest.json against the shotlist extract (.astro-magazine/media/shotlist-extract.json) and the
 * slot table in slots.ts. Returns one message per problem so a test can assert a clean manifest and each way it can go wrong.
 */

export interface ManifestRow {
  id: string;
  group: string;
  kind: string;
  profile: string;
  aspect: string;
  width: number;
  height: number;
  widths: number[];
  people: string;
  figures: number;
  source: string;
  model: string | null;
  seed: number;
  prompt: string | null;
  promptSha256: string | null;
  generatedAt: string;
  alt: string;
  bytes: number;
  path: string;
}

export interface Manifest {
  version: number;
  slots: ManifestRow[];
}

export interface ExtractSlot {
  id: string;
  group: string;
  kind: string;
  aspect: SlotAspect;
  size: [number, number];
  srcsetWidths: number[];
  routes: string[];
  people: PeopleClass;
}

export interface Extract {
  peoplePolicy: { caps: { figureSlotsAtLaunch: number; allowedCount: number; recommendedCount: number; forbiddenCount: number } };
  slots: ExtractSlot[];
}

export const SOURCES = ['vector', 'generated'] as const;
const SEED_OFFSETS = [0, 500, 1000, 1500, 2000, 2500];
const FILLER_ALT = /^(?:image|photo|picture|graphic|img|image of|photo of|picture of|a photo of|an image of)\b/i;
/** Words that name a person or a role. A generated image's alt text describes what is shown, never who anyone is (audit rule Q-photo-alt). */
const IDENTITY = /\b(?:founders?|ceo|cto|staff|employees?|clients?|customers?|investors?|partners?|mentors?|operators?|members?|team of|our team|we team)\b/i;
const PERSON = /\b(?:person|people|man|men|woman|women|figures?|hands?|face|faces|heads?|silhouettes?|crowd|audience|colleagues?|workers?|students?)\b/i;

/** The master a slot ships: the shotlist size scaled so the long edge is at most MODEL_MAX_EDGE (decision P-1). OG cards are composed from SVG and exempt. */
export function expectedMaster(slot: ExtractSlot): [number, number] {
  const [w, h] = slot.size;
  if (slot.kind !== 'raster') return [w, h];
  const long = Math.max(w, h);
  if (long <= MODEL_MAX_EDGE) return [w, h];
  const scale = MODEL_MAX_EDGE / long;
  return [Math.round(w * scale), Math.round(h * scale)];
}

export function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function checkManifest(manifest: Manifest, extract: Extract): string[] {
  const problems: string[] = [];
  const fail = (id: string, message: string): number => problems.push(`${id}: ${message}`);
  if (manifest.version !== 2) problems.push(`manifest version is ${manifest.version}, expected 2`);

  const byId = new Map<string, ManifestRow>();
  for (const row of manifest.slots) {
    if (byId.has(row.id)) fail(row.id, 'appears twice');
    byId.set(row.id, row);
  }
  const specs = new Map(SLOT_SPECS.map((spec) => [spec.id, spec]));
  for (const slot of extract.slots) if (!byId.has(slot.id)) fail(slot.id, 'is in the shotlist but missing from the manifest');
  for (const id of byId.keys()) if (!extract.slots.some((slot) => slot.id === id)) fail(id, 'is in the manifest but not in the shotlist');

  // Seed bases follow the slot order: 7000 + index over the raster slots, 7100 + index over the OG cards.
  const rasterOrder = extract.slots.filter((slot) => slot.kind === 'raster').map((slot) => slot.id);
  const ogOrder = extract.slots.filter((slot) => slot.kind !== 'raster').map((slot) => slot.id);
  const altSeen = new Map<string, string>();
  const figureSlots: ManifestRow[] = [];

  for (const slot of extract.slots) {
    const row = byId.get(slot.id);
    const spec = specs.get(slot.id);
    if (!row) continue;
    if (!spec) {
      fail(slot.id, 'has no entry in slots.ts');
      continue;
    }
    if (row.group !== slot.group) fail(slot.id, `group ${row.group}, shotlist says ${slot.group}`);
    if (row.kind !== slot.kind) fail(slot.id, `kind ${row.kind}, shotlist says ${slot.kind}`);

    const [w, h] = expectedMaster(slot);
    if (row.width !== w || row.height !== h) fail(slot.id, `master is ${row.width}x${row.height}, expected ${w}x${h}`);
    if (spec.width !== w || spec.height !== h) fail(slot.id, `slots.ts says ${spec.width}x${spec.height}, expected ${w}x${h}`);
    if (row.aspect !== slot.aspect || spec.aspect !== slot.aspect) fail(slot.id, `aspect ${row.aspect} (slots.ts ${spec.aspect}), shotlist says ${slot.aspect}`);
    if (JSON.stringify(row.widths) !== JSON.stringify(spec.widths)) fail(slot.id, `widths ${JSON.stringify(row.widths)} differ from slots.ts ${JSON.stringify(spec.widths)}`);
    if (row.widths.some((width, i) => i > 0 && width <= (row.widths[i - 1] ?? 0))) fail(slot.id, 'widths are not ascending');
    if (slot.kind === 'raster' && row.widths.at(-1) !== row.width) fail(slot.id, 'the widest srcset width is not the master');
    if (row.widths.some((width) => width > row.width)) fail(slot.id, 'a srcset width is wider than the master');
    if (slot.kind === 'raster') {
      const allowed = slot.srcsetWidths.filter((width) => width <= w);
      if (row.widths.some((width) => !allowed.includes(width) && width !== w)) fail(slot.id, `widths ${JSON.stringify(row.widths)} are not from the shotlist set ${JSON.stringify(slot.srcsetWidths)}`);
    }
    if (row.bytes <= 0 || !row.path.startsWith('src/assets/')) fail(slot.id, 'bytes or path missing');

    if (row.people !== slot.people || spec.people !== slot.people) fail(slot.id, `people class ${row.people} (slots.ts ${spec.people}), policy says ${slot.people}`);
    if (!Number.isInteger(row.figures) || row.figures < 0) fail(slot.id, 'figures is not a count');
    if (row.figures > 0) {
      figureSlots.push(row);
      if (slot.people === 'forbidden') fail(slot.id, 'carries a figure but the people policy forbids one');
      if (row.source !== 'generated') fail(slot.id, 'claims a figure but is not generated');
      if (row.figures > 2) fail(slot.id, `${row.figures} figures, at most two in a card or stage image`);
    }

    // Provenance.
    if (!(SOURCES as readonly string[]).includes(row.source)) fail(slot.id, `source "${row.source}" is neither vector nor generated`);
    if (!/^\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z?)?$/.test(row.generatedAt) || Number.isNaN(Date.parse(row.generatedAt))) fail(slot.id, `generatedAt "${row.generatedAt}" is not an ISO date`);
    const base = (slot.kind === 'raster' ? 7000 + rasterOrder.indexOf(slot.id) : 7100 + ogOrder.indexOf(slot.id));
    if (!Number.isInteger(row.seed) || !SEED_OFFSETS.includes(row.seed - base)) fail(slot.id, `seed ${row.seed} is not ${base} plus a candidate offset`);
    if (row.source === 'vector') {
      if (row.model !== null || row.prompt !== null || row.promptSha256 !== null) fail(slot.id, 'a vector slot has no model or prompt');
      if (row.seed !== base) fail(slot.id, `vector seed ${row.seed}, expected ${base}`);
    } else if (row.source === 'generated') {
      if (slot.kind !== 'raster') fail(slot.id, 'an OG card is composed from SVG and is never generated');
      if (typeof row.model !== 'string' || row.model.trim() === '') fail(slot.id, 'generated without a model');
      if (typeof row.prompt !== 'string' || row.prompt.trim() === '') fail(slot.id, 'generated without a prompt');
      else if (row.promptSha256 !== sha256(row.prompt)) fail(slot.id, 'promptSha256 does not match the prompt');
    }

    // Alt text.
    if (typeof row.alt !== 'string' || row.alt.trim() === '') {
      fail(slot.id, 'alt text is missing');
    } else {
      if (FILLER_ALT.test(row.alt.trim())) fail(slot.id, `alt starts with filler: "${row.alt.slice(0, 40)}"`);
      if (row.alt.trim().length < 30 || wordCount(row.alt) < 6) fail(slot.id, `alt is too short to describe the image: "${row.alt}"`);
      const twin = altSeen.get(row.alt.trim().toLowerCase());
      if (twin !== undefined) fail(slot.id, `alt is identical to ${twin}`);
      altSeen.set(row.alt.trim().toLowerCase(), slot.id);
      if (row.source === 'generated') {
        if (IDENTITY.test(row.alt)) fail(slot.id, `alt names an identity or role: "${row.alt}"`);
        if (row.figures === 0 && PERSON.test(row.alt)) fail(slot.id, `alt mentions a person but figures is 0: "${row.alt}"`);
      }
    }
  }

  // Figure caps (people-policy.json): at most six figure images at launch, at most one per page except the stage trio, the stage trio all or none.
  const caps = extract.peoplePolicy.caps;
  if (figureSlots.length > caps.figureSlotsAtLaunch) problems.push(`${figureSlots.length} figure images, the cap is ${caps.figureSlotsAtLaunch}`);
  const routeOwners = new Map<string, string[]>();
  for (const row of figureSlots) {
    const slot = extract.slots.find((s) => s.id === row.id);
    for (const route of slot?.routes ?? []) routeOwners.set(route, [...(routeOwners.get(route) ?? []), row.id]);
  }
  for (const [route, ids] of routeOwners) {
    const stageOnly = ids.every((id) => id.startsWith('stage-'));
    if (ids.length > 1 && !stageOnly) problems.push(`${route}: ${ids.join(', ')} are more than one figure image on a page`);
  }
  const stages = manifest.slots.filter((row) => row.group === 'stage');
  const stageFigures = stages.filter((row) => row.figures > 0).length;
  if (stageFigures !== 0 && stageFigures !== stages.length) problems.push('the three stage images must all carry a figure or none');

  const counts: Record<PeopleClass, number> = { forbidden: 0, optional: 0, recommended: 0 };
  for (const slot of extract.slots) counts[slot.people] += 1;
  if (counts.recommended + counts.optional !== caps.allowedCount) problems.push(`${counts.recommended + counts.optional} slots allow a figure, the policy says ${caps.allowedCount}`);
  if (counts.forbidden !== caps.forbiddenCount) problems.push(`${counts.forbidden} slots forbid a figure, the policy says ${caps.forbiddenCount}`);
  return problems;
}
