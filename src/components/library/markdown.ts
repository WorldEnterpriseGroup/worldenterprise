/**
 * Builds the static Markdown download for a library template. The HTML page and the download come from the same
 * source file. Checklist boxes are written as escaped brackets in the source so they render as plain text on the
 * page (no unlabeled form controls); the download restores real Markdown task syntax.
 */
export interface MarkdownSource {
  readonly title: string;
  readonly description: string;
  readonly instructions: string;
  readonly body: string;
  readonly updated: Date;
}

export function restoreTaskBoxes(markdown: string): string {
  return markdown.replaceAll('\\[ \\]', '[ ]').replaceAll('\\[x\\]', '[x]');
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function buildMarkdownDownload(source: MarkdownSource): string {
  const body = restoreTaskBoxes(source.body.trim());
  return [
    `# ${source.title}`,
    '',
    `${source.description}`,
    '',
    `> **How to use this.** ${source.instructions}`,
    '',
    body,
    '',
    '---',
    '',
    `World Enterprise Incubator, https://worldenterprise.org/. Last updated ${isoDate(source.updated)}.`,
    '',
  ].join('\n');
}

/** Download path for a template slug, for example /library/one-page-problem-brief.md. */
export function markdownPath(slug: string): string {
  return `/library/${slug}.md`;
}

/** Route slug for a collection entry id. Fixtures live in a _fixtures/ folder, so the slug is the last id segment. */
export function entrySlug(id: string): string {
  return id.split('/').at(-1) ?? id;
}
