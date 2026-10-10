import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PaletteCommand } from '../../../src/components/nav/commands.ts';
import { MAX_COMMANDS_SHOWN, fold, groupCommands, highlight, rankCommands, tokens } from '../../../src/components/islands/we-palette/match.ts';

const commands: readonly PaletteCommand[] = [
  { label: 'Apply', href: '/apply/', group: 'Start here' },
  { label: 'Program', href: '/program/', group: 'Program', hint: 'Explore the program' },
  { label: 'How it works', href: '/program/how-it-works/', group: 'Program', hint: 'Apply, scope, seat your team, work in focused cycles' },
  { label: 'Pricing', href: '/pricing/', group: 'Pricing' },
  { label: 'Compare seat options', href: '/pricing/', group: 'Services' },
  { label: 'Trust center', href: '/trust/', group: 'Playbooks', hint: 'How WE handles information' },
  { label: 'Café guide', href: '/cafe/', group: 'Resources' },
];

const labels = (query: string): string[] => rankCommands(commands, query).map((row) => row.command.label);

test('fold lowercases, drops accents and punctuation, and collapses space', () => {
  assert.equal(fold('  Café,  Guide! '), 'cafe guide');
  assert.equal(fold("Who it's for"), 'who it s for');
  assert.deepEqual(tokens('  '), []);
  assert.deepEqual(tokens('Seat  options'), ['seat', 'options']);
});

test('an empty query matches everything in list order', () => {
  assert.deepEqual(labels(''), commands.map((command) => command.label));
  assert.deepEqual(labels('   '), commands.map((command) => command.label));
});

test('a label that starts with the query beats a word of a label and a mention in a hint', () => {
  // "Apply" starts with "app"; "How it works" only mentions apply in its hint.
  assert.deepEqual(labels('app'), ['Apply', 'How it works']);
  assert.equal(labels('seat')[0], 'Compare seat options', 'a word of the label beats a hint');
  assert.ok(labels('seat').includes('How it works'));
});

test('every word of the query has to match, in any order', () => {
  assert.deepEqual(labels('options seat'), ['Compare seat options']);
  assert.deepEqual(labels('seat zzz'), []);
});

test('the group name matches too, after the label and the hint', () => {
  assert.deepEqual(labels('playbooks'), ['Trust center']);
});

test('accents are folded on both sides', () => {
  assert.deepEqual(labels('cafe'), ['Café guide']);
  assert.deepEqual(labels('café'), ['Café guide']);
});

test('a query that matches nothing yields nothing', () => {
  assert.deepEqual(labels('zzzz'), []);
});

test('with no query the groups keep the list order and show every command', () => {
  const groups = groupCommands(rankCommands(commands, ''), '');
  assert.deepEqual(groups.map((group) => group.name), ['Start here', 'Program', 'Pricing', 'Services', 'Playbooks', 'Resources']);
  assert.equal(groups.reduce((sum, group) => sum + group.commands.length, 0), commands.length);
});

test('with a query the list is cut to the limit and the best match is in the first group', () => {
  const many: PaletteCommand[] = Array.from({ length: 30 }, (_, i) => ({ label: `Guide ${i}`, href: `/guide-${i}/`, group: i % 2 === 0 ? 'Even' : 'Odd' }));
  const ranked = rankCommands([...many, { label: 'Guide', href: '/guide/', group: 'Exact' }], 'guide');
  const groups = groupCommands(ranked, 'guide');
  assert.equal(groups.reduce((sum, group) => sum + group.commands.length, 0), MAX_COMMANDS_SHOWN);
  assert.equal(groups[0]?.name, 'Even', 'the first group is the one of the best match, in list order among equals');
  const custom = groupCommands(ranked, 'guide', 3);
  assert.equal(custom.reduce((sum, group) => sum + group.commands.length, 0), 3);
});

test('highlight marks the matched letters and keeps every letter of the label', () => {
  const parts = highlight('Compare seat options', 'seat opt');
  assert.deepEqual(parts, [
    { text: 'Compare ', match: false },
    { text: 'seat', match: true },
    { text: ' ', match: false },
    { text: 'opt', match: true },
    { text: 'ions', match: false },
  ]);
  assert.equal(parts.map((part) => part.text).join(''), 'Compare seat options');
});

test('highlight prefers the start of a word and returns the label whole when nothing matches or the query is empty', () => {
  assert.deepEqual(highlight('Trust center', 'ce'), [
    { text: 'Trust ', match: false },
    { text: 'ce', match: true },
    { text: 'nter', match: false },
  ]);
  assert.deepEqual(highlight('Trust center', ''), [{ text: 'Trust center', match: false }]);
  assert.deepEqual(highlight('Trust center', 'zz'), [{ text: 'Trust center', match: false }]);
});
