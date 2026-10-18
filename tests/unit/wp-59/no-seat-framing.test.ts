import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { summariseTeam, teamAsText } from '../../../src/scripts/team-composer.ts';

/**
 * Positioning tail (WP-59, issue #80). Since 2026-10-14 World Enterprise does long-horizon incubation and consulting: it builds and
 * steers a dedicated team for a company and sells neither seats nor packages. Visible copy must not frame WE's own offer in seats.
 * Internal identifiers (seat-roles.ts, SeatDiagram, data-seat, the `seats` form field, ?topic=seat-rate) are not copy and stay.
 */
const FORBIDDEN = [
  'seat your team',
  'seat the team',
  'seats a dedicated',
  'staff a seat',
  'seats are filled',
  'a seat is a place',
  'each seat holds',
  'how many seats',
  'no seats chosen',
  'dedicated seats',
  'team seats',
  'seat roles',
  'what a seat is',
  'offshore team seats',
  'scaling seats',
  'sells seats',
  'sells packages',
  'not part of any package',
];
/** The one place the words stay: the FAQ question and its plain no. */
const ALLOWED = /Does WE sell packages or seats\?|No\. WE sells neither packages nor seats\./;

function sourceLines(): { file: string; n: number; text: string }[] {
  const files = execFileSync('git', ['ls-files', '--', 'src'], { encoding: 'utf8' }).split('\n').filter((f) => /\.(astro|ts|mdx?|ya?ml|json)$/.test(f));
  return files.flatMap((file) =>
    readFileSync(file, 'utf8')
      .split('\n')
      .map((text, i) => ({ file, n: i + 1, text })),
  );
}

test('no visible copy under src/ frames WE as providing or selling seats', () => {
  const lines = sourceLines();
  const hits = lines
    .filter((l) => !ALLOWED.test(l.text))
    .flatMap((l) => FORBIDDEN.filter((p) => l.text.toLowerCase().includes(p)).map((p) => `${l.file}:${l.n} "${p}"`));
  assert.deepEqual(hits, []);
});

test('the Team Composer counts people per role, with the right singular and plural', () => {
  assert.equal(summariseTeam({}).headline, 'No roles chosen yet.');
  assert.equal(summariseTeam({ qa: 1 }).headline, '1 person across 1 role.');
  assert.equal(summariseTeam({ qa: 2 }).headline, '2 people across 1 role.');
  assert.doesNotMatch(teamAsText({ qa: 2 }), /seat/i);
  assert.doesNotMatch(teamAsText({}), /seat/i);
});
