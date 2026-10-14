/**
 * Prop contracts for the visuals library. Components call these at build time; a violation throws with the component name and the
 * offending value, so a bad prop fails the build instead of shipping a broken figure. Pure functions, unit-tested in tests/unit/wp-52.
 *
 * Copy rules enforced here (ORCHESTRATION 2026-10-14): no banned positioning words in any label, alt or title the components render;
 * no prices anywhere in the visuals; every statistic carries its source.
 */
import { ORBIT_MAX_BODIES, MAX_SEATS } from '../../scripts/visuals/geometry.ts';

export class VisualContractError extends Error {
  constructor(component: string, message: string) {
    super(`${component}: ${message}`);
    this.name = 'VisualContractError';
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------------------------------------------------------------

/**
 * Words and phrases the visuals never render (the audit:claims denylist plus the positioning rules): WE is not an accelerator, an
 * investor or a seat seller, and the site writes US English.
 */
export const DENYLIST: readonly RegExp[] = [
  /\bfree\b/i,
  /\bperks?\b/i,
  /\baccelerator\b/i,
  /\bcohorts?\b/i,
  /\bmentor(s|ship)?\b/i,
  /\balumni\b/i,
  /\binvestor network\b/i,
  /\bpremier\b/i,
  /\brevolutionary\b/i,
  /\btestimonials?\b/i,
  /\btranches?\b/i,
  /\bvaluation cap\b/i,
  /\bpro rata\b/i,
  /\bMFN\b/,
  /\bdiscount rate\b/i,
  /\bnon-dilutive\b/i,
  /\bno equity\b/i,
  /\bfundable company\b/i,
  /\bbecome fundable\b/i,
  /\bdemo day\b/i,
  /\b(colour|organis|behaviour|centre\b|favour|honour)/i,
  /\bWe (build|steer|coordinate)\b/,
];

/** Any currency amount: the visuals never show a price (seat prices are not published). */
export const PRICE = /(?:[$€£]\s?\d)|(?:\b\d[\d,.]*\s?(?:USD|EUR|GBP)\b)/i;

export function findDenied(text: string): string | null {
  for (const pattern of DENYLIST) {
    const match = pattern.exec(text);
    if (match !== null) return match[0];
  }
  return null;
}

/** Throws when `text` holds a denied word, or a price unless `allowPrice`. Returns the trimmed text. */
export function cleanText(component: string, field: string, text: string, opts: { readonly allowEmpty?: boolean } = {}): string {
  const value = text.trim();
  if (value === '' && opts.allowEmpty !== true) throw new VisualContractError(component, `${field} is empty`);
  const denied = findDenied(value);
  if (denied !== null) throw new VisualContractError(component, `${field} uses "${denied}", which the site never says: "${value}"`);
  if (PRICE.test(value)) throw new VisualContractError(component, `${field} shows a price; the visuals never do: "${value}"`);
  return value;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Scene frame
// ---------------------------------------------------------------------------------------------------------------------------------

export const SCENE_RATIOS = ['16/9', '21/9', '4/3', '1/1', '3/1'] as const;
export type SceneRatio = (typeof SCENE_RATIOS)[number];

export function sceneRatio(component: string, ratio: string): SceneRatio {
  if ((SCENE_RATIOS as readonly string[]).includes(ratio)) return ratio as SceneRatio;
  throw new VisualContractError(component, `ratio "${ratio}" is not one of ${SCENE_RATIOS.join(', ')}`);
}

/** Class for a ratio: `ratio-16-9`. */
export const ratioClass = (ratio: SceneRatio): string => `ratio-${ratio.replace('/', '-')}`;

// ---------------------------------------------------------------------------------------------------------------------------------
// Labels (orbit bodies, launch stations and waypoints, nursery moons)
// ---------------------------------------------------------------------------------------------------------------------------------

export interface SceneLabel {
  readonly label: string;
  readonly href?: string | undefined;
  /** One line shown under the label (and the text equivalent in the list). */
  readonly description?: string | undefined;
}

export function sceneLabels(component: string, items: readonly SceneLabel[], min: number, max: number): readonly SceneLabel[] {
  if (items.length < min || items.length > max) {
    throw new VisualContractError(component, `needs ${min === max ? String(min) : `${min} to ${max}`} labels, got ${items.length}`);
  }
  return items.map((item, i) => ({
    label: cleanText(component, `label ${i + 1}`, item.label),
    href: item.href,
    description: item.description === undefined ? undefined : cleanText(component, `description ${i + 1}`, item.description),
  }));
}

export const orbitBodies = (component: string, items: readonly SceneLabel[]): readonly SceneLabel[] => sceneLabels(component, items, 1, ORBIT_MAX_BODIES);

/** The pre-rendered orbit posters. Any other configuration uses the sun-only base poster with SVG rings and bodies drawn over it. */
export function orbitPosterKey(count: number, rings: 'single' | 'nested'): 'orbit-7-single' | 'orbit-10-nested' | null {
  if (count === 7 && rings === 'single') return 'orbit-7-single';
  if (count === 10 && rings === 'nested') return 'orbit-10-nested';
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Statistics: every number on a sales page is sourced (ORCHESTRATION 2026-10-14: sales pages feed these with sourced statistics).
// ---------------------------------------------------------------------------------------------------------------------------------

export interface StatSource {
  /** Who published it and what, e.g. "US Bureau of Labor Statistics, Business Employment Dynamics". */
  readonly label: string;
  readonly href?: string | undefined;
  /** The year or period the figure describes, e.g. "2024". */
  readonly period?: string | undefined;
}

export function statSource(component: string, source: StatSource | undefined): StatSource {
  if (source === undefined || source.label.trim() === '') throw new VisualContractError(component, 'a statistic needs a source (label, and href when public)');
  if (source.href !== undefined && !/^https:\/\//.test(source.href)) throw new VisualContractError(component, `source href must be an https URL: "${source.href}"`);
  return { label: cleanText(component, 'source label', source.label), href: source.href, period: source.period };
}

export interface Stat {
  /** The figure as displayed, e.g. "48.9%" or "5.5 million". */
  readonly value: string;
  readonly label: string;
  readonly source: StatSource;
  /** Optional icon key from the visuals icon set. */
  readonly icon?: string | undefined;
}

export function stat(component: string, item: Stat): Stat {
  if (!/\d/.test(item.value)) throw new VisualContractError(component, `stat value "${item.value}" has no number in it`);
  if (PRICE.test(item.value)) throw new VisualContractError(component, `stat value "${item.value}" is a price; the visuals never show prices`);
  return { value: item.value.trim(), label: cleanText(component, 'stat label', item.label), source: statSource(component, item.source), icon: item.icon };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------------------------------------------------------------

export interface SurvivalPoint {
  /** Years since founding. */
  readonly year: number;
  /** Share still operating, 0 to 100. */
  readonly percent: number;
}

export interface SurvivalSeries {
  readonly label: string;
  readonly points: readonly SurvivalPoint[];
}

export function survivalSeries(component: string, series: readonly SurvivalSeries[]): readonly SurvivalSeries[] {
  if (series.length < 1 || series.length > 3) throw new VisualContractError(component, `takes 1 to 3 series, got ${series.length}`);
  return series.map((s, si) => {
    if (s.points.length < 2) throw new VisualContractError(component, `series "${s.label}" needs at least two points`);
    let lastYear = -Infinity;
    for (const p of s.points) {
      if (!Number.isFinite(p.year) || p.year < 0 || p.year <= lastYear) throw new VisualContractError(component, `series "${s.label}": years must start at 0 or later and increase (got ${p.year})`);
      if (!Number.isFinite(p.percent) || p.percent < 0 || p.percent > 100) throw new VisualContractError(component, `series "${s.label}": percent ${p.percent} is outside 0 to 100`);
      lastYear = p.year;
    }
    return { label: cleanText(component, `series ${si + 1} label`, s.label), points: s.points };
  });
}

export interface Datum {
  readonly label: string;
  readonly value: number;
  /** Display form of the value, e.g. "38%". Defaults to the number. */
  readonly display?: string | undefined;
}

export function data(component: string, items: readonly Datum[], min: number, max: number): readonly Datum[] {
  if (items.length < min || items.length > max) throw new VisualContractError(component, `takes ${min} to ${max} values, got ${items.length}`);
  return items.map((d, i) => {
    if (!Number.isFinite(d.value) || d.value < 0) throw new VisualContractError(component, `value ${i + 1} ("${d.label}") must be a number of zero or more`);
    if (d.display !== undefined && PRICE.test(d.display)) throw new VisualContractError(component, `value ${i + 1} is shown as a price`);
    return { label: cleanText(component, `label ${i + 1}`, d.label), value: d.value, display: d.display };
  });
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Long-horizon timeline
// ---------------------------------------------------------------------------------------------------------------------------------

export interface Milestone {
  /** When it typically happens, in years from the start (0.5 = six months). */
  readonly at: number;
  readonly label: string;
  readonly detail?: string | undefined;
  /** Required when the placement rests on a statistic (it usually does). */
  readonly source?: StatSource | undefined;
  /** Survival markers render as gates on the track rather than as events. */
  readonly kind?: 'event' | 'survival' | undefined;
}

export function milestones(component: string, items: readonly Milestone[], horizon: number): readonly Milestone[] {
  if (!Number.isFinite(horizon) || horizon < 1 || horizon > 20) throw new VisualContractError(component, `horizon ${horizon} must be 1 to 20 years`);
  if (items.length < 1 || items.length > 12) throw new VisualContractError(component, `takes 1 to 12 milestones, got ${items.length}`);
  return [...items]
    .map((m, i) => {
      if (!Number.isFinite(m.at) || m.at < 0 || m.at > horizon) throw new VisualContractError(component, `milestone ${i + 1} at ${m.at} years is outside 0 to ${horizon}`);
      return {
        at: m.at,
        label: cleanText(component, `milestone ${i + 1} label`, m.label),
        detail: m.detail === undefined ? undefined : cleanText(component, `milestone ${i + 1} detail`, m.detail),
        source: m.source === undefined ? undefined : statSource(component, m.source),
        kind: m.kind ?? 'event',
      };
    })
    .sort((a, b) => a.at - b.at);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The team WE steers (unpriced; ORCHESTRATION 2026-10-14)
// ---------------------------------------------------------------------------------------------------------------------------------

export interface TeamRole {
  readonly role: string;
  /** Seniority or focus, e.g. "Senior". */
  readonly level?: string | undefined;
  /** Role group (from src/data/seat-roles.ts), used for the token tint. */
  readonly group?: string | undefined;
}

export function teamRoles(component: string, roles: readonly TeamRole[]): readonly TeamRole[] {
  if (roles.length < 1 || roles.length > MAX_SEATS) throw new VisualContractError(component, `shows 1 to ${MAX_SEATS} roles, got ${roles.length}`);
  return roles.map((r, i) => ({
    role: cleanText(component, `role ${i + 1}`, r.role),
    level: r.level === undefined ? undefined : cleanText(component, `role ${i + 1} level`, r.level),
    group: r.group,
  }));
}
