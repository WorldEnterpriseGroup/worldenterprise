/** Shared prop types for the hero components and the layouts that pass props to them. */

/** A hero action. A fragment href ("#form") links inside the page. */
export interface HeroCta {
  readonly label: string;
  readonly href: string;
  /** Marks the link as a file download, for example the Markdown version of a template. */
  readonly download?: boolean;
}

/**
 * How wide the hero copy runs, mirroring the body container of the layout below it so both share one left edge.
 * default: the 80rem page container. wide: the 90rem container. prose: the 46rem reading column.
 * rail: the page container with the copy held to the reading column, which is where an article body starts.
 */
export type HeroMeasure = 'default' | 'wide' | 'prose' | 'rail';

/** Vector art for the hero media slot. Used when no photo slot is given. */
export interface HeroArtProps {
  /** flower: a core cell ringed by six neighbours. trail: a row of numbered cells, one of them active. */
  readonly variant?: 'flower' | 'trail';
  /** trail: how many cells (2 to 7). */
  readonly count?: number;
  /** trail: the highlighted cell, counting from 1. */
  readonly active?: number;
  /** flower: one or two characters in the core cell, for example a service line letter. */
  readonly glyph?: string;
}

export const HERO_MODES = ['editorial', 'console', 'article', 'compact', 'atlas'] as const;
export type HeroMode = (typeof HERO_MODES)[number];
