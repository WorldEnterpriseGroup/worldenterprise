/**
 * "A company's first decade, in one minute" (WP-22, issue #88): the storyboard of the explainer film, as data.
 *
 * One record per chapter drives everything that tells the story: the renderer that draws the frames
 * (src/assets/video/tools/render-decade.mjs), the WebVTT captions it writes, the transcript beside the player, the milestone carousel and
 * the gallery of stills. Every figure comes from the sales statistics register (src/data/sales/stats.ts, sources in
 * src/data/sales/sources.ts), so the film quotes nothing the sources ledger does not hold.
 *
 * Pure data: no Astro imports, so `node --test` and the render tool can load it.
 */
import { salesSource } from '../../data/sales/sources.ts';
import type { SalesSource } from '../../data/sales/sources.ts';
import { stat } from '../../data/sales/stats.ts';
import type { SalesStat, StatId } from '../../data/sales/stats.ts';

/** Frames per second of the film. */
export const DECADE_FPS = 30;
/** Running time in seconds. Between 30 and 60 (the brief), checked by tests/unit/wp-22. */
export const DECADE_DURATION = 57;
/** Pixel size of the encoded film. */
export const DECADE_SIZE = { width: 1920, height: 1080 } as const;

export type DecadeStage = 'title' | 'incubation' | 'launch' | 'growth' | 'close';

export interface DecadeChapter {
  /** Stable id: the caption cue id, the carousel item id and the still's file name. */
  readonly id: string;
  /** Start and end in seconds. Chapters are contiguous and cover the whole film. */
  readonly start: number;
  readonly end: number;
  readonly stage: DecadeStage;
  /** Where on the company's clock the chapter sits, in years (0 to 10). The renderer moves the timeline marker here. */
  readonly year: number;
  /** The short clock label ("Year 1"); empty on the title and closing cards. */
  readonly when: string;
  /** The headline shown on screen. */
  readonly title: string;
  /** One line under the headline, shown on screen. */
  readonly line: string;
  /** The statistic quoted on screen, by register id. */
  readonly stat?: StatId;
  /** The figure as the film words it, when the register's tile wording needs a fuller sentence on screen. */
  readonly statText?: string;
  /** What the picture shows, for the transcript (the film is silent, so the transcript also describes it). */
  readonly picture: string;
  /** The gallery still of this chapter: its alt text and caption. Absent on the title and closing cards. */
  readonly still?: { readonly alt: string; readonly caption: string };
}

export const DECADE_TITLE = "A company's first decade, in one minute";

