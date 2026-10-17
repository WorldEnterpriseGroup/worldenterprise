import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { VisualContractError, apportion, flowLayout, thousands } from '../../../src/components/visuals/charts/dataviz.ts';
import { BFS_APPLICATIONS_TOTAL, BFS_FORMATIONS_4Q, BFS_FORMATIONS_8Q } from '../../../src/data/datasets/bfs.generated.ts';
import { formationFlow } from '../../../src/data/datasets/figures.ts';

/** WP-35 (#84), the flow chart: the layout arithmetic, the figure props that feed it, and the table the component prints. */
const root = new URL('../../../', import.meta.url).pathname;
const read = (rel: string): string => readFileSync(join(root, rel), 'utf8');
const BOX = { width: 300, height: 340, nodeWidth: 16, gap: 22 };

const nodes = [
  { id: 'a', label: 'All', column: 0 },
  { id: 'b', label: 'Part one', column: 1 },
  { id: 'c', label: 'Part two', column: 1 },
];
const links = [
  { from: 'a', to: 'b', value: 30 },
  { from: 'a', to: 'c', value: 70 },
];

test('flowLayout draws node height and ribbon thickness to one scale, so thickness is proportional to value', () => {
  const g = flowLayout(nodes, links, BOX);
  const [a, b, c] = g.nodes;
  assert.ok(a && b && c);
  assert.equal(a.value, 100);
  assert.ok(Math.abs(a.height - 100 * g.k) < 1e-9);
  assert.ok(Math.abs(b.height / c.height - 30 / 70) < 1e-9);
  // The ribbons fill the source node exactly, and the targets are as tall as what flows into them.
  const thick = g.links.map((l) => l.thickness);
  assert.ok(Math.abs(thick[0]! + thick[1]! - a.height) < 1e-9);
  assert.ok(Math.abs(thick[0]! - b.height) < 1e-9);
  assert.ok(Math.abs(thick[1]! - c.height) < 1e-9);
  assert.deepEqual(g.links.map((l) => l.percentOfSource), [30, 70]);
});

test('flowLayout keeps every node inside the box, in columns left to right, with the gap between neighbours', () => {
  const g = flowLayout(nodes, links, BOX);
  const [a, b, c] = g.nodes;
  assert.ok(a && b && c);
  assert.equal(a.x, 0);
  assert.equal(b.x, BOX.width - BOX.nodeWidth);
  for (const n of g.nodes) assert.ok(n.y >= -1e-9 && n.y + n.height <= BOX.height + 1e-9, n.id);
  assert.ok(Math.abs(c.y - (b.y + b.height) - BOX.gap) < 1e-9);
  assert.ok(Math.abs(a.y + a.height / 2 - BOX.height / 2) < 1e-9, 'a single node is centred');
});

test('flowLayout ribbons are closed paths that start at the source edge and end at the target edge', () => {
  const g = flowLayout(nodes, links, BOX);
  for (const l of g.links) {
    assert.match(l.path, /^M[\d.\-]+ [\d.\-]+ C.* Z$/);
    assert.equal(l.path.match(/C/g)?.length, 2);
  }
  assert.ok(g.links[0]?.path.startsWith(`M${BOX.nodeWidth} `));
  assert.ok(g.links[0]?.path.includes(` L${BOX.width - BOX.nodeWidth} `));
});

test('flowLayout supports a middle column and requires that flow is conserved through it', () => {
  const three = [
    { id: 'a', label: 'A', column: 0 },
    { id: 'm', label: 'M', column: 1 },
    { id: 'x', label: 'X', column: 2 },
    { id: 'y', label: 'Y', column: 2 },
  ];
  const ok = [
    { from: 'a', to: 'm', value: 10 },
    { from: 'm', to: 'x', value: 4 },
    { from: 'm', to: 'y', value: 6 },
  ];
  const g = flowLayout(three, ok, BOX);
  assert.equal(g.nodes.find((n) => n.id === 'm')?.value, 10);
  assert.throws(() => flowLayout(three, [ok[0]!, ok[1]!, { from: 'm', to: 'y', value: 7 }], BOX), /receives 10 but passes on 11/);
});

