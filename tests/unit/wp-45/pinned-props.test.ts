import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { readAllComponentApis, readAllLayoutApis, readComponentApi } from './props.ts';
import type { ComponentApi } from './props.ts';

/**
 * Pinned props (wave 7 contracts, rule 3): WP-45 owns the ui, blocks, program, diagrams, hero and motion components and the page layouts,
 * and every other package imports them. props-baseline.json was captured from origin/demo before WP-45 changed a file. The test fails when
 * a prop, a slot or an extended type disappears, when an optional prop turns required, or when a prop's type narrows. New optional props
 * and new components are free; a deliberate break needs a new baseline and a note in the handoff of the package that asked for it.
 */

const baseline = JSON.parse(readFileSync(new URL('./props-baseline.json', import.meta.url), 'utf8')) as Record<string, ComponentApi>;
const current: Record<string, ComponentApi> = { ...readAllComponentApis(), ...readAllLayoutApis() };

const union = (type: string): Set<string> => new Set(type.split(' | ').map((t) => t.trim()));

test('the baseline covers every component folder and every layout, so the pin is not vacuous', () => {
  const names = Object.keys(baseline);
  assert.ok(names.length >= 75, `the baseline lists ${names.length} entries`);
  for (const folder of ['ui', 'blocks', 'program', 'diagrams', 'hero', 'motion', 'layouts']) {
    assert.ok(
      names.some((n) => n.startsWith(`${folder}/`)),
      `the baseline has ${folder}`,
    );
  }
  assert.equal(baseline['ui/Section.astro']?.props.tone?.type, "'plain' | 'soft'", 'Section tone is pinned as it was on demo');
  assert.equal(baseline['layouts/StageLayout.astro']?.props.stage?.optional, true);
  assert.deepEqual(baseline['hero/HeroCompact.astro']?.slots, ['actions', 'default']);
});

test('the reader finds the members, the extended types and the slots of a component', () => {
  const api = readComponentApi(
    [
      '---',
      "import X from './X.astro';",
      'interface Props {',
      '  /** A label. */',
      '  label: string;',
      "  tone?: 'a' | 'b';",
      '  onPick?: (id: string) => void;',
      '}',
      '---',
      '<div><slot /><slot name="after" /></div>',
      '<style>.x { color: red; }</style>',
    ].join('\n'),
  );
  assert.deepEqual(api.props.label, { optional: false, type: 'string' });
  assert.deepEqual(api.props.tone, { optional: true, type: "'a' | 'b'" });
  assert.deepEqual(api.props.onPick, { optional: true, type: '(id: string) => void' });
  assert.deepEqual(api.slots, ['after', 'default']);
  const alias = readComponentApi(['---', 'type Props = Base & {', '  title: string;', '  next?: readonly string[];', '};', '---', '<slot />'].join('\n'));
  assert.deepEqual(alias.extends, ['Base']);
  assert.deepEqual(Object.keys(alias.props), ['title', 'next']);
});

for (const [name, was] of Object.entries(baseline)) {
  test(`${name} keeps its API`, () => {
    const now = current[name];
    assert.ok(now, `${name} still exists`);
    for (const [prop, api] of Object.entries(was.props)) {
      const after = now.props[prop];
      assert.ok(after, `${name}: prop "${prop}" was removed`);
      if (api.optional) assert.ok(after.optional, `${name}: optional prop "${prop}" became required`);
      const kept = [...union(api.type)].every((member) => union(after.type).has(member));
      assert.ok(kept, `${name}: prop "${prop}" changed from \`${api.type}\` to \`${after.type}\` (a type may widen, never narrow)`);
    }
    for (const [prop, api] of Object.entries(now.props)) {
      if (was.props[prop] === undefined) assert.ok(api.optional, `${name}: new prop "${prop}" must be optional so existing callers keep working`);
    }
    for (const base of was.extends) assert.ok(now.extends.includes(base), `${name}: no longer extends ${base}`);
    for (const slot of was.slots) assert.ok(now.slots.includes(slot), `${name}: slot "${slot}" was removed`);
  });
}
