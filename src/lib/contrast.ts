/**
 * Colour-pair contrast, read from the `@pair` annotations in tokens.css. Pure: takes the CSS text.
 * Each token that is annotated is resolved through var() aliases to a `--we-*` palette entry whose hex
 * value is recorded in the trailing comment.
 */
export interface PairResult {
  readonly foreground: string;
  readonly background: string;
  readonly required: number;
  readonly ratio: number;
  readonly foregroundHex: string;
  readonly backgroundHex: string;
  readonly pass: boolean;
}

const DECL = /^\s*(--[a-z0-9-]+):\s*([^;]+);\s*(?:\/\*\s*(.*?)\s*\*\/)?\s*$/;

interface Decl {
  readonly value: string;
  readonly comment: string;
}

function parseDecls(css: string): Map<string, Decl> {
  const map = new Map<string, Decl>();
  for (const line of css.split('\n')) {
    const m = DECL.exec(line);
    if (m && m[1] !== undefined && m[2] !== undefined) map.set(m[1], { value: m[2].trim(), comment: m[3] ?? '' });
  }
  return map;
}

function resolveHex(name: string, decls: Map<string, Decl>, depth = 0): string {
  const decl = decls.get(name);
  if (!decl || depth > 8) throw new Error(`Cannot resolve ${name}`);
  const hex = /#[0-9A-Fa-f]{6}\b/.exec(decl.comment);
  if (hex) return hex[0].toUpperCase();
  const alias = /^var\((--[a-z0-9-]+)\)$/.exec(decl.value);
  if (alias?.[1]) return resolveHex(alias[1], decls, depth + 1);
  throw new Error(`${name} has no hex comment and is not a var() alias`);
}

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function readPairs(css: string): PairResult[] {
  const decls = parseDecls(css);
  const out: PairResult[] = [];
  for (const match of css.matchAll(/@pair\s+([a-z0-9-]+)\s+([a-z0-9-]+)\s+([0-9.]+)/g)) {
    const [, fg, bg, req] = match;
    if (!fg || !bg || !req) continue;
    const foregroundHex = resolveHex(`--${fg}`, decls);
    const backgroundHex = resolveHex(`--${bg}`, decls);
    const ratio = contrastRatio(foregroundHex, backgroundHex);
    const required = Number(req);
    out.push({ foreground: fg, background: bg, required, ratio, foregroundHex, backgroundHex, pass: ratio >= required });
  }
  return out;
}
