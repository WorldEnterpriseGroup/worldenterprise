/**
 * Sätteri hast plugin: one inline call to action in the middle of a long article or guide (docs/wave8-contracts.md, section 6.1).
 *
 *   <aside class="cta-inline" data-cta="mid" aria-label="Next step">
 *     <p class="cta-inline__title">Tell WE about your company</p>
 *     <p>The application form asks about your company, your team and what you are building.</p>
 *     <p><a class="btn btn--secondary" href="/apply/">Tell WE about your company</a></p>
 *   </aside>
 *
 * A hast plugin cannot render an Astro component, so this file builds plain nodes from the same `CtaModel` that `CtaBand.astro` renders
 * (`src/data/cta`); a unit test holds the two to the same label and href. The title is a `<p>`, not a heading, so the heading outline
 * of the page does not change.
 *
 * Where it goes: only in a document of at least 900 words whose surface has a mid band (`resolveMidCta`), after the first paragraph that
 * ends at or after the middle of the text and no later than 90 percent of it, so never in the first 20 percent and never in the last 10.
 * It sits between two top-level blocks, so it is never inside a list, table, blockquote, figure or code block, and never between a
 * heading and the paragraph that follows it. A paragraph that introduces a list (it ends in a colon) is skipped. At most one per document.
 *
 * The measure is the words of the document's own top-level blocks, which is the article body and nothing the layout adds after it (the
 * timeline offer, the figures, the sources, the citation box). When no valid paragraph boundary falls in the 50 to 90 percent window, the
 * document gets no band: the rule never moves the band outside the window to find a boundary, because a band in the first half or the last
 * tenth breaks the contract. The e2e spec measures the same body, stopping at the first piece of layout furniture.
 *
 * The plugin reads the document's place from `ctx.fileURL` (`src/content/insights/<desk>/<slug>.mdx`, `src/content/guides/<slug>.mdx`):
 * Sätteri does not hand a plugin the route. Any other document is left alone. `insertAfter` is part of Sätteri's context, so the fallback
 * (a marker element that the layout fills) was not needed. The imports are types only apart from the data modules, which load under
 * plain Node, so nothing here needs Astro at runtime.
 */

import { fileURLToPath } from 'node:url';
import type { HastNode, HastPluginDefinition, HastVisitorContext } from 'satteri';
import { resolveMidCta } from '../data/cta/index.ts';
import type { CtaModel, IsLive, ResolveInput } from '../data/cta/index.ts';
import { isLiveOnDisk } from '../data/cta/live.ts';
import { buildHref } from './url-core.ts';

/** The slice of Sätteri's visitor context that this plugin uses. */
export type MidCtaContext = Pick<HastVisitorContext, 'textContent' | 'insertAfter'>;

type ElementNode = Extract<HastNode, { type: 'element' }>;

/** A document shorter than this has no mid-body band. */
export const MID_CTA_MIN_WORDS = 900;
/** The band goes at or after this share of the text, and ends no later than the next. */
export const MID_CTA_FROM = 0.5;
export const MID_CTA_UNTIL = 0.9;

function isElement(node: HastNode): node is ElementNode {
  return node.type === 'element';
}

/** Words of a text: whitespace-separated pieces that hold a letter or a digit. */
export function wordCount(text: string): number {
  return text.split(/\s+/).filter((piece) => /[A-Za-z0-9]/.test(piece)).length;
}

const text = (value: string): HastNode => ({ type: 'text', value });

function element(tagName: string, properties: Record<string, unknown>, children: HastNode[]): ElementNode {
  return { type: 'element', tagName, properties, children } as ElementNode;
}

