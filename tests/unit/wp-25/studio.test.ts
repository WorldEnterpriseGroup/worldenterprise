import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';

// WP-25: the studio state matches the repository. The checkpoint names waves 10 and 11 with their milestones and every work package,
// keeps the last appended event (the log itself belongs to the integrator), and both state files validate against their schemas. The
// commission carries the current positioning, not the retired name or the seat framing. documents/ holds the forms go-live checklist,
// which takes no decision, and no longer the empty template placeholder.

const ROOT = new URL('../../../', import.meta.url);
const read = (path: string): string => readFileSync(new URL(path, ROOT), 'utf8');
const json = (path: string): Record<string, unknown> => JSON.parse(read(path)) as Record<string, unknown>;

interface WavePackage {
  readonly wp: string;
  readonly issue: number;
  readonly state: string;
}
interface Wave {
  readonly wave: number;
  readonly milestone_id: number;
  readonly packages: readonly WavePackage[];
}

const checkpoint = json('.astro-magazine/checkpoint.json');
const commission = json('.astro-magazine/commission.json');

test('checkpoint and commission validate against their schemas', () => {
  const ajv = new Ajv2020({ strict: false });
  for (const name of ['checkpoint', 'commission']) {
    const validate = ajv.compile(json(`.astro-magazine/schemas/${name}.schema.json`));
    assert.ok(validate(name === 'checkpoint' ? checkpoint : commission), `${name}: ${JSON.stringify(validate.errors)}`);
  }
});

test('the checkpoint lists waves 10 and 11 with their milestones and every work package', () => {
  assert.equal(checkpoint.phase, 'wave-11');
  const waves = checkpoint.waves as readonly Wave[];
  const byNumber = new Map(waves.map((wave) => [wave.wave, wave]));
  assert.equal(byNumber.get(10)?.milestone_id, 1810);
  assert.equal(byNumber.get(11)?.milestone_id, 1811);
  assert.deepEqual(byNumber.get(10)?.packages.map((p) => p.wp).filter((wp) => /^WP-3[2-8]$/.test(wp)), ['WP-32', 'WP-33', 'WP-34', 'WP-35', 'WP-36', 'WP-37', 'WP-38']);
  assert.deepEqual(byNumber.get(11)?.packages.map((p) => p.wp), ['WP-22', 'WP-23', 'WP-24', 'WP-25', 'WP-26']);
  assert.deepEqual(byNumber.get(11)?.packages.map((p) => p.issue), [88, 89, 90, 91, 92]);
  for (const wave of waves) for (const item of wave.packages) assert.ok(item.state.length > 0, `${item.wp} has no state`);
});

test('the checkpoint points at an event that is in the log and names a next action with an owner', () => {
  const events = read('.astro-magazine/events.ndjson')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as { seq: number; event_hash: string });
  const { seq, hash } = checkpoint.last_event as { seq: number; hash: string };
  assert.ok(events.some((event) => event.seq === seq && event.event_hash === hash), `event ${seq} is not in events.ndjson`);
  const next = checkpoint.next_action as { owner?: string; action?: string };
  assert.ok((next.owner ?? '').length > 0 && (next.action ?? '').length > 0);
  assert.doesNotMatch(next.action ?? '', /Wave 1 work packages/);
});

test('the commission carries the current positioning', () => {
  const text = JSON.stringify(commission);
  assert.doesNotMatch(text, /World Enterprise Incubator/i);
  assert.doesNotMatch(text, /\bseats?\b|offshore|employer of record/i);
  assert.doesNotMatch(text, /\bfree\b/i);
  assert.doesNotMatch(text, /\bGroup\b(?! Incorporated)/);
  const publication = commission.publication as { thesis: string; publisher_legal_name: string };
  assert.match(publication.thesis, /long-horizon business incubation and consulting/i);
  assert.equal(publication.publisher_legal_name, 'World Enterprise Group Incorporated');
});

test('documents/ holds the forms checklist, which decides nothing and keeps every form disabled', () => {
  assert.equal(existsSync(new URL('documents/research.md', ROOT)), false);
  const checklist = read('documents/forms-go-live-checklist.md');
  for (const heading of ['Inventory', 'What personal data', 'Decisions needed', 'Files an engineer would change', 'Decision record']) {
    assert.match(checklist, new RegExp(`^## \\d\\. ${heading}`, 'm'));
  }
  for (const topic of ['Endpoint and processor', 'Privacy notice', 'Consent wording', 'Retention', 'Spam protection', 'connect-src', 'Accessibility of errors']) {
    assert.match(checklist, new RegExp(`^### 3\\.\\d .*${topic}`, 'm'), topic);
  }
  const record = checklist.slice(checklist.indexOf('## 5.'));
  const rows = record.split('\n').filter((line) => /^\| (?!Decision|---)/.test(line));
  assert.ok(rows.length >= 7);
  for (const row of rows) assert.match(row, /\| Open \|/, `decided in the checklist: ${row}`);
  const prose = checklist.replace(/`[^`]*`/g, '');
  assert.doesNotMatch(prose, /\bfree\b|\bseats?\b|[$€£]\s?\d|World Enterprise Incubator/i);
  assert.doesNotMatch(prose, /\bGroup\b(?! Incorporated)/);
});
