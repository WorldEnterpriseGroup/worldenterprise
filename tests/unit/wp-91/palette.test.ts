import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildPaletteCommands, toolLabel } from '../../../src/components/nav/commands.ts';
import type { PaletteCommand } from '../../../src/components/nav/commands.ts';
import { rankCommands } from '../../../src/components/islands/we-palette/match.ts';
import { DESK_DEFINITIONS, deskPath } from '../../../src/data/desks.ts';
import { FAMILIES } from '../../../src/data/families.ts';
import { applyButton, resolveFooter, resolveNav, resolveUtility } from '../../../src/data/nav.ts';
import { routes } from '../../../src/data/routes.ts';
import { ROOT } from '../wp-41/content.ts';

interface Rule {
  readonly id: string;
  readonly pattern: string;
  readonly flags: string;
}

/**
 * The palette list as Header.astro builds it: the navigation plus the registries. Every test passes the same live predicate to the
 * navigation resolvers and to the builder, as the header does.
 */
const build = (isLive: (href: string) => boolean): readonly PaletteCommand[] =>
  buildPaletteCommands({ items: resolveNav(isLive), utility: resolveUtility(isLive), apply: isLive(applyButton.href) ? applyButton : null, footer: resolveFooter(isLive) }, isLive);

const allLive = (): boolean => true;
const ledgerLive = ((): ((href: string) => boolean) => {
  const launched = new Set(routes.filter((row) => row.launch).map((row) => row.path));
  return (href) => launched.has(href);
})();

test('every launched page of every family is in the palette, under a group, when its route is live', () => {
  const commands = build(allLive);
  for (const family of FAMILIES) {
    for (const entry of family.entries.filter((candidate) => candidate.launch)) {
      assert.ok(commands.some((command) => command.href === entry.path), `${family.id}/${entry.slug} is listed`);
    }
    if (family.hub !== undefined) assert.ok(commands.some((command) => command.href === family.hub?.path), `${family.id} hub is listed`);
  }
});

test('a family entry whose route is not live is not listed, and appears as soon as the route is live', () => {
  for (const family of FAMILIES) {
    const entry = family.entries.find((candidate) => candidate.launch);
    assert.ok(entry !== undefined, `${family.id} launches a page`);
    const without = build((href) => href !== entry.path);
    assert.ok(!without.some((command) => command.href === entry.path), `${entry.path} is absent while it is not live`);
    assert.ok(build(allLive).some((command) => command.href === entry.path), `${entry.path} is present when it is live`);
  }
});

test('an entry the registry does not launch is never listed, even when the caller says every route is live', () => {
  // The registries may hold no pending entry today (every page is launched); the check then has nothing to fail on, and bites as soon as one is added.
  const pending = FAMILIES.flatMap((family) => family.entries).filter((entry) => !entry.launch);
  const hrefs = new Set(build(allLive).map((command) => command.href));
  for (const entry of pending) {
    assert.ok(!hrefs.has(entry.path) || routes.some((row) => row.path === entry.path && row.launch), `${entry.path} is pending and listed`);
  }
});

test('a desk and a tool route appear by the registry and the ledger, and only while live', () => {
  const desk = DESK_DEFINITIONS[0];
  assert.ok(desk !== undefined);
  assert.ok(build(allLive).some((command) => command.href === deskPath(desk.id)));
  assert.ok(!build((href) => href !== deskPath(desk.id)).some((command) => command.href === deskPath(desk.id)));
  const tools = routes.filter((row) => row.layout === 'ToolLayout' && row.path !== '/tools/').map((row) => row.path);
  assert.ok(tools.length >= 3, 'the ledger has tool routes');
  const hrefs = new Set(build(allLive).map((command) => command.href));
  for (const path of tools) assert.ok(hrefs.has(path), path);
  assert.equal(toolLabel('/tools/runway-calculator/'), 'Runway calculator');
  assert.equal(toolLabel('/tools/'), 'Tools');
});

test('a thank-you page and a route the ledger does not launch are never listed', () => {
  for (const isLive of [allLive, ledgerLive]) {
    const commands = build(isLive);
    assert.ok(!commands.some((command) => /thanks/.test(command.href)), 'no thank-you page');
  }
  const unlaunched = new Set(routes.filter((row) => !row.launch).map((row) => row.path));
  for (const command of build(ledgerLive)) assert.ok(!unlaunched.has(command.href), command.href);
});

test('a path is listed once, and no list carries a label or hint with a word the denylist blocks', () => {
  const denylist = JSON.parse(readFileSync(`${ROOT}claims-denylist.json`, 'utf8')) as { rules: Rule[]; contextRules: Rule[] };
  const patterns = [...denylist.rules, ...denylist.contextRules].map((rule) => ({ id: rule.id, pattern: new RegExp(rule.pattern, rule.flags) }));
  assert.ok(patterns.some((rule) => rule.id === 'C-13-peers'), 'the peers rule is among the patterns');
  for (const isLive of [allLive, ledgerLive]) {
    const commands = build(isLive);
    assert.equal(new Set(commands.map((command) => command.href)).size, commands.length);
    for (const command of commands) {
      const text = `${command.label} ${command.group} ${command.hint ?? ''}`;
      for (const rule of patterns) assert.ok(!rule.pattern.test(text), `${command.href} matches ${rule.id}`);
    }
  }
});

test('the registry entries do not change what the existing entries rank: "seat" still ranks the seat options first on the real list', () => {
  // Wave 9 (W9-13): Pricing left the top level, so its strip link "Compare seat options" is the entry for /pricing/.
  for (const isLive of [allLive, ledgerLive]) {
    const ranked = rankCommands(build(isLive), 'seat');
    assert.equal(ranked[0]?.command.href, '/pricing/');
  }
});

test('the list stays small enough to ship in the markup of every page (data-commands budget)', () => {
  const BUDGET_BYTES = 16 * 1024;
  for (const isLive of [allLive, ledgerLive]) {
    const bytes = Buffer.byteLength(JSON.stringify(build(isLive)), 'utf8');
    assert.ok(bytes <= BUDGET_BYTES, `data-commands is ${bytes} bytes, over the ${BUDGET_BYTES} byte budget`);
  }
});

test('articles are not listed: they come from the Pagefind index, so the list does not grow with the article library', () => {
  assert.ok(!build(allLive).some((command) => command.href.startsWith('/insights/') && !command.href.startsWith('/insights/topic/') && command.href !== '/insights/'));
});
