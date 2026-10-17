/**
 * Which sourced figure each executive brief shows beside its cover and chapter map (WP-23, #89). Each pick matches the brief's question:
 * a funding brief shows approval by firm age, a timeline brief shows survival. The figures themselves live in research/media/data.ts.
 */
import type { FlowStep } from '../research/media/FlowDiagram.astro';

export type BriefFigure =
  | 'approval-by-age'
  | 'formation'
  | 'survival-information'
  | 'shutdowns-fit'
  | 'shutdowns-capital'
  | 'age-at-round'
  | 'hiring'
  | 'track-record'
  | 'founder-age'
  | 'industry-experience'
  | 'survival-all';

export const BRIEF_FIGURES: Readonly<Record<string, BriefFigure>> = {
  'funding-paths': 'approval-by-age',
  'company-setup': 'formation',
  'ai-native-build': 'survival-information',
  'first-100-customers': 'shutdowns-fit',
  'pre-seed-evidence-pack': 'age-at-round',
  'first-hires': 'hiring',
  'early-stage-diligence': 'track-record',
  'ai-company-diligence': 'shutdowns-capital',
  'partnering-with-founders': 'founder-age',
  'corporate-spinouts': 'industry-experience',
  'real-timeline': 'survival-all',
};

/** The figure for a brief; a brief added later without a pick falls back to the survival curve. */
export const briefFigure = (slug: string): BriefFigure => BRIEF_FIGURES[slug] ?? 'survival-all';

/** Briefs hub: how a brief reaches a reader (briefs hub copy and BRIEF_COPY). */
export const BRIEF_PATH: readonly FlowStep[] = [
  { label: 'Read the outline', text: 'Every brief has its own page with the sections in order.' },
  { label: 'Request it', text: 'On the brief’s page, with the address the text should go to.' },
  { label: 'Receive the text', text: 'WE sends the full brief by email.' },
  { label: 'Check the evidence', text: 'Each brief names its sources and says what it cannot tell you.' },
];
