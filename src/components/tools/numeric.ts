/**
 * What the founder tools share: reading a typed number, formatting it, and the one calculation outcome type. Pure logic with no DOM and
 * no Astro imports, so `node --test` loads it and the three tools read an entry the same way.
 *
 * A typed entry is a number, a blank, or an error that says what to fix. Nothing here returns `NaN` or `Infinity`: a division by zero or
 * a result too large to show becomes a stated reason, never a value.
 */

/** An amount (zero or more, two decimals at most are shown), a whole count, or a percent from 0 to 100. */
export type EntryKind = 'amount' | 'count' | 'percent';

export interface EntrySpec {
  readonly label: string;
  readonly kind: EntryKind;
}

/** The largest entry accepted. It keeps every sum, product and quotient the tools compute well inside the range of a double. */
export const MAX_ENTRY = 1e12;

export type ParsedEntry =
  | { readonly kind: 'empty' }
  | { readonly kind: 'value'; readonly value: number }
  | { readonly kind: 'error'; readonly message: string };

/** Digits with optional thousands commas and an optional decimal part. No sign, no exponent, no currency symbol. */
const PLAIN_NUMBER = /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$|^\.\d+$/;

/** Parses what a person typed into one field. Returns a described error rather than a number that cannot be used. */
export function parseEntry(spec: EntrySpec, raw: string | undefined): ParsedEntry {
  const text = (raw ?? '').trim();
  if (text === '') return { kind: 'empty' };
  const negative = text.startsWith('-');
  const unsigned = negative ? text.slice(1).trim() : text;
  if (!PLAIN_NUMBER.test(unsigned)) {
    return { kind: 'error', message: `${spec.label}: enter digits only, with commas or one decimal point if you need them.` };
  }
  const value = Number(unsigned.replace(/,/g, ''));
  if (!Number.isFinite(value)) return { kind: 'error', message: `${spec.label}: that number is too large to use.` };
  if (negative && value !== 0) return { kind: 'error', message: `${spec.label}: enter zero or more, not a negative number.` };
  if (value > MAX_ENTRY) return { kind: 'error', message: `${spec.label}: use a number below one trillion.` };
  if (spec.kind === 'count' && !Number.isInteger(value)) return { kind: 'error', message: `${spec.label}: enter a whole number.` };
  if (spec.kind === 'percent' && value > 100) return { kind: 'error', message: `${spec.label}: enter a percent from 0 to 100.` };
  return { kind: 'value', value: value === 0 ? 0 : value };
}

export interface FieldIssue {
  readonly id: string;
  readonly message: string;
}

/** `ready` has a number, `waiting` lacks an entry, `undefined` has every entry but no number exists for them. */
export type ResultStatus = 'ready' | 'waiting' | 'undefined';

const amountFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const countFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const monthsFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const percentFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** A value that rounds to zero is shown without a minus sign. */
function unsignedZero(text: string): string {
  return /^-0(\.0+)?$/.test(text) ? text.slice(1) : text;
}

export function formatAmount(value: number): string {
  return unsignedZero(amountFormat.format(value));
}

export function formatCount(value: number): string {
  return unsignedZero(countFormat.format(value));
}

export function formatPercent(value: number): string {
  return `${unsignedZero(percentFormat.format(value))}%`;
}

/** Percentage points, signed, for a change: "-2.50 points". A change that rounds to zero has no sign. */
export function formatPoints(value: number): string {
  const text = unsignedZero(percentFormat.format(value));
  return `${value > 0 && text !== '0.00' ? '+' : ''}${text} points`;
}

/**
 * Rounds a number of months down to one decimal place and formats it. The runway article says to round down, because a figure rounded
 * up flatters the position. The value is first cleaned to twelve significant digits so that 0.3 / 0.1, which a double stores as
 * 2.9999999999999996, shows as 3.0 and not 2.9.
 */
export function formatMonthsDown(value: number): string {
  const text = monthsFormat.format(floorTo(value, 1));
  return `${text} ${text === '1.0' ? 'month' : 'months'}`;
}

/** Rounds down to a number of decimal places, with the float noise of the division removed first. */
export function floorTo(value: number, places: number): number {
  const scale = 10 ** places;
  const cleaned = Number((value * scale).toPrecision(12));
  return Math.floor(cleaned) / scale;
}

/** True for a finite number. The tools never show anything else. */
export function isUsable(value: number): boolean {
  return Number.isFinite(value);
}