test('flowLayout rejects links that run backwards, unknown nodes, non-positive values, duplicate ids and orphans', () => {
  assert.throws(() => flowLayout(nodes, [{ from: 'b', to: 'a', value: 1 }], BOX), VisualContractError);
  assert.throws(() => flowLayout(nodes, [{ from: 'a', to: 'zz', value: 1 }], BOX), /unknown node/);
  assert.throws(() => flowLayout(nodes, [{ from: 'a', to: 'b', value: 0 }, { from: 'a', to: 'c', value: 1 }], BOX), /positive value/);
  assert.throws(() => flowLayout([...nodes, { id: 'a', label: 'dup', column: 1 }], links, BOX), /unique/);
  assert.throws(() => flowLayout([...nodes, { id: 'z', label: 'orphan', column: 1 }], links, BOX), /no link/);
  assert.throws(() => flowLayout(nodes, [], BOX), /at least one link/);
});

test('the formation flow is the Census BFS 2021 series, and its three outflows add up to the applications filed', () => {
  const i = 2021 - 2005;
  const apps = BFS_APPLICATIONS_TOTAL[i]!;
  const f4 = BFS_FORMATIONS_4Q[i]!;
  const f8 = BFS_FORMATIONS_8Q[i]!;
  assert.deepEqual([apps, f4, f8], [5390816, 315318, 403072]);
  const byTo = Object.fromEntries(formationFlow.links.map((l) => [l.to, l.value]));
  assert.equal(byTo['formed-4q'], f4);
  assert.equal(byTo['formed-5-8q'], f8 - f4);
  assert.equal(byTo['not-formed'], apps - f8);
  assert.equal(formationFlow.links.reduce((a, l) => a + l.value, 0), apps);
  const g = flowLayout(formationFlow.nodes, formationFlow.links, BOX);
  assert.equal(g.nodes.find((n) => n.id === 'applications')?.value, apps);
  assert.equal(formationFlow.sources[0]?.href, 'https://www.census.gov/econ/bfs/csv/bfs_monthly.csv');
});

test('the formation flow agrees with the waffle beside it: 59, 16 and 925 of every 1,000 applications', () => {
  const total = formationFlow.links.reduce((a, l) => a + l.value, 0);
  assert.deepEqual(apportion(formationFlow.links.map((l) => l.value), 1000), [59, 16, 925]);
  const g = flowLayout(formationFlow.nodes, formationFlow.links, BOX);
  assert.ok(Math.abs(g.links[0]!.percentOfSource - (315318 / total) * 100) < 1e-9);
  assert.match(formationFlow.description, /5,390,816/);
  assert.match(formationFlow.description, /315,318/);
  assert.match(formationFlow.caption, /403,072/);
});

test('the component prints a table with one row per link: from, to, the exact count and the share of the source', () => {
  const src = read('src/components/visuals/charts/FlowChart.astro');
  assert.match(src, /columns: \['From', 'To', valueLabel, 'Share of the source'\]/);
  assert.match(src, /rows: geometry\.links\.map\(\(l\) => \[label\(l\.from\), label\(l\.to\), thousands\(l\.value\), `\$\{fmt\(l\.percentOfSource\)\}%`\]\)/);
  assert.match(src, /<ChartFigure \{\.\.\.props\} table=\{table\}>/);
  assert.doesNotMatch(src, /<script|\sstyle=/);
  assert.match(src, /forced-colors: active/);
  // The same rows, computed here the way the component computes them.
  const g = flowLayout(formationFlow.nodes, formationFlow.links, { width: 310, height: 340, nodeWidth: 16, gap: 22 });
  const label = (id: string): string => formationFlow.nodes.find((n) => n.id === id)?.label ?? id;
  const rows = g.links.map((l) => [label(l.from), label(l.to), thousands(l.value), `${Math.round(l.percentOfSource * 10) / 10}%`]);
  assert.deepEqual(rows, [
    ['Applications filed in 2021', 'Employer business within 4 quarters', '315,318', '5.8%'],
    ['Applications filed in 2021', 'Employer business in quarters 5 to 8', '87,754', '1.6%'],
    ['Applications filed in 2021', 'No employer business within 8 quarters', '4,987,744', '92.5%'],
  ]);
});

test('/data/formation/ renders the flow from the dataset props and lists the BFS source', () => {
  const page = read('src/pages/data/formation/index.astro');
  assert.match(page, /import FlowChart from '..\/..\/..\/components\/visuals\/charts\/FlowChart\.astro'/);
  assert.match(page, /<FlowChart \{\.\.\.formationFlow\} retrieved=\{RETRIEVED\} \/>/);
});
