import type { FooterColumn, NavLink, PrimaryNavItem } from '../../data/nav.ts';

/**
 * The command palette's list (docs/wave7-contracts.md section 4). Pure and free of Astro globals so node --test can run it:
 * the live-route predicate is passed in, the same one resolveNav() takes, so a route without a page never reaches the palette.
 *
 * Everything here is derived from src/data/nav.ts. Nothing is typed by hand in a component.
 */
export interface PaletteCommand {
  readonly label: string;
  /** An internal route with a trailing slash. */
  readonly href: string;
  readonly group: string;
  readonly hint?: string;
}

export interface CommandSources {
  readonly items: readonly PrimaryNavItem[];
  readonly utility: readonly NavLink[];
  readonly apply: NavLink | null;
  readonly footer: readonly FooterColumn[];
}

const START_GROUP = 'Start here';
const SITE_GROUP = 'Site';

/** A route the palette can open: a site-relative path with a trailing slash. Files such as /rss.xml are not routes. */
export function isPaletteRoute(href: string): boolean {
  return href.startsWith('/') && !href.startsWith('//') && href.endsWith('/') && !/[\\\s]/.test(href);
}

/**
 * Builds the palette list in reading order: Apply, then each navigation section (its hub, then every live link of its columns and
 * strip), then the utility links, then the footer links the navigation does not carry. A path is listed once, under the first place
 * that names it, so the order of the navigation decides which group a page sits in.
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

  if (sources.apply !== null) add(sources.apply.label, sources.apply.href, START_GROUP);

  for (const item of sources.items) {
    if (item.kind === 'direct') {
      add(item.label, item.href, item.label);
      continue;
    }
    add(item.label, item.href, item.label, item.leadLink);
    for (const column of item.columns) for (const link of column.links) add(link.label, link.href, item.label, link.description);
    for (const link of item.strip) add(link.label, link.href, item.label, link.description);
  }

  for (const link of sources.utility) add(link.label, link.href, SITE_GROUP, link.description);
  for (const column of sources.footer) for (const link of column.links) add(link.label, link.href, column.heading, link.description);
  return commands;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Parses the data-commands attribute. A parse error, a value that is not an array and an item that does not have the shape of a
 * PaletteCommand all yield nothing for that item, never an exception: the palette then shows what it could read, or nothing.
 * `onError` receives the reason so the caller can report it once.
 */
export function parseCommands(raw: string | null, onError?: (reason: string) => void): readonly PaletteCommand[] {
  if (raw === null || raw.trim() === '') return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    onError?.(`data-commands is not valid JSON (${error instanceof Error ? error.message : String(error)})`);
    return [];
  }
  if (!Array.isArray(data)) {
    onError?.('data-commands is not an array');
    return [];
  }
  const commands: PaletteCommand[] = [];
  for (const entry of data) {
    if (!isRecord(entry)) continue;
    const { label, href, group, hint } = entry;
    if (typeof label !== 'string' || typeof href !== 'string' || typeof group !== 'string') continue;
    if (label.trim() === '' || !isPaletteRoute(href)) continue;
    commands.push(typeof hint === 'string' && hint !== '' ? { label, href, group, hint } : { label, href, group });
  }
  return commands;
}
