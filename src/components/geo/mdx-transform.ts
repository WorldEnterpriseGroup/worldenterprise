
/**
 * Turns the MDX body of an article into the plain Markdown of its twin (src/lib/markdown-twins.ts), for the entries whose body uses
 * the site's components. Pure and fail-closed: the component props are read with a literal parser (strings, numbers, booleans, null,
 * arrays and objects, no expressions and no eval), and any component, prop or expression this file does not know is an error, so the
 * entry gets no twin instead of a twin with a hole in it. The twin lint (lintMarkdown) stays the last gate.
 *
 * The documented transforms, and nothing else:
 * - single-line `import X from '...astro'` lines are dropped (a component the table below does not know then fails);
 * - DataTable becomes a Markdown table under a "Table: <caption>" line;
 * - CellTrail becomes a labelled numbered list, a cell linked only when its route is live;
 * - Steps becomes the numbered "**Title.** body" list that playbook twins use;
 * - Callout becomes a blockquote with a bold title;
 * - NoFundingDisclaimer becomes a blockquote with its fixed wording (pinned to the component source by tests/unit/wp-91/mdx-transform.test.ts);
 *   IntroductionsDisclaimer is refused, so a page that renders it has no twin (see its handler);
 * - MaybeLink becomes `[text](path)` when the route is live and the bare text when it is not, the same choice the component makes.
 */

export interface MdxTransformOptions {
  /** True when the route is built, so a link to it resolves. Injected, because the real answer comes from the route ledger. */
  readonly isLive: (path: string) => boolean;
}

export type MdxTransformResult =
  | { readonly ok: true; readonly markdown: string }
  | { readonly ok: false; readonly reason: string };

export type LiteralValue = string | number | boolean | null | readonly LiteralValue[] | { readonly [key: string]: LiteralValue };

/** Why a page that renders the services disclaimer has no twin. */
export const SERVICE_DISCLAIMER_REFUSAL = '<IntroductionsDisclaimer> has no Markdown form: its wording is counsel-reviewed only where it is defined';

/** The wording the funding disclaimer component renders, which its twin blockquote repeats. */
export const NO_FUNDING_TITLE = 'No promise of funding';
export const NO_FUNDING_TEXT =
  'WE makes no promise of funding. This material helps you prepare evidence for investors. It does not predict that any company will raise money, and it is not legal or financial advice.';

class MdxTransformError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MdxTransformError';
  }
}

const fail = (message: string): never => {
  throw new MdxTransformError(message);
};

/** Parses a JavaScript literal as the MDX component props write it. Anything that is not a plain literal throws. */
class LiteralParser {
  private readonly src: string;
  private pos: number;

  constructor(src: string, start: number) {
    this.src = src;
    this.pos = start;
  }

  get position(): number {
    return this.pos;
  }

  private skipSpace(): void {
    while (this.pos < this.src.length && /\s/.test(this.src[this.pos] ?? '')) this.pos += 1;
  }

  private peek(): string {
    return this.src[this.pos] ?? '';
  }

  private expect(char: string): void {
    this.skipSpace();
    if (this.peek() !== char) fail(`expected "${char}" in a component prop near "${this.src.slice(this.pos, this.pos + 24)}"`);
    this.pos += 1;
  }

  /** Parses one value and returns it; the position is left after it. */
  value(): LiteralValue {
    this.skipSpace();
    const char = this.peek();
    if (char === '"' || char === "'") return this.string();
    if (char === '[') return this.array();
    if (char === '{') return this.object();
    if (char === '-' || /\d/.test(char)) return this.number();
    for (const word of ['true', 'false', 'null'] as const) {
      if (this.src.startsWith(word, this.pos) && !/[\w$]/.test(this.src[this.pos + word.length] ?? '')) {
        this.pos += word.length;
        return word === 'null' ? null : word === 'true';
      }
    }
    return fail(`unsupported expression in a component prop near "${this.src.slice(this.pos, this.pos + 24)}"`);
  }

  /** After a `{`-wrapped attribute value: skips the closing brace. */
  closeExpression(): void {
    this.expect('}');
  }