/** The inline band for a model. `base` is the preview base path, as `href()` applies it (`PAGES_BASE_PATH` in astro.config.mjs). */
export function midCtaNode(model: CtaModel, base?: string): ElementNode {
  return element('aside', { className: ['cta-inline'], dataCta: 'mid', ariaLabel: 'Next step' }, [
    element('p', { className: ['cta-inline__title'] }, [text(model.heading)]),
    element('p', {}, [text(model.body)]),
    ...(model.note !== undefined ? [element('p', { className: ['cta-inline__note'] }, [text(model.note)])] : []),
    element('p', {}, [element('a', { className: ['btn', 'btn--secondary'], href: buildHref(model.primary.href, base) }, [text(model.primary.label)])]),
  ]);
}

interface Block {
  readonly node: HastNode;
  readonly words: number;
}

/** The top-level blocks of the document: every child that is not whitespace between them, with its word count. */
function blocksOf(root: HastNode, ctx: MidCtaContext): Block[] {
  const children = 'children' in root ? root.children : [];
  const blocks: Block[] = [];
  for (const node of children) {
    if (node.type === 'text' && node.value.trim() === '') continue;
    blocks.push({ node, words: wordCount(ctx.textContent(node)) });
  }
  return blocks;
}

/** The block after which the band goes, or undefined when the document has no fitting place or is too short. */
export function findAnchor(root: HastNode, ctx: MidCtaContext): HastNode | undefined {
  const blocks = blocksOf(root, ctx);
  const total = blocks.reduce((sum, block) => sum + block.words, 0);
  if (total < MID_CTA_MIN_WORDS) return undefined;
  let seen = 0;
  for (const [index, block] of blocks.entries()) {
    seen += block.words;
    const share = seen / total;
    if (share > MID_CTA_UNTIL) return undefined;
    if (share < MID_CTA_FROM) continue;
    const { node } = block;
    if (!isElement(node) || node.tagName !== 'p') continue;
    // The band goes after a paragraph, so it is never between a heading and the paragraph that follows it.
    if (ctx.textContent(node).trim().endsWith(':')) continue;
    // A paragraph that is the last block has nothing after it to separate from.
    if (blocks[index + 1] === undefined) return undefined;
    return node;
  }
  return undefined;
}

/** Inserts the band into the document. Returns whether it did. */
export function placeMidCta(root: HastNode, ctx: MidCtaContext, model: CtaModel, base?: string): boolean {
  const anchor = findAnchor(root, ctx);
  if (anchor === undefined) return false;
  ctx.insertAfter(anchor, midCtaNode(model, base));
  return true;
}

/** What the resolver needs to know about a document, read from its file path; null for a document with no mid-body band. */
export function inputFromFile(file: string): ResolveInput | null {
  const normalized = file.split('\\').join('/');
  const article = /\/src\/content\/insights\/([^/]+)\/([^/]+)\.mdx?$/.exec(normalized);
  if (article?.[1] !== undefined && article[2] !== undefined) return { path: `/insights/${article[2]}/`, collection: 'insights', topic: article[1] };
  const guide = /\/src\/content\/guides\/([^/]+)\.mdx?$/.exec(normalized);
  if (guide?.[1] !== undefined) return { path: `/fundability/${guide[1]}/`, collection: 'guides' };
  return null;
}

export interface MidCtaOptions {
  /** The preview base path, for example "/worldenterprise". */
  readonly base?: string | undefined;
  /** Whether a ledger path is a live route. Defaults to the files on disk. */
  readonly isLive?: IsLive;
}

/** The plugin definition for `satteri({ hastPlugins: [createMidCtaPlugin({ base })] })`. */
export function createMidCtaPlugin(options: MidCtaOptions = {}): HastPluginDefinition {
  const isLive = options.isLive ?? isLiveOnDisk;
  return {
    name: 'mid-cta',
    before(root, ctx) {
      if (ctx.fileURL === undefined) return;
      const input = inputFromFile(fileURLToPath(ctx.fileURL));
      if (input === null) return;
      const model = resolveMidCta(input, isLive);
      if (model === null) return;
      placeMidCta(root, ctx, model, options.base);
    },
  };
}

export const midCtaPlugin: HastPluginDefinition = createMidCtaPlugin({ base: process.env['PAGES_BASE_PATH'] });
