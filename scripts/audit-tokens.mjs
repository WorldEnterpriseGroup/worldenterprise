#!/usr/bin/env node
// Design-token audit. Fails when authored CSS (src/styles/**, and <style> blocks in .astro files) contains:
//   1. a raw colour value (hex, rgb(), hsl(), oklch(), lab(), named colour) outside src/styles/tokens.css;
//   2. !important outside a prefers-reduced-motion: reduce block;
//   3. a magic spacing literal (px or rem) in padding, margin, gap or inset properties; use the --sp-* scale.
// Usage: node scripts/audit-tokens.mjs [--root .]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const NAMED = ['white', 'black', 'red', 'green', 'blue', 'orange', 'yellow', 'purple', 'pink', 'gray', 'grey', 'navy', 'teal', 'silver', 'maroon', 'aqua', 'lime', 'olive', 'fuchsia'];
const COLOUR_PROPS = /^(color|background(-color|-image)?|border(-[a-z]+)*-color|border(-[a-z]+)*|outline(-color)?|fill|stroke|box-shadow|text-shadow|accent-color|caret-color|text-decoration-color|column-rule-color)$/;
const SPACING_PROPS = /^(padding|margin|gap|row-gap|column-gap|inset|padding-(block|inline)(-start|-end)?|margin-(block|inline)(-start|-end)?|inset-(block|inline)(-start|-end)?|(top|right|bottom|left))$/;
const SPACING_ALLOW_RULES = [/\.visually-hidden/];

/** Extract CSS text with 1-based starting line from a file. */
export function extractCss(path, text) {
  if (path.endsWith('.css')) return [{ css: text, line: 1 }];
  if (!path.endsWith('.astro')) return [];
  const out = [];
  const re = /<style\b[^>]*>([\s\S]*?)<\/style>/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const start = text.slice(0, m.index + m[0].indexOf('>') + 1).split('\n').length;
    out.push({ css: m[1], line: start });
  }
  return out;
}

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
}

function hasRawColour(value) {
  if (/#[0-9a-fA-F]{3,8}\b/.test(value)) return true;
  if (/\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/.test(value)) return true;
  const bare = value.replace(/var\([^)]*\)/g, '');
  return NAMED.some((n) => new RegExp(`(^|[\\s,(])${n}($|[\\s,)])`).test(bare));
}

function hasMagicSpacing(value) {
  const bare = value.replace(/var\([^)]*\)/g, '').replace(/calc\([^)]*\)/g, '');
  // Zero and 1 to 3 px offsets (hairline and border compensation) are allowed; everything else uses the scale.
  return /(^|[\s(,])-?(?!0(\.0+)?(px|rem)\b)(?![123]px\b)\d*\.?\d+(px|rem)\b/.test(bare.replace(/-([123])px/g, '$1px'));
}

/** Audit one file's CSS. Returns violations: { file, line, rule, text }. */
export function auditCss(file, css, firstLine = 1, isTokens = false) {
  const text = stripComments(css);
  const violations = [];
  const stack = [];
  let rule = '';
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const lineNo = firstLine + i;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const decl = /^([a-z-]+)\s*:\s*([^;{}]+?)\s*(;|$|\})/.exec(trimmed);
    const inReduce = stack.some((s) => /prefers-reduced-motion:\s*reduce/.test(s));
    const inForced = stack.some((s) => /forced-colors/.test(s));
    const inPrint = stack.some((s) => /^@media\s+print/.test(s));
    if (decl && !trimmed.endsWith('{')) {
      const [, prop, value] = decl;
      if (/!important/.test(value) && !inReduce && !/\[hidden\]/.test(rule)) violations.push({ file, line: lineNo, rule: 'important', text: trimmed });
      if (!isTokens && !inForced && !prop.startsWith('--') && COLOUR_PROPS.test(prop) && hasRawColour(value)) {
        violations.push({ file, line: lineNo, rule: 'raw-colour', text: trimmed });
      }
      if (!isTokens && !inPrint && SPACING_PROPS.test(prop) && hasMagicSpacing(value) && !SPACING_ALLOW_RULES.some((r) => r.test(rule))) {
        violations.push({ file, line: lineNo, rule: 'magic-spacing', text: trimmed });
      }
      if (!isTokens && prop.startsWith('--') && /^--(color|we)-/.test(prop) === false && hasRawColour(value) && !inForced) {
        violations.push({ file, line: lineNo, rule: 'raw-colour', text: trimmed });
      }
    }
    for (const ch of trimmed) {
      if (ch === '{') stack.push(trimmed.replace(/\{.*$/, '').trim());
      else if (ch === '}') stack.pop();
    }
    if (trimmed.endsWith('{')) rule = trimmed.slice(0, -1).trim();
  }
  return violations;
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'assets') continue;
      walk(p, out);
    } else if (/\.(css|astro)$/.test(name)) out.push(p);
  }
  return out;
}

export function auditTree(root, include = /./) {
  const all = [];
  for (const path of walk(join(root, 'src'))) {
    const rel = relative(root, path).split('\\').join('/');
    if (!include.test(rel)) continue;
    const text = readFileSync(path, 'utf8');
    for (const { css, line } of extractCss(path, text)) all.push(...auditCss(rel, css, line, rel === 'src/styles/tokens.css'));
  }
  return all;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf('--root');
  const root = i > -1 && process.argv[i + 1] ? process.argv[i + 1] : process.cwd();
  let violations;
  try {
    violations = auditTree(root);
  } catch (error) {
    console.error(`audit-tokens: cannot read sources: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  }
  for (const v of violations) console.error(`FAIL  ${v.file}:${v.line}  [${v.rule}]  ${v.text}`);
  console.log(`audit-tokens: ${violations.length} violation(s)`);
  process.exit(violations.length === 0 ? 0 : 1);
}