  private string(): string {
    const quote = this.peek();
    this.pos += 1;
    let out = '';
    for (;;) {
      if (this.pos >= this.src.length) return fail('unterminated string in a component prop');
      const char = this.src[this.pos] ?? '';
      this.pos += 1;
      if (char === quote) return out;
      if (char !== '\\') {
        out += char;
        continue;
      }
      const next = this.src[this.pos] ?? '';
      this.pos += 1;
      if (next === 'n') out += '\n';
      else if (next === 't') out += '\t';
      else if (next === 'u') {
        const hex = this.src.slice(this.pos, this.pos + 4);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) return fail('bad unicode escape in a component prop');
        out += String.fromCharCode(Number.parseInt(hex, 16));
        this.pos += 4;
      } else if (next === '\\' || next === '"' || next === "'" || next === '`') out += next;
      else return fail(`unsupported escape \\${next} in a component prop`);
    }
  }

  private number(): number {
    const match = /^-?\d+(?:\.\d+)?/.exec(this.src.slice(this.pos));
    if (match === null) return fail('bad number in a component prop');
    this.pos += match[0].length;
    return Number(match[0]);
  }

  private array(): LiteralValue[] {
    this.expect('[');
    const items: LiteralValue[] = [];
    for (;;) {
      this.skipSpace();
      if (this.peek() === ']') {
        this.pos += 1;
        return items;
      }
      items.push(this.value());
      this.skipSpace();
      if (this.peek() === ',') this.pos += 1;
      else if (this.peek() !== ']') return fail('expected "," or "]" in a component prop array');
    }
  }

  private object(): { [key: string]: LiteralValue } {
    this.expect('{');
    const out: { [key: string]: LiteralValue } = {};
    for (;;) {
      this.skipSpace();
      if (this.peek() === '}') {
        this.pos += 1;
        return out;
      }
      const char = this.peek();
      let key: string;
      if (char === '"' || char === "'") key = this.string();
      else {
        const match = /^[A-Za-z_$][\w$]*/.exec(this.src.slice(this.pos));
        if (match === null) return fail('unsupported key in a component prop object (spreads and computed keys are not read)');
        key = match[0];
        this.pos += key.length;
      }
      this.expect(':');
      out[key] = this.value();
      this.skipSpace();
      if (this.peek() === ',') this.pos += 1;
      else if (this.peek() !== '}') return fail('expected "," or "}" in a component prop object');
    }
  }
}

interface ParsedTag {
  readonly name: string;
  readonly props: Readonly<Record<string, LiteralValue>>;
  readonly selfClosing: boolean;
  /** Index just after the opening tag. */
  readonly end: number;
}

function parseTag(text: string, start: number): ParsedTag {
  const nameMatch = /^<([A-Z][A-Za-z0-9]*)/.exec(text.slice(start));
  if (nameMatch?.[1] === undefined) return fail('a tag that is not a component');
  const name = nameMatch[1];
  let pos = start + nameMatch[0].length;
  const props: Record<string, LiteralValue> = {};
  for (;;) {
    while (pos < text.length && /\s/.test(text[pos] ?? '')) pos += 1;
    if (text.startsWith('/>', pos)) return { name, props, selfClosing: true, end: pos + 2 };
    if (text[pos] === '>') return { name, props, selfClosing: false, end: pos + 1 };
    const attr = /^[A-Za-z_][\w:-]*/.exec(text.slice(pos));
    if (attr === null) return fail(`unreadable attribute in <${name}>`);
    const attrName = attr[0];
    pos += attrName.length;
    while (pos < text.length && /\s/.test(text[pos] ?? '')) pos += 1;
    if (text[pos] !== '=') {
      props[attrName] = true;
      continue;
    }
    pos += 1;
    while (pos < text.length && /\s/.test(text[pos] ?? '')) pos += 1;
    const open = text[pos];
    if (open === '"' || open === "'") {
      const close = text.indexOf(open, pos + 1);
      if (close === -1) return fail(`unterminated attribute ${attrName} in <${name}>`);
      props[attrName] = text.slice(pos + 1, close);
      pos = close + 1;
    } else if (open === '{') {
      const parser = new LiteralParser(text, pos + 1);
      props[attrName] = parser.value();
      parser.closeExpression();
      pos = parser.position;
    } else {
      return fail(`unreadable value for ${attrName} in <${name}>`);
    }
  }
}

type Props = Readonly<Record<string, LiteralValue>>;

function allow(name: string, props: Props, allowed: readonly string[]): void {
  for (const key of Object.keys(props)) if (!allowed.includes(key)) fail(`<${name}> has a prop this transform does not read: ${key}`);
}

function stringProp(name: string, props: Props, key: string): string {
  const value = props[key];
  if (typeof value !== 'string') return fail(`<${name}> needs a string ${key}`);
  return value;
}

function optionalString(name: string, props: Props, key: string): string | undefined {
  return props[key] === undefined ? undefined : stringProp(name, props, key);
}

