import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Reads the public API of an Astro component from its source: the members of `interface Props` (name, optionality, type text),
 * the types it extends or intersects, and the names of its slots. Used by the pinned-props test to prove that a component other
 * packages import keeps its API.
 */

export interface PropApi {
  readonly optional: boolean;
  readonly type: string;
}

export interface ComponentApi {
  readonly props: Readonly<Record<string, PropApi>>;
  /** Types the Props interface extends, or the whole alias when Props is `type Props = Other`. */
  readonly extends: readonly string[];
  /** Slot names; the default slot is `default`. */
  readonly slots: readonly string[];
}

export const ROOT = new URL('../../../', import.meta.url).pathname;

/** The component folders whose files other work packages import. */
export const COMPONENT_DIRS = ['ui', 'blocks', 'program', 'diagrams', 'hero', 'motion'] as const;

function frontmatter(source: string): string {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  return match?.[1] ?? '';
}

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

/** Returns the text between the brace at `open` and its partner, and the index after the partner. */
function balanced(text: string, open: number): { body: string; end: number } {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return { body: text.slice(open + 1, i), end: i + 1 };
    }
  }
  throw new Error('unbalanced braces in the Props definition');
}

/** Splits a members body on top-level `;` and `,`. An arrow's `>` is not a closing angle bracket. */
function splitMembers(body: string): string[] {
  const members: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i] ?? '';
    const arrow = ch === '>' && body[i - 1] === '=';
    if ('{([<'.includes(ch)) depth += 1;
    if ('})]>'.includes(ch) && !arrow) depth -= 1;
    if ((ch === ';' || ch === ',') && depth === 0) {
      members.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  members.push(current);
  return members.map((m) => m.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

function parseMember(member: string): [string, PropApi] | undefined {
  const match = /^(?:readonly\s+)?(['"]?[\w-]+['"]?)(\?)?\s*:\s*(.+)$/.exec(member);
  if (!match) return undefined;
  const [, rawName, question, type] = match;
  return [String(rawName).replace(/['"]/g, ''), { optional: question === '?', type: String(type).replace(/\s+/g, ' ').trim() }];
}

/** The right-hand side of a type alias: everything up to the first `;` outside braces and angle brackets. */
function aliasExpression(text: string): string {
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '{' || ch === '<' || ch === '(') depth += 1;
    if ((ch === '}' || ch === ')' || (ch === '>' && text[i - 1] !== '=')) && depth > 0) depth -= 1;
    if (ch === ';' && depth === 0) return text.slice(0, i);
  }
  return text;
}

function readMembers(front: string, interfaceName: string): { props: Record<string, PropApi>; extended: string[] } | undefined {
  const props: Record<string, PropApi> = {};
  const extended: string[] = [];
  const iface = new RegExp(`interface\\s+${interfaceName}\\b([^{]*)\\{`).exec(front);
  if (iface?.index === undefined) return undefined;
  const extendsMatch = /extends\s+([^{]+)/.exec(iface[1] ?? '');
  if (extendsMatch?.[1]) extended.push(...extendsMatch[1].split(',').map((t) => t.replace(/\s+/g, ' ').trim()));
  const { body } = balanced(front, iface.index + iface[0].length - 1);
  for (const member of splitMembers(body)) {
    const parsed = parseMember(member);
    if (parsed) props[parsed[0]] = parsed[1];
  }
  return { props, extended };
}

/** The members of a named interface in a TypeScript file (the shared layout types). */
export function readInterface(source: string, interfaceName: string): ComponentApi {
  const found = readMembers(stripComments(source), interfaceName);
  if (!found) throw new Error(`interface ${interfaceName} not found`);
  return { props: found.props, extends: found.extended.sort(), slots: [] };
}

export function readComponentApi(source: string): ComponentApi {
  const front = stripComments(frontmatter(source));
  const props: Record<string, PropApi> = {};
  const extended: string[] = [];

  const declared = readMembers(front, 'Props');
  if (declared) {
    Object.assign(props, declared.props);
    extended.push(...declared.extended);
  } else {
    const alias = /type\s+Props\s*=\s*/.exec(front);
    if (alias?.index !== undefined) {
      const expression = aliasExpression(front.slice(alias.index + alias[0].length));
      const open = expression.indexOf('{');
      const names = (open === -1 ? expression : expression.slice(0, open)).split('&').map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
      extended.push(...names);
      if (open !== -1) {
        const { body } = balanced(expression, open);
        for (const member of splitMembers(body)) {
          const parsed = parseMember(member);
          if (parsed) props[parsed[0]] = parsed[1];
        }
      }
    }
  }

  const slots = new Set<string>();
  const template = source.slice(source.indexOf('---', source.indexOf('---') + 3) + 3).replace(/<style[\s\S]*?<\/style>/g, '');
  for (const match of template.matchAll(/<slot\b([^>]*)>/g)) {
    const named = /name=["']([^"']+)["']/.exec(match[1] ?? '');
    slots.add(named?.[1] ?? 'default');
  }

  return { props, extends: extended.sort(), slots: [...slots].sort() };
}

/** Every component file in the folders other packages import from, keyed by its path under src/components. */
export function readAllComponentApis(): Record<string, ComponentApi> {
  const apis: Record<string, ComponentApi> = {};
  for (const dir of COMPONENT_DIRS) {
    const folder = join(ROOT, 'src/components', dir);
    for (const entry of readdirSync(folder).sort()) {
      if (!entry.endsWith('.astro')) continue;
      apis[`${dir}/${entry}`] = readComponentApi(readFileSync(join(folder, entry), 'utf8'));
    }
  }
  return apis;
}

/** The page layouts and the shared types they accept. Pages pass these props, so they are API too. */
export function readAllLayoutApis(): Record<string, ComponentApi> {
  const apis: Record<string, ComponentApi> = {};
  const folder = join(ROOT, 'src/layouts');
  for (const entry of readdirSync(folder).sort()) {
    if (entry.endsWith('.astro')) apis[`layouts/${entry}`] = readComponentApi(readFileSync(join(folder, entry), 'utf8'));
  }
  const types = readFileSync(join(folder, 'types.ts'), 'utf8');
  for (const name of ['PageMeta', 'HeroProps', 'HeaderProps', 'Heading']) apis[`layouts/types.ts#${name}`] = readInterface(types, name);
  return apis;
}
