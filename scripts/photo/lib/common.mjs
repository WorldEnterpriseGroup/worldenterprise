// Shared helpers for the photo-generation rig (WP-12d, issue #22 phase B). Dev tooling only: nothing under scripts/photo is
// imported by src/ or copied to dist/. Pure functions here are unit-tested in tests/unit/wp-12d.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PHOTO_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_ROOT = resolve(PHOTO_DIR, '..', '..');

/** Long edge of the largest master the model renders (decision P-1). Mirrors MODEL_MAX_EDGE in src/assets/photo/slots.ts; a unit test keeps them equal. */
export const MODEL_MAX_EDGE = 1024;

/** Where candidates go. Never inside the repo, so a stray `git add -A` cannot pick them up. */
export const DEFAULT_STAGING = '/home/seantech/.claude/jobs/504efe46/tmp/photo-staging';

export const EXTRACT_PATH = '.astro-magazine/media/shotlist-extract.json';
export const MANIFEST_PATH = 'src/assets/photo/manifest.json';
export const ASSET_DIR = 'src/assets/photo';

/** Candidate seed offsets (manifest seedOffsets): two object candidates, four figure candidates. */
export const OBJECT_OFFSETS = Object.freeze([0, 500]);
export const FIGURE_OFFSETS = Object.freeze([1000, 1500, 2000, 2500]);

export function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

export function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read JSON from ${path}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
}

/** Raster slots of the shotlist extract, in the order that defines the seeds (7000 + index). */
export function rasterSlots(extract) {
  return extract.slots.filter((slot) => slot.kind === 'raster');
}

export function seedBase(extract, id) {
  const index = rasterSlots(extract).findIndex((slot) => slot.id === id);
  if (index < 0) throw new Error(`"${id}" is not a raster slot in the shotlist extract.`);
  return 7000 + index;
}

/** The master a slot ships: the shotlist size scaled so the long edge is at most MODEL_MAX_EDGE (decision P-1). */
export function masterSize(slot) {
  const [w, h] = slot.size;
  const long = Math.max(w, h);
  if (long <= MODEL_MAX_EDGE) return [w, h];
  const scale = MODEL_MAX_EDGE / long;
  return [Math.round(w * scale), Math.round(h * scale)];
}

export function loadExtract(root = REPO_ROOT) {
  return readJson(join(root, EXTRACT_PATH));
}

export function loadModels() {
  return readJson(join(PHOTO_DIR, 'models.json'));
}

/** Resolve a router model id to its record; unknown ids are an error because the manifest must record a real model name. */
export function modelInfo(routerId, models = loadModels()) {
  const info = models.models[routerId];
  if (!info) {
    throw new Error(`Model "${routerId}" is not in scripts/photo/models.json (known: ${Object.keys(models.models).join(', ')}). Add it with its manifest name first.`);
  }
  return { routerId, ...info };
}

/** "1024x768" for a [w, h] pair. */
export function sizeString([w, h]) {
  return `${w}x${h}`;
}

/** Pure argv parser: `--flag`, `--key value` and `--key=value`. Repeated keys are not supported. */
export function parseArgs(argv, { booleans = [] } = {}) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      out._.push(arg);
      continue;
    }
    const eq = arg.indexOf('=');
    const key = (eq === -1 ? arg.slice(2) : arg.slice(2, eq)).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (eq !== -1) out[key] = arg.slice(eq + 1);
    else if (booleans.includes(key)) out[key] = true;
    else {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) throw new Error(`--${arg.slice(2)} needs a value.`);
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

/** Comma list to array; undefined stays undefined so callers can tell "not given" from "empty". */
export function list(value) {
  if (value === undefined) return undefined;
  return String(value).split(',').map((part) => part.trim()).filter(Boolean);
}
