/**
 * What the browser needs of the palette's list: its item shape and the reader of the data-commands attribute. Pure and free of Node and
 * Astro globals, and it imports nothing, because src/scripts/palette.ts ships it to the browser. The list is built at build time by
 * src/components/nav/commands.ts, which reads the registries and the route ledger (Node only); that module must never be imported by
 * client code, or the ledger's file reads land in the page bundle ("process is not defined").
 */
export interface PaletteCommand {
  readonly label: string;
  /** An internal route with a trailing slash. */
  readonly href: string;
  readonly group: string;
  readonly hint?: string;
}

/** A route the palette can open: a site-relative path with a trailing slash. Files such as /rss.xml are not routes. */
export function isPaletteRoute(href: string): boolean {
  return href.startsWith('/') && !href.startsWith('//') && href.endsWith('/') && !/[\\\s]/.test(href);
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