export const DECADE_CHAPTERS: readonly DecadeChapter[] = [
  {
    id: 'title',
    start: 0,
    end: 5,
    stage: 'title',
    year: 0,
    when: '',
    title: DECADE_TITLE,
    line: 'WE build worlds. This is how long one takes.',
    picture: 'A night-blue sky with a faint field of stars. The title fades in at the center.',
  },
  {
    id: 'dust',
    start: 5,
    end: 12,
    stage: 'incubation',
    year: 0,
    when: 'Year 0',
    title: 'Incubation: the dust gathers',
    line: 'An idea, a plan and a filed application. Nothing is built yet.',
    stat: 'ST-06',
    statText: '5,671,836 U.S. business applications were filed in 2025, the most in any year of the series.',
    picture: 'A loose cloud of blue dust begins to turn slowly around an empty center.',
    still: {
      alt: 'A loose spiral of blue dust turning around an empty center on a night-blue sky.',
      caption: 'Year 0, incubation: an idea, a plan and an application, drawn as dust that has started to turn.',
    },
  },
  {
    id: 'core',
    start: 12,
    end: 19,
    stage: 'incubation',
    year: 0.57,
    when: 'Months 0 to 7',
    title: 'The core forms',
    line: 'The first hire comes months after the application, not days.',
    stat: 'ST-08',
    statText: '2.29 quarters (about seven months) from application to first payroll, for 2021 applications that hired within two years.',
    picture: 'The dust falls inward and packs into a small core of hexagonal tiles that glows faintly.',
    still: {
      alt: 'Blue dust spiraling into a small glowing core built from hexagonal tiles.',
      caption: 'Months 0 to 7: the core forms. On average the first payroll came 2.29 quarters after the application.',
    },
  },
  {
    id: 'ignition',
    start: 19,
    end: 26,
    stage: 'launch',
    year: 1,
    when: 'Year 1',
    title: 'Launch: the world lights up',
    line: 'Of every 100 new establishments, about 78 are still open a year later.',
    stat: 'ST-01',
    statText: '77.9% of new U.S. establishments were still operating after one year.',
    picture:
      'The core ignites into a lit world. Around it, a ring of 100 small lights stands for 100 new establishments; about 22 of them dim.',
    still: {
      alt: 'A lit hexagonal world at the center of a ring of 100 small lights, most lit and some dimmed.',
      caption: 'Year 1, launch: of 100 new establishments, about 78 are still operating a year later.',
    },
  },
  {
    id: 'rings',
    start: 26,
    end: 33,
    stage: 'growth',
    year: 3.5,
    when: 'Year 3.5',
    title: 'Established: the rings settle',
    line: 'The Global Entrepreneurship Monitor waits 42 months before it calls a business established.',
    stat: 'ST-05',
    statText: '42 months (3.5 years) before GEM counts a business as established.',
    picture: 'Two orbit rings settle around the world. More of the 100 lights on the outer ring have dimmed.',
    still: {
      alt: 'A hexagonal world with two settled orbit rings, inside a ring of small lights where many have dimmed.',
      caption: 'Year 3.5: established. GEM counts a business as established only after 42 months.',
    },
  },
  {
    id: 'moons',
    start: 33,
    end: 40,
    stage: 'growth',
    year: 5,
    when: 'Year 5',
    title: 'Growth years: moons condense',
    line: 'Half of new establishments are still open at five years.',
    stat: 'ST-02',
    statText: '51.4% of new U.S. establishments were still operating after five years.',
    picture: 'Three small moons condense from the leftover dust and take up orbits. About half of the 100 lights remain lit.',
    still: {
      alt: 'A hexagonal world with orbit rings and three small moons; about half of the surrounding ring of lights is still lit.',
      caption: 'Year 5, growth: about half of new establishments are still operating. The world gathers moons.',
    },
  },
  {
    id: 'steady',
    start: 40,
    end: 46,
    stage: 'growth',
    year: 9,
    when: 'Year 9',
    title: 'A steadier orbit',
    line: 'Survival gets easier with age: the years of patience start to pay.',
    stat: 'ST-34',
    statText: '94.4% of establishments still open after eight years survived their ninth, against 79.6% in their first.',
    picture: 'The world turns steadily; its rings and moons hold their paths. Very few further lights dim.',
    still: {
      alt: 'A steady hexagonal world with rings and moons holding their orbits; the outer lights change very little.',
      caption: 'Year 9: a steadier orbit. Of establishments open at eight years, 94.4% survive the ninth.',
    },
  },
  {
    id: 'system',
    start: 46,
    end: 52,
    stage: 'growth',
    year: 10,
    when: 'Year 10',
    title: 'A world in its system',
    line: 'About a third of new establishments reach their tenth year.',
    stat: 'ST-03',
    statText: '34.7% of new U.S. establishments were still operating after ten years.',
    picture: 'The camera eases back: the world sits in a small solar system of neighbors, one of them amber. About 35 lights remain.',
    still: {
      alt: 'A small solar system of hexagonal worlds, one amber, with a ring of small lights where about a third remain lit.',
      caption: 'Year 10: a world in its system. About a third of new establishments are still operating.',
    },
  },
  {
    id: 'close',
    start: 52,
    end: 57,
    stage: 'close',
    year: 10,
    when: '',
    title: 'WE build worlds.',
    line: 'Long-horizon business incubation and consulting, paced to the years a company really takes.',
    picture: 'The system rests on the night sky while the closing line fades in. The sources are listed at the bottom.',
  },
];

