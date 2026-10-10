export function escapeHtml(text: string): string;
export function slugify(text: string): string;
export function renderInline(source: string): string;
export function renderMarkdown(source: string, options?: { headings?: { id: string; text: string }[] }): string;
