import type { PaletteCommand } from '../../nav/commands.ts';

/**
 * Matching for <we-palette>. Pure, so node --test can run it. No fuzzy scoring and no dependency: every word the visitor types has to
 * start a word of the label, the hint or the group (or sit inside the label), and the order is the order of the list unless a better
 * match comes first. That is predictable for a list of about eighty pages, which is what the palette searches.
 */
export const MAX_COMMANDS_SHOWN = 12;

/** Lower case, accents folded, punctuation turned into spaces, runs of space collapsed. */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function tokens(query: string): readonly string[] {
  const folded = fold(query);
  return folded === '' ? [] : folded.split(' ');
}

function words(text: string): readonly string[] {
  const folded = fold(text);
  return folded === '' ? [] : folded.split(' ');
}

/** Rank of one word of the query against one command: lower is better, null when it matches nowhere. */
function rankWord(word: string, label: string, labelWords: readonly string[], hintWords: readonly string[], groupWords: readonly string[]): number | null {
  if (label.startsWith(word)) return 0;
  if (labelWords.some((w) => w.startsWith(word))) return 1;
  if (label.includes(word)) return 2;
  if (hintWords.some((w) => w.startsWith(word))) return 3;
  if (groupWords.some((w) => w.startsWith(word))) return 4;
  return null;
}

export interface RankedCommand {
  readonly command: PaletteCommand;
  readonly score: number;
  /** Position in the source list, which breaks ties. */
  readonly order: number;
}

/**
 * The commands that match `query`, best first. An empty query matches everything in list order. A command matches when every word of
 * the query matches it; its score is the sum of the per-word ranks, so a label that starts with the query beats a hint that mentions it.
 */
export function rankCommands(commands: readonly PaletteCommand[], query: string): readonly RankedCommand[] {
  const typed = tokens(query);
  const ranked: RankedCommand[] = [];
  commands.forEach((command, order) => {
    if (typed.length === 0) {
      ranked.push({ command, score: 0, order });
      return;
    }
    const label = fold(command.label);
    const labelWords = words(command.label);
    const hintWords = words(command.hint ?? '');
    const groupWords = words(command.group);
    let score = 0;
    for (const word of typed) {
      const rank = rankWord(word, label, labelWords, hintWords, groupWords);
      if (rank === null) return;
      score += rank;
    }
    ranked.push({ command, score, order });
  });
  return typed.length === 0 ? ranked : ranked.sort((a, b) => a.score - b.score || a.order - b.order);
}

export interface CommandGroup {
  readonly name: string;
  readonly commands: readonly PaletteCommand[];
}

/**
 * Groups a ranked list for display. With no query the groups keep the navigation order and show every command. With a query the
 * list is cut to `limit` and the groups appear in the order of their best match, so the best match is always first.
 */
export function groupCommands(ranked: readonly RankedCommand[], query: string, limit: number = MAX_COMMANDS_SHOWN): readonly CommandGroup[] {
  const shown = tokens(query).length === 0 ? ranked : ranked.slice(0, limit);
  const order: string[] = [];
  const byGroup = new Map<string, PaletteCommand[]>();
  for (const { command } of shown) {
    const list = byGroup.get(command.group);
    if (list === undefined) {
      order.push(command.group);
      byGroup.set(command.group, [command]);
    } else {
      list.push(command);
    }
  }
  return order.map((name) => ({ name, commands: byGroup.get(name) ?? [] }));
}

export interface TextPart {
  readonly text: string;
  readonly match: boolean;
}

const isWordChar = (char: string): boolean => /[\p{L}\p{N}]/u.test(char);

/**
 * Splits a label into plain and matched parts so the matched letters can be marked. Each word of the query marks the first place it
 * starts a word of the label or, failing that, the first place it appears. Only labels whose lower case has the same length as the
 * label are marked (plain Latin text, which is all this site has); any other label is returned whole.
 */
export function highlight(label: string, query: string): readonly TextPart[] {
  const typed = tokens(query);
  const lowered = label.toLowerCase();
  if (typed.length === 0 || lowered.length !== label.length) return [{ text: label, match: false }];
  const marked: boolean[] = new Array<boolean>(label.length).fill(false);
  for (const word of typed) {
    let at = -1;
    for (let from = lowered.indexOf(word); from !== -1; from = lowered.indexOf(word, from + 1)) {
      if (at === -1) at = from;
      if (from === 0 || !isWordChar(lowered.charAt(from - 1))) {
        at = from;
        break;
      }
    }
    if (at === -1) continue;
    for (let i = at; i < at + word.length; i += 1) marked[i] = true;
  }
  const parts: TextPart[] = [];
  for (let i = 0; i < label.length; i += 1) {
    const match = marked[i] === true;
    const last = parts[parts.length - 1];
    if (last !== undefined && last.match === match) parts[parts.length - 1] = { text: last.text + label.charAt(i), match };
    else parts.push({ text: label.charAt(i), match });
  }
  return parts;
}
