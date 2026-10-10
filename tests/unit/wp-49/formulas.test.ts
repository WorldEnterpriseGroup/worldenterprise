import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { INPUT_IDS, INPUTS, METRIC_IDS, METRICS, PANELS, SOURCE_LABELS } from '../../../src/components/islands/we-calc/formulas.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const BRIEF = readFileSync(join(root, 'src/content/research/early-stage-saas-metrics-definitions.md'), 'utf8');

/** The brief's appendix table: metric name to the formula as published. */
function briefTable(): ReadonlyMap<string, string> {
  const appendix = BRIEF.slice(BRIEF.indexOf('## Appendix: formula table'));
  const rows = new Map<string, string>();
  for (const line of appendix.split('\n')) {
    if (!line.startsWith('|') || /^\|\s*-/.test(line) || /^\|\s*Metric\s*\|/.test(line)) continue;
    const cells = line.split('|').map((cell) => cell.trim());
    const [, metric, formula] = cells;
    if (metric !== undefined && formula !== undefined && metric !== '') rows.set(metric, formula);
  }
  return rows;
}

test('the brief table parses and holds the metrics this tool relies on', () => {
  const table = briefTable();
  for (const name of ['MRR', 'ARR', 'Customer churn', 'NRR', 'CAC, simple', 'CAC, extended', 'CLV']) assert.ok(table.has(name), name);
});

test('a metric taken from the brief carries the brief formula character for character', () => {
  const table = briefTable();
  const fromBrief = METRICS.filter((m) => m.source === 'brief');
  assert.deepEqual(fromBrief.map((m) => m.id).sort(), ['cac', 'ltv', 'nrr']);
  for (const metric of fromBrief) {
    assert.notEqual(metric.briefMetric, null, metric.id);
    assert.equal(table.get(metric.briefMetric ?? ''), metric.briefFormula, `${metric.id}: briefFormula differs from the brief table`);
    assert.equal(metric.formula, metric.briefFormula, `${metric.id}: the formula shown differs from the brief`);
  }
});

test('a reference metric is one the brief does not define, and says so', () => {
  const table = briefTable();
  const references = METRICS.filter((m) => m.source === 'reference');
  assert.deepEqual(references.map((m) => m.id).sort(), ['cacPayback', 'ltvToCac', 'netNewMrr', 'quickRatio', 'revenueChurn', 'runway']);
  const definedInBrief = [...table.keys()].map((name) => name.toLowerCase());
  for (const metric of references) {
    assert.equal(metric.briefMetric, null);
    assert.equal(metric.briefFormula, null);
    for (const word of ['quick ratio', 'payback', 'runway', 'net new', 'revenue churn']) {
      if (metric.name.toLowerCase().includes(word)) assert.ok(!definedInBrief.some((name) => name.includes(word)), `${metric.id} is defined in the brief after all`);
    }
    assert.ok(!BRIEF.toLowerCase().includes(metric.name.toLowerCase()), `${metric.id} appears in the brief`);
  }
});

test('every reference metric links a public https page, and the same page is recorded in the sources file', () => {
  const recorded = readFileSync(join(root, '.astro-magazine/sources/wp-49.json'), 'utf8');
  for (const metric of METRICS) {
    if (metric.source === 'brief') {
      assert.equal(metric.reference, null, `${metric.id}: a brief formula needs no outside page`);
      continue;
    }
    assert.notEqual(metric.reference, null, `${metric.id} has no public reference`);
    const reference = metric.reference;
    if (reference === null) continue;
    assert.match(reference.url, /^https:\/\/[a-z0-9.-]+\/[\w\-./]+$/, metric.id);
    assert.ok(reference.title.length > 0 && reference.publisher.length > 0, metric.id);
    assert.ok(recorded.includes(reference.url), `${metric.id}: ${reference.url} is not in .astro-magazine/sources/wp-49.json`);
  }
  const urls = METRICS.flatMap((m) => (m.reference === null ? [] : [m.reference.url]));
  assert.equal(new Set(urls).size, urls.length, 'each reference is used once');
});

test('the labels say a reference formula is a convention, not a WE method', () => {
  assert.match(SOURCE_LABELS.reference, /commonly calculated/i);
  assert.match(SOURCE_LABELS.reference, /not a WE method/);
});

test('the brief says ratios of lifetime value to cost are quoted, and publishes no target', () => {
  assert.match(BRIEF, /ratio of lifetime value to acquisition cost is sometimes quoted/);
  assert.match(BRIEF, /publishes no target/);
});

test('every metric and input is listed once, in a panel that exists, and needs only inputs that exist', () => {
  assert.deepEqual(METRICS.map((m) => m.id), [...METRIC_IDS]);
  assert.deepEqual(INPUTS.map((i) => i.id), [...INPUT_IDS]);
  const panels = new Set(PANELS.map((p) => p.id));
  for (const input of INPUTS) assert.ok(panels.has(input.panel), input.id);
  for (const metric of METRICS) {
    assert.ok(panels.has(metric.panel), metric.id);
    assert.ok(metric.needs.length > 0, metric.id);
    for (const need of metric.needs) assert.ok(INPUT_IDS.includes(need), `${metric.id} needs ${need}`);
  }
  assert.equal(new Set(INPUTS.map((i) => i.label)).size, INPUTS.length, 'labels are unique');
});

test('an input hint fits the two lines reserved for it', () => {
  for (const input of INPUTS) assert.ok(input.hint.length <= 72, `${input.id}: ${input.hint.length} characters`);
});
