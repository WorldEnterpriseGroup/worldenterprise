/**
 * Question and answer pairs from a Markdown body whose H2 headings are the questions. Pure, so a unit test pins the output.
 * The /about/facts/ page uses it to build the FAQPage node from the very text a reader sees, so the structured data cannot drift
 * from the page.
 */
export interface QaPair {
  readonly question: string;
  /** Plain text: list markers, emphasis and link syntax removed, blocks joined by a single space. */
  readonly answer: string;
}

/** Removes the Markdown syntax that has no meaning in a plain-text answer. */
function plain(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(\*|_)(.+?)\1/g, '$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Splits at each `## ` heading outside a fenced code block. Text before the first heading is not part of any answer. */
export function qaFromMarkdown(body: string): readonly QaPair[] {
  const pairs: QaPair[] = [];
  let question: string | null = null;
  let lines: string[] = [];
  let fenced = false;
  const flush = (): void => {
    if (question === null) return;
    const answer = plain(lines.join('\n'));
    if (answer !== '') pairs.push({ question, answer });
  };
  for (const line of body.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    const heading = fenced ? null : /^##\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading !== null) {
      flush();
      question = plain(heading[1] ?? '');
      lines = [];
    } else if (question !== null) {
      lines.push(line);
    }
  }
  flush();
  return pairs;
}

/** The FAQ sentence that says the site describes no intake calendar or demo day, copied verbatim from the FAQ answer. */
export function calendarStatementFrom(answer: string | undefined): string {
  const sentence = (answer ?? '').split(/(?<=[.!?])\s+(?=[A-Z])/).find((s) => /\bdemo day\b/.test(s));
  if (sentence === undefined) throw new Error('The FAQ answer "is-it-an-accelerator" has no sentence about a demo day, so llms.txt cannot state it.');
  return sentence.trim();
}

/** The facts answer about the paid add-on is the one that says "paid add-on" and carries the disclaimer. */
export function addOnStatementFrom(factsBody: string | undefined): string {
  const pair = qaFromMarkdown(factsBody ?? '').find((qa) => /\bpaid add-on\b/.test(qa.answer));
  if (pair === undefined) throw new Error('src/content/pages/about/facts.mdx has no answer about the paid add-on, so llms.txt cannot state it.');
  return pair.answer.replace(/^No\.\s+/, '');
}