/** Survival shares the film draws on the ring of 100 lights, as printed by the register (ST-01, ST-02, ST-03). */
export const SURVIVAL_POINTS: readonly { readonly year: number; readonly percent: number; readonly stat: StatId }[] = [
  { year: 1, percent: 77.9, stat: 'ST-01' },
  { year: 5, percent: 51.4, stat: 'ST-02' },
  { year: 10, percent: 34.7, stat: 'ST-03' },
];

/**
 * Lights still lit on the ring of 100 at a point on the company's clock. Only the marked years (1, 5 and 10) are data; between them the
 * film fades lights linearly, which the transcript says.
 */
export function litAt(year: number): number {
  if (year <= 0) return 100;
  const points = [{ year: 0, percent: 100 }, ...SURVIVAL_POINTS];
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (a !== undefined && b !== undefined && year <= b.year) {
      const k = (year - a.year) / (b.year - a.year);
      return Math.round(a.percent + (b.percent - a.percent) * k);
    }
  }
  return Math.round(SURVIVAL_POINTS[SURVIVAL_POINTS.length - 1]?.percent ?? 100);
}

/** The register entry a chapter quotes. */
export function chapterStat(chapter: DecadeChapter): SalesStat | undefined {
  return chapter.stat === undefined ? undefined : stat(chapter.stat);
}

/** The sources of a chapter's figure. */
export function chapterSources(chapter: DecadeChapter): readonly SalesSource[] {
  return chapterStat(chapter)?.sources.map(salesSource) ?? [];
}

/** Every source the film cites, in first-use order, without repeats. */
export function decadeSources(): readonly SalesSource[] {
  const seen = new Map<string, SalesSource>();
  for (const chapter of DECADE_CHAPTERS) for (const source of chapterSources(chapter)) seen.set(source.id, source);
  return [...seen.values()];
}

/** The chapters that carry a figure (the milestones of the carousel and the stills of the gallery). */
export function decadeMilestones(): readonly DecadeChapter[] {
  return DECADE_CHAPTERS.filter((c) => c.stat !== undefined);
}

/** `mm:ss.mmm` or `hh:mm:ss.mmm` for WebVTT. */
export function vttTime(seconds: number): string {
  const ms = Math.round(seconds * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const rest = ms % 1000;
  const pad = (n: number, w = 2): string => String(n).padStart(w, '0');
  return `${h > 0 ? `${pad(h)}:` : ''}${pad(m)}:${pad(s)}.${pad(rest, 3)}`;
}

/** The text of one caption cue: the on-screen words, in reading order. The first cue says the film has no sound. */
export function cueText(chapter: DecadeChapter): string[] {
  const lines: string[] = [];
  if (chapter.id === 'title') lines.push('[No sound. The on-screen text follows.]');
  lines.push(chapter.when === '' ? chapter.title : `${chapter.when}. ${chapter.title}.`);
  if (chapter.statText !== undefined) lines.push(chapter.statText);
  else lines.push(chapter.line);
  return lines;
}

/**
 * The WebVTT captions of the film. Each chapter is split into two cues (headline, then figure or line) so a cue never holds more than
 * two short lines on screen.
 */
export function decadeVtt(): string {
  const out = ['WEBVTT', '', 'NOTE Captions for "A company\'s first decade, in one minute". Generated from src/components/media/decade.ts.', ''];
  for (const chapter of DECADE_CHAPTERS) {
    const [first, ...rest] = cueText(chapter);
    const mid = rest.length > 0 ? chapter.start + (chapter.end - chapter.start) * 0.4 : chapter.end;
    out.push(`${chapter.id}-a`, `${vttTime(chapter.start)} --> ${vttTime(mid)}`, first ?? '', '');
    if (rest.length > 0) out.push(`${chapter.id}-b`, `${vttTime(mid)} --> ${vttTime(chapter.end)}`, ...rest, '');
  }
  return `${out.join('\n')}`;
}

/** "0:57" for the content cue. */
export function durationLabel(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
}

/** ISO 8601 duration ("PT57S") for the `<time datetime>` of the content cue and VideoObject metadata. */
export function isoDuration(seconds: number): string {
  return `PT${Math.round(seconds)}S`;
}
