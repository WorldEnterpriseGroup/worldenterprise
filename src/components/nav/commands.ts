import { AUDIENCE_LINKS } from '../../data/cta/audiences.ts';
import { DESK_DEFINITIONS, deskPath } from '../../data/desks.ts';
import { familyLabel, FAMILIES } from '../../data/families.ts';
import type { FooterColumn, NavLink, PrimaryNavItem } from '../../data/nav.ts';
import { routes } from '../../data/routes.ts';
import { FAMILY_LABELS } from '../geo/llms-plan.ts';
import { isPaletteRoute } from '../islands/we-palette/model.ts';
import type { PaletteCommand } from '../islands/we-palette/model.ts';

/**
 * The command palette's list (docs/wave7-contracts.md section 4). Pure and free of Astro globals so node --test can run it:
 * the live-route predicate is passed in, the same one resolveNav() takes, so a route without a page never reaches the palette.
 *
 * Everything here is derived from src/data/nav.ts and from the registries (the page families, the insight desks, the audience doors and the
 * tool routes of the ledger), so a new family page, desk or tool appears with no edit here, and only while its route is live.
 * Articles are not listed: there are over a hundred, and they come from the Pagefind index when the visitor types.
 */
// The item shape and the attribute reader are in the model module: it is the only part the browser loads. This module reads the registries
// and the route ledger (Node only) and is imported by Header.astro and by tests, never by a client script.
export { isPaletteRoute, parseCommands } from '../islands/we-palette/model.ts';
export type { PaletteCommand } from '../islands/we-palette/model.ts';

export interface CommandSources {
  readonly items: readonly PrimaryNavItem[];
  readonly utility: readonly NavLink[];
  readonly apply: NavLink | null;
  readonly footer: readonly FooterColumn[];
}

const START_GROUP = 'Start here';
// The header button reads 'Start a readiness review' (W9-13); the palette lists it by the shorter word people type, with the button label as its hint.
const APPLY_COMMAND = 'Apply';
const SITE_GROUP = 'Site';
const AUDIENCE_GROUP = 'Who it is for';
const DESK_GROUP = 'Insight desks';
const TOOLS_GROUP = 'Tools';

/** "runway-calculator" to "Runway calculator": the label of a tool route that the navigation does not name. */
export function toolLabel(path: string): string {
  const slug = path.split('/').filter((part) => part !== '').at(-1) ?? '';
  const words = slug.replace(/-/g, ' ').trim();
  return words === '' ? '' : `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

/** The tool pages of the route ledger (not the hub), in ledger order. */
function toolRoutes(): readonly string[] {
  return routes.filter((row) => row.layout === 'ToolLayout' && row.path.startsWith('/tools/') && row.path !== '/tools/' && isPaletteRoute(row.path)).map((row) => row.path);
}

/**
 * Builds the palette list in reading order: Apply, then each navigation section and direct item, then the live links of every
 * section's columns and strip, then the utility links, then the footer links the navigation does not carry. A path is listed once,
 * under the first place that names it, so the order of the navigation decides which group a page sits in.
 * The sources are the resolved navigation (resolveNav, resolveUtility, resolveFooter); `isLive` is checked again here so the list can
 * never name a route without a page, whatever a caller passes.
 */
export function buildPaletteCommands(sources: CommandSources, isLive: (href: string) => boolean): readonly PaletteCommand[] {
  const seen = new Set<string>();
  const commands: PaletteCommand[] = [];
  const add = (label: string, href: string, group: string, hint?: string): void => {
    if (!isPaletteRoute(href) || !isLive(href) || seen.has(href)) return;
    seen.add(href);
    commands.push(hint === undefined || hint === '' ? { label, href, group } : { label, href, group, hint });
  };

  if (sources.apply !== null) add(APPLY_COMMAND, sources.apply.href, START_GROUP, sources.apply.label);

  // The sections and direct items come first, so a page that is both (Pricing is a direct item and a strip link of two panels) is listed
  // under its own name and a search for "pricing" finds it. Their links follow, in navigation order, into the group of their section.
  for (const item of sources.items) {
    if (item.kind === 'direct') add(item.label, item.href, item.label);
    else add(item.label, item.href, item.label, item.leadLink);
  }
  for (const item of sources.items) {
    if (item.kind === 'direct') continue;
    for (const column of item.columns) for (const link of column.links) add(link.label, link.href, item.label, link.description);
    for (const link of item.strip) add(link.label, link.href, item.label, link.description);
  }

  for (const link of sources.utility) add(link.label, link.href, SITE_GROUP, link.description);
  for (const column of sources.footer) for (const link of column.links) add(link.label, link.href, column.heading, link.description);

  // The registries come last: add() keeps the first entry of a path, so a page the navigation or the footer already names keeps its
  // label and group. Each add() is checked against isLive, so a page that is not built is never listed. A family entry is listed by its
  // label alone (a blocked word never reaches a page-name list).
  for (const link of AUDIENCE_LINKS) add(link.label, link.href, AUDIENCE_GROUP, link.text);
  for (const family of FAMILIES) {
    const group = FAMILY_LABELS[family.id];
    if (family.hub !== undefined) add(group, family.hub.path, group);
    for (const entry of family.entries) if (entry.launch) add(familyLabel(entry), entry.path, group);
  }
  for (const desk of DESK_DEFINITIONS) add(desk.name, deskPath(desk.id), DESK_GROUP, desk.blurb);
  for (const path of toolRoutes()) add(toolLabel(path), path, TOOLS_GROUP);
  return commands;
}

