/**
 * The composition scan: the rules a family-hero composition must keep (issue #51). Shared by the brand unit tests and the brand audit
 * (WP-71), so one function decides what a composition may contain.
 */

export const MAX_COMPOSITION_BYTES = 12288;

/** The only elements a composition may contain. */
export const ALLOWED_ELEMENTS: ReadonlySet<string> = new Set(['svg', 'g', 'polygon', 'path', 'line', 'circle', 'rect', 'polyline', 'defs', 'title']);

/** Element or class names that would mean a person, a logo, a product, or a chart. */
const FORBIDDEN_NAME = /(person|people|face|avatar|portrait|logo|wordmark|product|screenshot|chart|graph|axis|axes|legend|bar-|pie)/i;

/** An attribute that could fetch, run or style something outside the figure. */
const FORBIDDEN_ATTRIBUTE = /\s(style|href|xlink:href|src|onload|onclick|on[a-z]+)\s*=/i;

export interface CompositionFinding {
  readonly rule: string;
  readonly detail: string;
}

/** Scans one composition's markup. An empty result means it keeps every rule. */
export function scanComposition(svg: string): readonly CompositionFinding[] {
  const findings: CompositionFinding[] = [];
  const bytes = Buffer.byteLength(svg, 'utf8');
  if (bytes > MAX_COMPOSITION_BYTES) findings.push({ rule: 'size', detail: `${bytes} bytes, the limit is ${MAX_COMPOSITION_BYTES}` });
  if (!/^<svg\b[^>]*\sviewBox="[^"]+"/.test(svg)) findings.push({ rule: 'viewbox', detail: 'the markup does not open with an <svg> that has a viewBox' });
  if (!svg.trimEnd().endsWith('</svg>')) findings.push({ rule: 'closed', detail: 'the markup does not end with </svg>' });

  const tags = [...svg.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9:-]*)/g)].map((m) => (m[1] ?? '').toLowerCase());
  for (const tag of new Set(tags)) {
    if (!ALLOWED_ELEMENTS.has(tag)) findings.push({ rule: 'element', detail: `<${tag}> is not an allowed element` });
  }
  if (FORBIDDEN_ATTRIBUTE.test(svg)) findings.push({ rule: 'attribute', detail: 'a style, href, src or event attribute is present' });
  if (/<text\b|>\s*\d/.test(svg)) findings.push({ rule: 'text', detail: 'text content, including a digit, is present' });

  const classes = [...svg.matchAll(/\sclass="([^"]*)"/g)].flatMap((m) => (m[1] ?? '').split(/\s+/));
  for (const name of [...tags, ...classes]) {
    if (FORBIDDEN_NAME.test(name)) findings.push({ rule: 'subject', detail: `"${name}" names a person, logo, product or chart` });
  }
  return findings;
}

export interface Pt {
  readonly x: number;
  readonly y: number;
}

/** The vertex lists of every polygon in the markup. */
export function polygons(svg: string): readonly (readonly Pt[])[] {
  return [...svg.matchAll(/<polygon\b[^>]*\spoints="([^"]+)"/g)].map((m) =>
    (m[1] ?? '')
      .trim()
      .split(/\s+/)
      .map((pair) => {
        const [x, y] = pair.split(',').map(Number);
        return { x: x ?? Number.NaN, y: y ?? Number.NaN };
      }),
  );
}
