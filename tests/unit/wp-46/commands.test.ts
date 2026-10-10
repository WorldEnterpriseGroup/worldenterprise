import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyButton, footerNav, primaryNav, resolveFooter, resolveNav, resolveUtility, utilityNav } from '../../../src/data/nav.ts';
import { rankCommands } from '../../../src/components/islands/we-palette/match.ts';
import { buildPaletteCommands, isPaletteRoute, parseCommands } from '../../../src/components/nav/commands.ts';

const everythingLive = (): boolean => true;
const sources = (isLive: (href: string) => boolean) => ({ items: resolveNav(isLive), utility: resolveUtility(isLive), apply: isLive(applyButton.href) ? applyButton : null, footer: resolveFooter(isLive) });

test('the palette lists Apply first, under "Start here", then the navigation in its own order', () => {
  const commands = buildPaletteCommands(sources(everythingLive), everythingLive);
  assert.deepEqual(commands[0], { label: 'Apply', href: '/apply/', group: 'Start here' });
  const hubs = primaryNav.filter((item) => item.kind === 'mega').map((item) => item.href);
  const positions = hubs.map((hub) => commands.findIndex((command) => command.href === hub));
  assert.ok(positions.every((at) => at > 0), 'every hub is listed');
  assert.deepEqual([...positions].sort((a, b) => a - b), positions, 'hubs keep the navigation order');
});

test('a path is listed once, under the first place that names it', () => {
  const commands = buildPaletteCommands(sources(everythingLive), everythingLive);
  const hrefs = commands.map((command) => command.href);
  assert.equal(new Set(hrefs).size, hrefs.length);
  // /pricing/ is a direct item, a strip link of Program, Services and Network, and a footer link: the direct item is listed first,
  // under its own name, so a search for "pricing" finds it.
  assert.deepEqual(commands.find((command) => command.href === '/pricing/'), { label: 'Pricing', href: '/pricing/', group: 'Pricing' });
  // /apply/ is the Apply button first, and a link of Network later.
  assert.equal(commands.find((command) => command.href === '/apply/')?.group, 'Start here');
});

test('a search for a page by its own name finds it first', () => {
  const commands = buildPaletteCommands(sources(everythingLive), everythingLive);
  for (const [query, href] of [['pricing', '/pricing/'], ['program', '/program/'], ['faq', '/faq/'], ['apply', '/apply/']] as const) {
    assert.equal(rankCommands(commands, query)[0]?.command.href, href, query);
  }
});

test('a section hub carries its lead link as the hint, and a link its description', () => {
  const commands = buildPaletteCommands(sources(everythingLive), everythingLive);
  assert.equal(commands.find((command) => command.href === '/program/')?.hint, 'Explore the program');
  assert.equal(commands.find((command) => command.href === '/program/dream/')?.hint, 'Validate the problem and the customer');
  assert.equal(commands.find((command) => command.href === '/playbooks/validate-the-problem/')?.hint, undefined);
});

test('a route that is not live never reaches the palette, whatever the caller passes in', () => {
  const live = (href: string): boolean => href !== '/pricing/' && href !== '/faq/';
  // The sources are resolved with everything live on purpose: the builder checks again.
  const commands = buildPaletteCommands(sources(everythingLive), live);
  const hrefs = commands.map((command) => command.href);
  assert.ok(!hrefs.includes('/pricing/'));
  assert.ok(!hrefs.includes('/faq/'));
  assert.ok(hrefs.includes('/program/'));
});

test('no Apply command when the route is not live, and an empty site gives an empty list', () => {
  const none = (): boolean => false;
  assert.deepEqual(buildPaletteCommands(sources(none), none), []);
  const live = (href: string): boolean => href !== '/apply/';
  assert.ok(!buildPaletteCommands(sources(live), live).some((command) => command.group === 'Start here'));
});

test('files and external addresses are not palette routes', () => {
  assert.equal(isPaletteRoute('/program/'), true);
  assert.equal(isPaletteRoute('/'), true);
  assert.equal(isPaletteRoute('/rss.xml'), false);
  assert.equal(isPaletteRoute('//evil.example/'), false);
  assert.equal(isPaletteRoute('https://example.com/'), false);
  assert.equal(isPaletteRoute('/a b/'), false);
  const commands = buildPaletteCommands(sources(everythingLive), everythingLive);
  assert.ok(!commands.some((command) => command.href.endsWith('.xml')));
});

test('footer and utility links the navigation does not carry are listed, in their own groups', () => {
  const commands = buildPaletteCommands(sources(everythingLive), everythingLive);
  const utility = utilityNav.links.filter((link) => link.l2 !== true && !commands.some((c) => c.group !== 'Site' && c.href === link.href));
  for (const link of utility) assert.equal(commands.find((command) => command.href === link.href)?.group, 'Site', link.href);
  const footerOnly = footerNav.flatMap((column) => column.links.map((link) => ({ column: column.heading, link }))).filter(({ link }) => link.l2 !== true && isPaletteRoute(link.href));
  for (const { link } of footerOnly) assert.ok(commands.some((command) => command.href === link.href), `${link.href} is reachable`);
});

test('the list carries no unreleased (l2) page', () => {
  const l2 = [...primaryNav.flatMap((item) => (item.kind === 'mega' ? item.columns.flatMap((column) => column.links) : [])), ...utilityNav.links].filter((link) => link.l2 === true).map((link) => link.href);
  assert.ok(l2.length > 0, 'the data has l2 links, so the check can fail');
  const hrefs = buildPaletteCommands(sources(everythingLive), everythingLive).map((command) => command.href);
  for (const href of l2) assert.ok(!hrefs.includes(href), href);
});

test('the serialized list survives JSON and parseCommands returns it unchanged', () => {
  const commands = buildPaletteCommands(sources(everythingLive), everythingLive);
  assert.deepEqual(parseCommands(JSON.stringify(commands)), commands);
});

test('parseCommands reports bad input once and returns nothing for it, never throws', () => {
  const reasons: string[] = [];
  assert.deepEqual(parseCommands('{not json', (reason) => reasons.push(reason)), []);
  assert.deepEqual(parseCommands('{"a":1}', (reason) => reasons.push(reason)), []);
  assert.equal(reasons.length, 2);
  assert.match(reasons[0] ?? '', /not valid JSON/);
  assert.match(reasons[1] ?? '', /not an array/);
  assert.deepEqual(parseCommands(null), []);
  assert.deepEqual(parseCommands('  '), []);
});

test('parseCommands drops an item of the wrong shape and keeps the rest', () => {
  const raw = JSON.stringify([
    { label: 'Program', href: '/program/', group: 'Program', hint: 'Explore the program' },
    { label: 'No group', href: '/x/' },
    { label: '', href: '/y/', group: 'G' },
    { label: 'External', href: 'https://example.com/', group: 'G' },
    { label: 'Script', href: 'javascript:alert(1)', group: 'G' },
    'text',
    null,
    { label: 'FAQ', href: '/faq/', group: 'Resources', hint: '' },
  ]);
  assert.deepEqual(parseCommands(raw), [
    { label: 'Program', href: '/program/', group: 'Program', hint: 'Explore the program' },
    { label: 'FAQ', href: '/faq/', group: 'Resources' },
  ]);
});