function stringList(name: string, props: Props, key: string): readonly string[] {
  const value = props[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return fail(`<${name}> needs ${key} as a list of strings`);
  return value as readonly string[];
}

function objectList(name: string, props: Props, key: string): readonly { readonly [key: string]: LiteralValue }[] {
  const value = props[key];
  const isObject = (item: LiteralValue): item is { readonly [key: string]: LiteralValue } =>
    typeof item === 'object' && item !== null && !Array.isArray(item);
  if (!Array.isArray(value) || !value.every(isObject)) return fail(`<${name}> needs ${key} as a list of objects`);
  return value as readonly { readonly [key: string]: LiteralValue }[];
}

const oneLine = (text: string): string => text.replace(/\s+/g, ' ').trim();
const escapeCell = (text: string): string => oneLine(text).replace(/([\\|*`])/g, '\\$1');

/** A captioned Markdown table: the DataTable transform, and the comparison pages' side-by-side table, render through it. */
export function markdownTable(caption: string, columns: readonly string[], rows: readonly (readonly string[])[]): string {
  return [
    `Table: ${oneLine(caption)}`,
    '',
    `| ${columns.map(escapeCell).join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(escapeCell).join(' | ')} |`),
  ].join('\n');
}

function blockquote(title: string | undefined, body: string): string {
  const lines = [...(title === undefined ? [] : [`**${title}**`, '']), ...body.split('\n')];
  return lines.map((line) => (line === '' ? '>' : `> ${line}`)).join('\n');
}

function dedent(text: string): string {
  const lines = text.replace(/^\n+|\s+$/g, '').split('\n');
  const indents = lines.filter((line) => line.trim() !== '').map((line) => /^\s*/.exec(line)?.[0].length ?? 0);
  const strip = indents.length === 0 ? 0 : Math.min(...indents);
  return lines.map((line) => line.slice(strip)).join('\n');
}

type Handler = (props: Props, children: string | undefined, options: MdxTransformOptions) => string;

const block = (markdown: string): string => `\n\n${markdown}\n\n`;

const HANDLERS: Readonly<Record<string, Handler>> = {
  DataTable: (props) => {
    allow('DataTable', props, ['caption', 'columns', 'rows', 'rowHeaders']);
    const caption = stringProp('DataTable', props, 'caption');
    const columns = stringList('DataTable', props, 'columns');
    const rowsValue = props['rows'];
    if (!Array.isArray(rowsValue)) return fail('<DataTable> needs rows as a list of rows');
    const rows = rowsValue.map((row) => {
      if (!Array.isArray(row) || row.some((cell) => typeof cell !== 'string')) return fail('<DataTable> rows must be lists of strings');
      if (row.length !== columns.length) return fail('<DataTable> has a row with a different number of cells than columns');
      return row as readonly string[];
    });
    return block(markdownTable(caption, columns, rows));
  },
  CellTrail: (props, _children, options) => {
    allow('CellTrail', props, ['cells', 'label', 'current']);
    const label = stringProp('CellTrail', props, 'label');
    const cells = objectList('CellTrail', props, 'cells').map((cell) => {
      const cellLabel = cell['label'];
      const link = cell['href'];
      if (typeof cellLabel !== 'string') return fail('<CellTrail> cells need a string label');
      if (link !== undefined && typeof link !== 'string') return fail('<CellTrail> cell href must be a string');
      return link !== undefined && options.isLive(link) ? `[${cellLabel}](${link})` : cellLabel;
    });
    return block([`${oneLine(label)}:`, '', ...cells.map((cell, index) => `${index + 1}. ${cell}`)].join('\n'));
  },
  Steps: (props) => {
    allow('Steps', props, ['steps', 'headingLevel']);
    const steps = objectList('Steps', props, 'steps').map((step, index) => {
      const title = step['title'];
      const body = step['body'];
      if (typeof title !== 'string' || typeof body !== 'string') return fail('<Steps> steps need a string title and body');
      return `${index + 1}. **${/[.!?:]$/.test(title) ? title : `${title}.`}** ${body}`;
    });
    return block(steps.join('\n'));
  },
  Callout: (props, children, options) => {
    allow('Callout', props, ['tone', 'title']);
    const tone = optionalString('Callout', props, 'tone');
    if (tone !== undefined && tone !== 'info' && tone !== 'notice') return fail(`<Callout> has an unknown tone: ${tone}`);
    if (children === undefined) return fail('<Callout> has no content');
    const title = optionalString('Callout', props, 'title');
    return block(blockquote(title, transformProse(dedent(children), options)));
  },
  NoFundingDisclaimer: (props, children) => {
    allow('NoFundingDisclaimer', props, []);
    if (children !== undefined) return fail('<NoFundingDisclaimer> takes no content');
    return block(blockquote(NO_FUNDING_TITLE, NO_FUNDING_TEXT));
  },
  IntroductionsDisclaimer: (props, children) => {
    allow('IntroductionsDisclaimer', props, []);
    if (children !== undefined) return fail('<IntroductionsDisclaimer> takes no content');
    // Its wording is counsel-reviewed where it is defined (RELEASE.md section 8 lists each file that carries it). A second copy in the
    // transform would be a file the checklist does not list, so a page that renders it has no twin until the checklist names the twin.
    return fail(SERVICE_DISCLAIMER_REFUSAL);
  },
  MaybeLink: (props, children, options) => {
    allow('MaybeLink', props, ['path']);
    const path = stringProp('MaybeLink', props, 'path');
    if (!path.startsWith('/') || path.startsWith('//')) return fail(`<MaybeLink> path is not a site route: ${path}`);
    if (children === undefined) return fail('<MaybeLink> has no text');
    const text = transformProse(children, options).trim();
    return options.isLive(path) ? `[${text}](${path})` : text;
  },
};

/** Names of the components this transform converts. */
export const KNOWN_COMPONENTS: readonly string[] = Object.keys(HANDLERS);

/** A paragraph written as one line of HTML with no attributes and no markup inside (an article's quoted passage): its text is the Markdown paragraph. */
const PLAIN_PARAGRAPH = /^<p>([^<\n]+)<\/p>$/;
const IMPORT_LINE = /^import\s+[A-Za-z_]\w*\s+from\s+['"][^'"]+\.astro['"];?\s*$/;

/** Rewrites the components in prose (no code fences in `text`). Inline code spans are left alone. */
function transformProse(text: string, options: MdxTransformOptions): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const char = text[i] ?? '';
    if (char === '`') {
      const run = /^`+/.exec(text.slice(i))?.[0] ?? '`';
      const close = text.indexOf(run, i + run.length);
      const end = close === -1 ? text.length : close + run.length;
      out += text.slice(i, end);
      i = end;
      continue;
    }
    if (char !== '<' || !/[A-Z]/.test(text[i + 1] ?? '')) {
      out += char;
      i += 1;
      continue;
    }
    const tag = parseTag(text, i);
    const handler = HANDLERS[tag.name];
    if (handler === undefined) return fail(`<${tag.name}> is a component this transform does not convert`);
    if (tag.selfClosing) {
      out += handler(tag.props, undefined, options);
      i = tag.end;
      continue;
    }
    const closing = `</${tag.name}>`;
    const close = text.indexOf(closing, tag.end);
    if (close === -1) return fail(`<${tag.name}> is never closed`);
    const children = text.slice(tag.end, close);
    if (children.includes(`<${tag.name}`)) return fail(`<${tag.name}> is nested in itself`);
    out += handler(tag.props, children, options);
    i = close + closing.length;
  }
  return out;
}

/**
 * An element marked `data-generic-definition` or `data-claim-allow` is exempt from a claims rule on the page, but the claims audit reads a
 * Markdown file as plain text and honors no marker (scripts/audit-claims.mjs, `plain`). Converting the element would put the exempt wording
 * in a file where it is a finding, and removing it would make the twin differ from its page, so a page that holds one has no twin.
 */
const CLAIMS_MARKER = /\bdata-(?:generic-definition|claim-allow)\b/;
export const CLAIMS_MARKER_REASON = 'the page holds a claims marker (data-generic-definition or data-claim-allow), which the plain-text claims audit cannot honor';

/** Splits at fenced code blocks, which pass through untouched. */
function splitFences(text: string): readonly { readonly code: boolean; readonly text: string }[] {
  const segments: { code: boolean; text: string }[] = [];
  let fence: string | undefined;
  for (const line of text.split('\n')) {
    const opener = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    const last = segments.at(-1);
    if (fence === undefined && opener !== undefined) {
      fence = opener;
      segments.push({ code: true, text: line });
    } else if (fence !== undefined) {
      if (last !== undefined) last.text += `\n${line}`;
      if (opener !== undefined && opener[0] === fence[0] && opener.length >= fence.length) fence = undefined;
    } else if (last !== undefined && !last.code) {
      last.text += `\n${line}`;
    } else {
      segments.push({ code: false, text: line });
    }
  }
  return segments;
}

/** Converts the MDX body to Markdown. Never throws for content it does not understand; it returns `ok: false` with the reason. */
export function transformMdx(source: string, options: MdxTransformOptions): MdxTransformResult {
  try {
    const pieces = splitFences(source).map((segment) => {
      if (segment.code) return segment.text;
      if (CLAIMS_MARKER.test(segment.text)) return fail(CLAIMS_MARKER_REASON);
      const kept = segment.text
        .split('\n')
        .filter((line) => !IMPORT_LINE.test(line))
        .map((line) => line.replace(PLAIN_PARAGRAPH, '$1'))
        .join('\n');
      return transformProse(kept, options);
    });
    const markdown = pieces
      .join('\n')
      .replace(/[ \t]+$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return { ok: true, markdown };
  } catch (error) {
    if (error instanceof MdxTransformError) return { ok: false, reason: error.message };
    throw error;
  }
}
