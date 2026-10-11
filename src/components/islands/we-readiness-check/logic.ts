/**
 * Pure logic for the readiness self-check. No DOM and no Astro imports, so `node --test` can load it.
 * The self-check lists gaps. It never produces a score, a percentage, a count or a prediction.
 */
export interface GapSource {
  readonly id: string;
  readonly title: string;
  readonly href: string;
}

export interface Gap {
  readonly id: string;
  readonly title: string;
  readonly href: string;
}

/** A further page that helps with one statement, rendered under its gap. */
export interface AlsoLink {
  readonly title: string;
  readonly href: string;
}

/**
 * Reads the `data-also-read` attribute the component writes: a JSON array of {title, href}. Anything that is not that shape is
 * dropped, so a malformed attribute leaves a gap without extra links and never throws.
 */
export function parseAlsoRead(raw: string | undefined): AlsoLink[] {
  if (raw === undefined || raw === '') return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    console.error('we-readiness-check: data-also-read is not valid JSON; the extra links are left out.', error);
    return [];
  }
  if (!Array.isArray(value)) return [];
  const links: AlsoLink[] = [];
  for (const item of value as unknown[]) {
    if (typeof item !== 'object' || item === null) continue;
    const { title, href } = item as Record<string, unknown>;
    if (typeof title === 'string' && title !== '' && typeof href === 'string' && href.startsWith('/')) links.push({ title, href });
  }
  return links;
}

/** Returns the statements that are not confirmed, in their original order. */
export function collectGaps(items: readonly GapSource[], confirmed: ReadonlySet<string>): Gap[] {
  return items.filter((item) => !confirmed.has(item.id)).map((item) => ({ id: item.id, title: item.title, href: item.href }));
}
