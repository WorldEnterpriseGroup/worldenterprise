/**
 * Sätteri hast plugin: every table that Markdown or MDX produces gets a scroll frame.
 *
 * A bare `<table>` in a 46rem reading column cannot shrink below the width of its longest unbreakable cell, so at 320 and 390 CSS pixels
 * it ran past the viewport and `.page` clipped the part that did not fit (WP-16, visual-brand P0-1, a11y P1-2 on WCAG 1.4.10 Reflow).
 * The templates already wrap their own tables in `.table-wrap`; this plugin gives Markdown tables the same frame:
 *
 *   <div class="table-wrap" tabindex="0" role="region" aria-label="Table: Weekly metrics"><table class="data-table">...</table></div>
 *
 * The frame scrolls sideways (see `.table-wrap` in components.css) and is a keyboard stop, so the scrolled content can be reached
 * without a pointer (WCAG 2.1.1). It carries a name from the table caption, else the nearest preceding heading, else the page title, so
 * a screen reader announces what the region holds; names are made unique per document (axe `landmark-unique`). Header cells get
 * `scope="col"` because GFM tables always put the column headers in the first row.
 *
 * Why Sätteri and not rehype: Astro 7 renders `.md` and `.mdx` with Sätteri, and `markdown.rehypePlugins` would need
 * `@astrojs/markdown-remark`, which is not installed. astro.config.mjs passes this plugin to `satteri({ hastPlugins })`, and
 * `@astrojs/mdx` inherits the processor, so one registration covers both formats. The file keeps the `rehype-` prefix because it works on
 * the same hast tree a rehype plugin would.
 *
 * `wrapTables` is a plain walk over the tree that issues operations on a context, so it is unit-tested with a recording context as well
 * as through the real Sätteri pipeline. The imports are types only: `satteri` is Astro's own dependency and package.json is frozen for
 * this work package, so nothing here is a runtime import.
 */

import type { HastNode, HastPluginDefinition, HastVisitorContext } from 'satteri';

/** The slice of Sätteri's visitor context that this plugin uses. */
export type TableWrapContext = Pick<HastVisitorContext, 'data' | 'textContent' | 'setProperty' | 'wrapNode'>;

const HEADINGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

type ElementNode = Extract<HastNode, { type: 'element' }>;

interface Found {
  readonly table: ElementNode;
  readonly name: string;
}

function isElement(node: HastNode): node is ElementNode {
  return node.type === 'element';
}

function childrenOf(node: HastNode): readonly HastNode[] {
  return 'children' in node ? node.children : [];
}

function classesOf(node: ElementNode): string[] {
  const value = node.properties?.className ?? node.properties?.class;
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') return value.split(/\s+/).filter((name) => name !== '');
  return [];
}

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** The `title` of the document's frontmatter, which Astro puts on `ctx.data.astro`. */
function frontmatterTitle(data: Readonly<Record<string, unknown>>): string {
  const astro = data['astro'];
  if (typeof astro !== 'object' || astro === null || !('frontmatter' in astro)) return '';
  const frontmatter = astro.frontmatter;
  if (typeof frontmatter !== 'object' || frontmatter === null || !('title' in frontmatter)) return '';
  return typeof frontmatter.title === 'string' ? collapse(frontmatter.title) : '';
}

/** Every table in document order with its name, skipping tables that already sit in a `.table-wrap`. */
function findTables(root: HastNode, ctx: TableWrapContext): Found[] {
  const fallback = frontmatterTitle(ctx.data);
  const found: Found[] = [];
  let heading = '';

  const visit = (parent: HastNode, insideFrame: boolean): void => {
    for (const node of childrenOf(parent)) {
      if (isElement(node) && HEADINGS.has(node.tagName)) {
        heading = collapse(ctx.textContent(node));
        continue;
      }
      if (isElement(node) && node.tagName === 'table') {
        if (insideFrame) continue;
        const caption = childrenOf(node).find((child) => isElement(child) && child.tagName === 'caption');
        const captionText = caption === undefined ? '' : collapse(ctx.textContent(caption));
        found.push({ table: node, name: captionText || heading || fallback });
        continue;
      }
      // Anything else that has children can hold a table: a div, a figure, an MDX JSX element.
      visit(node, insideFrame || (isElement(node) && classesOf(node).includes('table-wrap')));
    }
  };

  visit(root, false);
  return found;
}

/** "Table: name", or "Table" when the page offers no name. Labels that more than one frame would share get " (n of total)". */
export function labelTables(names: readonly string[]): string[] {
  const labels = names.map((name) => (name === '' ? 'Table' : `Table: ${name}`));
  const totals = new Map<string, number>();
  for (const label of labels) totals.set(label, (totals.get(label) ?? 0) + 1);
  const seen = new Map<string, number>();
  return labels.map((label) => {
    const total = totals.get(label) ?? 1;
    if (total === 1) return label;
    const index = (seen.get(label) ?? 0) + 1;
    seen.set(label, index);
    return `${label} (${index} of ${total})`;
  });
}

/** `scope="col"` on every header cell of the table's head. Cells that already declare a scope keep it. */
function scopeHeaderCells(table: ElementNode, ctx: TableWrapContext): void {
  for (const section of childrenOf(table)) {
    if (!isElement(section) || section.tagName !== 'thead') continue;
    for (const row of childrenOf(section)) {
      if (!isElement(row) || row.tagName !== 'tr') continue;
      for (const cell of childrenOf(row)) {
        if (isElement(cell) && cell.tagName === 'th' && cell.properties?.scope === undefined) ctx.setProperty(cell, 'scope', 'col');
      }
    }
  }
}

/** Frames every table under `root`. Returns how many it framed. */
export function wrapTables(root: HastNode, ctx: TableWrapContext): number {
  const found = findTables(root, ctx);
  const labels = labelTables(found.map((item) => item.name));
  for (const [index, { table }] of found.entries()) {
    const classes = classesOf(table);
    if (!classes.includes('data-table')) ctx.setProperty(table, 'className', [...classes, 'data-table']);
    scopeHeaderCells(table, ctx);
    // No children are declared: the wrapped table becomes the frame's only child.
    ctx.wrapNode(table, {
      type: 'element',
      tagName: 'div',
      properties: { className: ['table-wrap'], tabIndex: 0, role: 'region', ariaLabel: labels[index] ?? 'Table' },
      children: [],
    });
  }
  return found.length;
}

/**
 * The plugin definition for `satteri({ hastPlugins: [tableWrapPlugin] })`. The work happens in `before`, once per document and ahead of
 * the visitors, because the label of one table depends on the other tables of the page.
 */
export const tableWrapPlugin: HastPluginDefinition = {
  name: 'table-wrap',
  before(root, ctx) {
    wrapTables(root, ctx);
  },
};
