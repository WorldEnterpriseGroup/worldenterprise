import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CLAIM_IDS } from '../../../src/data/claims.ts';
import { h2SlugsOf } from './sources.ts';
import type { RepoView } from './sources.ts';

/** The decision ids `.astro-magazine/decisions.md` records, one per `### <id> ...` heading (D-1, W8-16, F-4 and the rest). */
export function decisionIdsOf(text: string): Set<string> {
  return new Set([...text.matchAll(/^#{2,4}[ \t]+([A-Z][A-Z0-9]*-[0-9A-Za-z-]+)\b/gm)].map((m) => m[1] ?? ''));
}

/** The real repository, read from disk, for the sentence rules of the sources ledger. */
export function repoViewAt(root: string): RepoView {
  const decisions = decisionIdsOf(readFileSync(join(root, '.astro-magazine/decisions.md'), 'utf8'));
  return {
    exists: (path) => existsSync(join(root, path)),
    h2Slugs: (path) => (existsSync(join(root, path)) ? h2SlugsOf(readFileSync(join(root, path), 'utf8')) : undefined),
    claimIds: new Set<string>(CLAIM_IDS),
    decisionIds: decisions,
  };
}
