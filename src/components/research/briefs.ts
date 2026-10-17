import type { SlotId } from '../../assets/photo/slots.ts';

/** How a brief is grounded. Shown on every brief so a reader knows what kind of document it is. */
export type BriefKind = 'source-based' | 'analysis' | 'definitions';

export interface BriefMeta {
  readonly kind: BriefKind;
  readonly slot: SlotId;
  /** One-line label for the kind, shown in the fact strip and on hub cards. */
  readonly kindLabel: string;
  /** Plain statement of what the reader is and is not getting. */
  readonly notice: string;
  readonly noticeTitle: string;
}

export const BRIEF_META: Readonly<Record<string, BriefMeta>> = {
  'saas-security-baseline-year-one': {
    kind: 'source-based',
    slot: 'research-1',
    kindLabel: 'Source-based, with analysis',
    noticeTitle: 'Reading guide, not an audit',
    notice:
      'This brief reports what three public documents state and then gives labelled analysis on sequencing. It is not an audit or an attestation, and it describes no control operated at any company.',
  },
  'accessibility-as-a-launch-requirement': {
    kind: 'source-based',
    slot: 'research-2',
    kindLabel: 'Source-based, with analysis',
    noticeTitle: 'Not legal advice. Verify the current rule.',
    notice:
      'Rule dates for the DOJ Title II web rule rest on the DOJ page and secondary summaries; the Federal Register text was not read. Check the current rule before relying on any date.',
  },
  'dedicated-team-agency-or-freelancers': {
    kind: 'analysis',
    slot: 'research-3',
    kindLabel: 'Analysis, no statistics',
    noticeTitle: 'Analysis, with a disclosed interest',
    notice:
      'This is reasoning from criteria, not a study. WE steers dedicated teams, one of the three models compared, so test the criteria yourself.',
  },
  'early-stage-saas-metrics-definitions': {
    kind: 'definitions',
    slot: 'research-4',
    kindLabel: 'Definitions and formulas',
    noticeTitle: 'Formulas, not benchmarks',
    notice:
      'Every number in this brief is a formula or a symbol. No typical values, targets or benchmarks are published.',
  },
};

export function briefMeta(slug: string): BriefMeta {
  const meta = BRIEF_META[slug];
  if (meta === undefined) {
    throw new Error(`No research brief metadata for slug "${slug}". Add it to src/components/research/briefs.ts.`);
  }
  return meta;
}

const WORDS_PER_MINUTE = 220;

/** Whole minutes to read `body`, never below one. Counts words in the raw markdown body. */
export function readingMinutes(body: string | undefined): number {
  const words = (body ?? '').split(/\s+/).filter((w) => w.length > 0).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
