import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { matches } from '../../../scripts/check-ownership.mjs';
import { loadOwnership } from '../../../scripts/lib/ownership-load.mjs';

// 60a.3: the counsel checklist (.astro-magazine/release/RELEASE.md) quotes copy by file and line, and tests/unit/wp-30/release-doc.test.ts
// pins each quote. A package that edits a pinned file must edit the checklist in the same commit, so the owner registers a scoped exception.
// The test reads RELEASE.md only, so refreshing the checklist is enough; WP-99 stays the release owner (serialize_with_release).

interface Assignment {
  readonly owner: string;
  readonly write_set: string[];
  readonly serialize_with_release?: string[];
}
interface Ownership {
  readonly assignments: Assignment[];
  readonly exceptions: { readonly wp: string; readonly path: string; readonly reason: string }[];
}

const RELEASE = '.astro-magazine/release/RELEASE.md';
const ownership = loadOwnership() as unknown as Ownership;
const doc = readFileSync(new URL(`../../../${RELEASE}`, import.meta.url), 'utf8');
const pinned = [...new Set([...doc.matchAll(/^Source: `([^`:]+):\d+`/gm)].map((m) => m[1] as string))];
const wave8 = ownership.assignments.filter((a) => Number(/^WP-(\d+)/.exec(a.owner)?.[1] ?? 0) >= 60);
const releaseExceptions = ownership.exceptions.filter((e) => e.path === RELEASE);

test('the checklist pins source files', () => {
  assert.ok(pinned.length >= 15, `expected the full checklist, found ${pinned.length} source files`);
});

test('a wave 8 package whose write set holds a pinned file can edit the checklist, and only through a scoped exception', () => {
  for (const a of wave8) {
    const owns = pinned.filter((p) => matches(p, a.write_set));
    if (owns.length === 0 || a.owner === 'WP-99') continue;
    const exception = releaseExceptions.find((e) => e.wp === a.owner);
    assert.ok(exception, `${a.owner} owns pinned files (${owns.join(', ')}) and has no ${RELEASE} exception`);
    assert.ok(!a.write_set.includes(RELEASE), `${a.owner} gets the checklist through an exception, not its write set`);
  }
});

test('every wave 8 checklist exception is scoped in its reason and leaves the release owner in place', () => {
  const owners = new Set(wave8.map((a) => a.owner));
  for (const e of releaseExceptions.filter((x) => owners.has(x.wp))) {
    assert.match(e.reason, /scoped to/, `${e.wp}: the reason says what the exception is scoped to`);
    assert.match(e.reason, /no other CR entry, no runbook section/i, `${e.wp}: the reason excludes the rest of the file`);
    assert.match(e.reason, /WP-99 stays the release owner/, `${e.wp}: the reason keeps WP-99 as the release owner`);
  }
});

test('WP-99 stays the release owner: it serializes with the release lane and only it declares the checklist', () => {
  const owner = wave8.find((a) => a.owner === 'WP-99');
  assert.ok(owner?.serialize_with_release?.includes(RELEASE), 'WP-99 serializes with RELEASE.md');
  for (const a of wave8.filter((x) => x.owner !== 'WP-99')) assert.ok(!(a.serialize_with_release ?? []).includes(RELEASE), `${a.owner} does not take over the release serialization`);
});
