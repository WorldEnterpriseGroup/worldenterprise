// Checks the wave 8 write-set map. Usage: node overlap.mjs <writesets.json>
import { readFileSync } from 'node:fs';
import { check } from './lib.mjs';

const file = process.argv[2];
if (file === undefined) {
  console.error('usage: overlap.mjs <writesets.json>');
  process.exit(2);
}
const map = JSON.parse(readFileSync(file, 'utf8'));
const { failures, serialize, sequential, stats } = check(map);

for (const line of stats.pools) console.log(`pool ${line}`);
console.log(`Patterns checked: ${stats.patterns}; frozen entries: ${stats.frozen}; wave-8 frozen additions: ${stats.frozenWave8}; photography-lane entries: ${stats.photo}; release-lane entries: ${stats.release}`);
for (const line of serialize) console.log(`serialize with the release engineer (WP-30): ${line}`);
console.log(`sequential hand-offs (packages that never run together, listed for the record): ${sequential.length}`);
for (const line of sequential) console.log(`  ${line}`);
if (failures.length === 0) {
  console.log('RESULT: zero overlaps');
} else {
  console.log(`RESULT: ${failures.length} overlap(s)`);
  for (const f of failures) console.log(`  ${f}`);
  process.exit(1);
}
