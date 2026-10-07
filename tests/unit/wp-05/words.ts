/** Visible-word count for an MDX article: prose plus text inside component props, excluding imports and markup. */
export function visibleWords(mdxBody: string): { prose: number; total: number } {
  const noImports = mdxBody.replace(/^import .*$/gm, ' ');
  const prose = noImports
    .replace(/<[A-Za-z][\s\S]*?\/>/g, ' ')
    .replace(/<\/?[A-Za-z][^>]*>/g, ' ');
  const total = noImports
    .replace(/<\/?[A-Z][A-Za-z]*/g, ' ')
    .replace(/\b(caption|columns|rows|label|cells|href|current|steps|title|body)=\{?/g, ' ')
    .replace(/\/?>/g, ' ');
  const count = (s: string): number => s.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
  return { prose: count(prose), total: count(total) };
}

export function splitFrontmatter(raw: string): { front: string; body: string } {
  const parts = raw.split(/^---\s*$/m);
  return { front: parts[1] ?? '', body: parts.slice(2).join('---') };
}
