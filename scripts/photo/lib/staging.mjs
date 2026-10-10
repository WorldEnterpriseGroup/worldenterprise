// Candidate staging: one directory per model and slot, one image plus one JSON sidecar per candidate. Resume is "the sidecar and the
// image both exist". Staging lives outside the repo (DEFAULT_STAGING) so nothing here can be committed by accident.
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function slotDir(staging, routerModel, slotId) {
  return join(staging, routerModel, slotId);
}

/** `object-0`, `figure-1500`: kind and seed offset identify a candidate within its slot. */
export function candidateKey(kind, offset) {
  return `${kind}-${offset}`;
}

export function sidecarPath(dir, kind, offset) {
  return join(dir, `${candidateKey(kind, offset)}.json`);
}

/** Written candidate or null. A sidecar without its image (an interrupted write) counts as not done. */
export function readCandidate(dir, kind, offset) {
  const sidecar = sidecarPath(dir, kind, offset);
  if (!existsSync(sidecar)) return null;
  let meta;
  try {
    meta = JSON.parse(readFileSync(sidecar, 'utf8'));
  } catch (error) {
    throw new Error(`Corrupt sidecar ${sidecar}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
  const image = join(dir, meta.file);
  return existsSync(image) ? { ...meta, imagePath: image } : null;
}

/** Done means done for this exact prompt: a candidate generated from an older prompt is regenerated. */
export function isDone(dir, kind, offset, promptSha256) {
  const candidate = readCandidate(dir, kind, offset);
  return candidate !== null && candidate.promptSha256 === promptSha256;
}

/** Write image then sidecar, each through a temp name, so a crash never leaves a sidecar that points at a half-written image. */
export function writeCandidate(dir, kind, offset, bytes, extension, meta) {
  mkdirSync(dir, { recursive: true });
  const file = `${candidateKey(kind, offset)}.${extension}`;
  const imageTmp = join(dir, `${file}.tmp`);
  writeFileSync(imageTmp, bytes);
  renameSync(imageTmp, join(dir, file));
  const sidecar = sidecarPath(dir, kind, offset);
  writeFileSync(`${sidecar}.tmp`, `${JSON.stringify({ ...meta, kind, offset, file }, null, 2)}\n`);
  renameSync(`${sidecar}.tmp`, sidecar);
  return join(dir, file);
}

/** All candidates of a slot, sorted object first then by offset. */
export function listCandidates(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => /^(?:object|figure)-\d+\.json$/.test(name))
    .map((name) => {
      const [, kind, offset] = /^(object|figure)-(\d+)\.json$/.exec(name);
      return readCandidate(dir, kind, Number(offset));
    })
    .filter((candidate) => candidate !== null)
    .sort((a, b) => (a.kind === b.kind ? a.offset - b.offset : a.kind === 'object' ? -1 : 1));
}
