// Pure manifest promotion: turn chosen candidates into updated manifest rows. No I/O; promote.mjs does the encoding and writing.
import { sha256 } from './common.mjs';

/** ISO calendar date (UTC) of a Date. The manifest records dates, not times. */
export function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * The manifest row of a slot after its candidate is promoted.
 * `entry`: `{ candidate: { kind, seed, prompt, figures }, alt, bytes, quality }`.
 * Fields outside the provenance set (id, group, size, widths, people, motif, file, path) are carried over untouched.
 */
export function promotedRow(row, entry, { modelName, now }) {
  const { candidate, alt, bytes, quality } = entry;
  if (typeof modelName !== 'string' || modelName.trim() === '') throw new Error(`${row.id}: promotion needs the manifest model name.`);
  if (typeof candidate.prompt !== 'string' || candidate.prompt.trim() === '') throw new Error(`${row.id}: the candidate has no prompt text.`);
  if (typeof alt !== 'string' || alt.trim() === '') throw new Error(`${row.id}: promotion needs alt text written from the image that shipped.`);
  if (!Number.isInteger(bytes) || bytes <= 0) throw new Error(`${row.id}: encoded size is missing.`);
  if (candidate.kind === 'figure' && row.people === 'forbidden') throw new Error(`${row.id}: the people policy forbids a figure here.`);
  if (candidate.kind !== 'object' && candidate.kind !== 'figure') throw new Error(`${row.id}: candidate kind "${candidate.kind}" is neither object nor figure.`);
  return {
    ...row,
    figures: candidate.kind === 'figure' ? candidate.figures : 0,
    source: 'generated',
    model: modelName,
    seed: candidate.seed,
    prompt: candidate.prompt,
    promptSha256: sha256(candidate.prompt),
    generatedAt: isoDate(now),
    alt: alt.trim(),
    bytes,
    quality,
  };
}

/**
 * Apply a batch of promotions to a manifest and return a new manifest. All entries apply or none: an unknown slot or a duplicate
 * throws before anything is returned. The stage trio and the figure caps are checked afterwards by checkManifest on the whole result.
 * @param {{ slots: object[] }} manifest
 * @param {{ slotId: string }[]} entries each with `slotId` plus the fields promotedRow takes
 */
export function promoteRows(manifest, entries, context) {
  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.slotId)) throw new Error(`${entry.slotId} is promoted twice in one batch.`);
    seen.add(entry.slotId);
    if (!manifest.slots.some((row) => row.id === entry.slotId)) throw new Error(`${entry.slotId} is not in the manifest.`);
  }
  const byId = new Map(entries.map((entry) => [entry.slotId, entry]));
  return { ...manifest, slots: manifest.slots.map((row) => (byId.has(row.id) ? promotedRow(row, byId.get(row.id), context) : row)) };
}

/** Candidate name "object-0" / "figure-1500" to `{ kind, offset }`. */
export function parseCandidateName(name) {
  const match = /^(object|figure)-(\d+)$/.exec(name);
  if (!match) throw new Error(`Candidate "${name}" is not object-<offset> or figure-<offset>.`);
  return { kind: match[1], offset: Number(match[2]) };
}
