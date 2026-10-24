/**
 * The "on this page" list of a prose page (WP-109). A layout renders its body to HTML, hands the string to `railToc`, and gets back the
 * list of second-level headings plus the same HTML with an id on every one of them, so the rail can link to the headings of any page
 * without the page, its MDX or a component having to declare a table of contents. No script runs: the list is part of the HTML.
 */

export interface TocItem {
  readonly id: string;
  readonly text: string;
}

export interface RailToc {
  readonly html: string;
  readonly items: readonly TocItem[];
}

const ENTITIES: Readonly<Record<string, string>> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—' };

/** Plain text of a fragment of markup: tags dropped, character references decoded, white space collapsed. */
export function plainText(markup: string): string {
  return markup
    .replace(/<[^>]*>/g, '')
    .replace(/&(?:#(\d+)|#x([\da-f]+)|([a-z]+));/gi, (whole: string, dec?: string, hex?: string, name?: string) => {
      if (dec !== undefined) return String.fromCodePoint(Number(dec));
      if (hex !== undefined) return String.fromCodePoint(Number.parseInt(hex, 16));
      return (name !== undefined ? ENTITIES[name.toLowerCase()] : undefined) ?? whole;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/** A heading id: lower case words joined with hyphens, the way the Markdown pipeline slugs a heading. */
export function slugify(text: string): string {
  const slug = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === '' ? 'section' : slug;
}

const HEADING = /<h2(\s[^>]*)?>([\s\S]*?)<\/h2>/gi;
const ID_ATTRIBUTE = /\sid\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;

/**
 * Lists the h2 headings of `html` and gives each one an id, keeping an id it already has. A heading without text is skipped. Ids that
 * would repeat (two headings with the same text, or one that matches an id elsewhere in the body) take a numeric suffix.
 */
export function railToc(html: string): RailToc {
  const taken = new Set<string>();
  for (const match of html.matchAll(/\sid\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) taken.add(match[1] ?? match[2] ?? match[3] ?? '');
  const items: TocItem[] = [];
  const seen = new Set<string>();
  const out = html.replace(HEADING, (whole: string, attrs: string | undefined, inner: string) => {
    const text = plainText(inner);
    if (text === '') return whole;
    const existing = attrs === undefined ? null : ID_ATTRIBUTE.exec(attrs);
    const known = existing === null ? undefined : (existing[1] ?? existing[2] ?? existing[3]);
    if (known !== undefined && known !== '' && !seen.has(known)) {
      seen.add(known);
      items.push({ id: known, text });
      return whole;
    }
    const base = slugify(text);
    let id = base;
    for (let n = 2; taken.has(id) || seen.has(id); n += 1) id = `${base}-${n}`;
    seen.add(id);
    taken.add(id);
    items.push({ id, text });
    const head = (attrs ?? '').replace(ID_ATTRIBUTE, '');
    return `<h2 id="${id}"${head}>${inner}</h2>`;
  });
  return { html: out, items };
}

/**
 * Blocks that are laid out for the whole 110rem frame rather than for a reading column: a table, a canvas or a scene, and the layout
 * and card primitives of the design system. A page body that holds one of them keeps the frame; a body of running text gets the rail.
 */
const FRAME_TAGS = /<(?:table|canvas|iframe|video|we-scene)\b/i;
const FRAME_CLASSES = new Set([
  'grid',
  'split',
  'band',
  'hub-lead',
  'hub-eco',
  'faq-list',
  'table-wrap',
  'data-table',
  'scorecard',
  'sbir-status',
  'sbir-compare',
  'sbir-routes',
  'wv-cards',
  'scene',
  'cluster-grid',
]);

/** True when `html` holds a block that needs the frame's width (see FRAME_CLASSES), so the page keeps the wide body and skips the rail. */
export function hasFrameBlocks(html: string): boolean {
  if (FRAME_TAGS.test(html)) return true;
  for (const match of html.matchAll(/\sclass\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    for (const token of (match[1] ?? match[2] ?? '').split(/\s+/)) if (FRAME_CLASSES.has(token)) return true;
  }
  return false;
}
