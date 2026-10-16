import { CATEGORIES } from './categories.ts';
import type { CategoryId } from './types.ts';

/** One bar of the timeline: when a kind of program often fits, in years of a company's life. Illustrative. */
export interface TimelineBar {
  readonly id: CategoryId;
  readonly label: string;
  readonly from: number;
  readonly to: number;
}

export const TIMELINE_SPAN_YEARS = 10;

export const TIMELINE_BARS: readonly TimelineBar[] = CATEGORIES.map((c) => ({
  id: c.id,
  label: c.short,
  from: c.window.from,
  to: c.window.to,
}));

export function windowText(bar: TimelineBar): string {
  const end = bar.to >= TIMELINE_SPAN_YEARS ? 'year 10 and beyond' : `year ${bar.to}`;
  return `Year ${bar.from} to ${end}`;
}
