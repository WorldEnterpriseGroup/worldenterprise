import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import * as tokenAudit from '../../../../scripts/audit-tokens.mjs';

// WP-71 brand consistency audit, static half. One pure function per file (`auditSource`) so the self-tests can plant a violation in a
// string and watch it fail, and one walker (`auditFolders`) that the real test runs over the component folders of the new families.
// The CSS rules (raw colour, !important, magic spacing) are the repository's own `auditCss`; the rules added here are the brand's.

export interface Finding {
  readonly file: string;
  readonly line: number;
  readonly rule: BrandRule;
  readonly text: string;
}

export type BrandRule =
  | 'raw-colour'
  | 'important'
  | 'magic-spacing'
  | 'hard-coded-colour'
  | 'inline-style'
  | 'second-lockup'
  | 'dark-band-logo'
  | 'shared-card'
  | 'own-button';

interface CssViolation {
  readonly file: string;
  readonly line: number;
  readonly rule: string;
  readonly text: string;
}
const { auditCss, extractCss } = tokenAudit as unknown as {
  auditCss(file: string, css: string, firstLine?: number, isTokens?: boolean): CssViolation[];
  extractCss(path: string, text: string): { css: string; line: number }[];
};

/** Component folders the audit covers (issue #51). A folder that does not exist yet is skipped and reported, never an error. */
export const AUDITED_FOLDERS = ['families', 'brand', 'journey', 'segments', 'segment', 'industries', 'industry', 'compare', 'investors', 'investor', 'partners', 'partner', 'briefs', 'cta', 'tools'] as const;

/** The folders WP-71 owns. A finding here fails the test; a finding elsewhere is routed to its owner in the audit handoff. */
export const OWN_FOLDERS: readonly string[] = ['families', 'brand'];

/** The only file that may reference the wordmark: the lockup component. The site header and footer own the real lockups. */
export const LOCKUP_FILE = 'src/components/brand/Lockup.astro';

/** Blank out every `<style>` block, keeping line numbers, so markup rules do not re-report what the CSS audit already covers. */
function withoutStyle(text: string): string {
  return text.replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, (block) => block.replace(/[^\n]/g, ' '));
}

/** Blank out comments, keeping line numbers. A `//` counts as a comment only at the start of a line or after whitespace (not in a URL). */
function withoutComments(text: string): string {
  const blank = (s: string): string => s.replace(/[^\n]/g, ' ');
  return text
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|\s)\/\/[^\n]*/g, (m, lead: string) => lead + blank(m.slice(lead.length)));
}

const HEX_COLOUR = /(?<![\w&/#-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![\w-])/;
const FUNCTIONAL_COLOUR = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/;

function lineRules(file: string, text: string, push: (line: number, rule: BrandRule, text: string) => void): void {
  const lines = withoutComments(withoutStyle(text)).split('\n');
  const isLockup = file === LOCKUP_FILE;
  const darkBand = /\b(on-inverse|bg-inverse|hero--console)\b/.test(lines.join('\n'));
  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (line === '') return;
    const n = index + 1;
    if (HEX_COLOUR.test(line) || FUNCTIONAL_COLOUR.test(line)) push(n, 'hard-coded-colour', line);
    if (/\sstyle\s*=|\bdefine:vars\b/.test(line)) push(n, 'inline-style', line);
    if (!isLockup && /we-logo-wordmark|Lockup\.astro|<Lockup\b/.test(line)) push(n, 'second-lockup', line);
    if (darkBand && !isLockup && /wordmark|lockup|\blogo\b/i.test(line)) push(n, 'dark-band-logo', line);
    if (file.startsWith('src/components/families/') && /ui\/Card\.astro/.test(line)) push(n, 'shared-card', line);
    if (/<button\b/.test(line) || /\bclass(?::list)?\s*=\s*["'{][^"'}]*\bbtn\b/.test(line)) push(n, 'own-button', line);
  });
}

/** Audit one source file (`.astro` or `.ts`). `file` is the repository-relative path with forward slashes. */
export function auditSource(file: string, text: string): readonly Finding[] {
  const findings: Finding[] = [];
  const push = (line: number, rule: BrandRule, source: string): void => {
    findings.push({ file, line, rule, text: source });
  };
  if (file.endsWith('.astro')) {
    for (const { css, line } of extractCss(file, text)) {
      for (const v of auditCss(file, css, line, false)) push(v.line, v.rule as BrandRule, v.text);
    }
  }
  lineRules(file, text, push);
  if (file === LOCKUP_FILE && !/assertLockupGround\(/.test(text)) push(1, 'dark-band-logo', 'Lockup.astro does not call assertLockupGround');
  return findings;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(astro|ts)$/.test(name)) out.push(path);
  }
  return out;
}

export interface FolderAudit {
  readonly present: readonly string[];
  readonly absent: readonly string[];
  readonly findings: readonly Finding[];
}

/** Audit every `.astro` and `.ts` file under src/components/<folder> for each audited folder that exists. */
export function auditFolders(root: string, folders: readonly string[] = AUDITED_FOLDERS): FolderAudit {
  const present: string[] = [];
  const absent: string[] = [];
  const findings: Finding[] = [];
  for (const folder of folders) {
    const dir = join(root, 'src/components', folder);
    if (!existsSync(dir)) {
      absent.push(folder);
      continue;
    }
    present.push(folder);
    for (const path of walk(dir)) {
      const rel = relative(root, path).split('\\').join('/');
      findings.push(...auditSource(rel, readFileSync(path, 'utf8')));
    }
  }
  return { present, absent, findings };
}

/** The folder a finding belongs to, for routing: `families`, `tools`, and so on. */
export function folderOf(finding: Finding): string {
  return finding.file.split('/')[2] ?? '';
}
