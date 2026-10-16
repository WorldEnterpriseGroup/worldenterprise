import type { AudienceId, CategoryId, StageId } from './types.ts';

/**
 * All the page copy of /ecosystem/ as constants, so a unit test can scan every word against the claims rules (wave 10 ecosystem
 * context, D-W10-1). Voice: generous, specific, never disparaging. WE writes about outside programs and never describes itself as one.
 */

export const HUB_PATH = '/ecosystem/';
export const HUB_TITLE = 'Join the ecosystem.';
export const HUB_SEO_TITLE = 'Join the ecosystem: programs to join';
export const HUB_DESCRIPTION =
  'A directory of accelerators, incubators, university programs, coworking, angel groups, SBA partners, public funding and founder communities. Join them.';
export const HUB_LEAD =
  'Accelerators, incubators, universities, coworking spaces, angel groups, public advisers and founder communities already do great work. Join them. WE works alongside, for the long run.';
export const TAGLINE = 'Join them. WE works alongside, for the long run.';
export const DISCLAIMER = 'Independent programs; no affiliation implied unless stated.';
export const DISCLAIMER_LONG =
  'Every program here is independent. WE lists it because founders may want to consider it. No affiliation, partnership or endorsement is implied, and none is stated for any entry.';
export const SOURCE_NOTE = 'Each entry was checked against the program’s own page in October 2026. Programs change; confirm details with the program before you apply.';
export const INTRO =
  'A company takes years, and no single program covers all of them. The people who last use many: a batch in year one, a community around them, a lender or a public adviser when the time comes, a research partner, an investor group. This page lists the ones WE could verify, so you can join the ones that fit.';

export const CONSTELLATION_TITLE = 'Eight kinds of program in orbit around one founder';
export const CONSTELLATION_HEADING = 'A founder at the center, eight kinds of program in orbit';
export const CONSTELLATION_TEXT =
  'No program is the whole answer. Each one suits a stretch of the journey, a kind of company or a kind of founder. Pick the ones that fit this year, and expect the mix to change.';

export const CHOOSE_HEADING = 'How to choose';
export const CHOOSE_LEAD = 'Start with what you need now. Each line below leads to the kind of program that most often fits.';
export interface ChooseRow {
  readonly need: string;
  readonly category: CategoryId;
  readonly why: string;
}
export const CHOOSE_ROWS: readonly ChooseRow[] = [
  { need: 'I have an idea and want peers and a deadline.', category: 'launch-programs', why: 'A batch gives a rhythm, a group of peers and a closing showcase.' },
  { need: 'I need a lab, a shop or a real place to build.', category: 'incubators', why: 'Incubators hold facilities and a community while the company forms.' },
  { need: 'I am a student, researcher or alumnus with technology.', category: 'university', why: 'University programs turn research into customers, often through the school.' },
  { need: 'I want to work around other builders.', category: 'coworking', why: 'A shared space and weekly gatherings cost little and open many doors.' },
  { need: 'I have a product and early traction, and want investors.', category: 'angels', why: 'Angel groups put many individual investors in one room.' },
  { need: 'I want practical advice close to home.', category: 'sba', why: 'SBA partners advise on plans, finance, certification and contracting.' },
  { need: 'I do research, make physical goods or need a loan.', category: 'government', why: 'Public awards, manufacturing help and community lenders fund work on understood terms.' },
  { need: 'I want peers who share my background.', category: 'communities', why: 'Programs for women, veterans, immigrants, Latino and multicultural, and rural founders.' },
];

export const DIRECTORY_HEADING = 'The directory';
export const DIRECTORY_LEAD =
  'Every entry names what the program offers, who it is for, where it is, how it runs, and the page we checked. Filter below, or jump to a category.';

export const FILTER_LEGEND = 'Filter the directory';
export const FILTER_STATUS_ALL = (n: number): string => `Showing all ${n} programs.`;
export const FILTER_STATUS = (shown: number, total: number): string => `Showing ${shown} of ${total} programs.`;
export const FILTER_NONE = 'No program matches those choices. Clear a filter to see more.';

export const STAGE_LABELS: Readonly<Record<StageId, string>> = {
  idea: 'Idea',
  build: 'Building',
  launch: 'Launching',
  grow: 'Growing',
  scale: 'Scaling',
};
export const AUDIENCE_LABELS: Readonly<Record<AudienceId, string>> = {
  any: 'Open to all founders',
  women: 'Women',
  veterans: 'Veterans and military families',
  immigrants: 'Immigrant founders',
  latino: 'Latino founders',
  underserved: 'Under-resourced founders',
  rural: 'Rural founders',
  university: 'Students and alumni',
  researchers: 'Researchers and scientists',
};
export const DELIVERY_LABELS = {
  online: 'Online',
  hybrid: 'In person and online',
  'in-person': 'In person',
  varies: 'Varies by location',
} as const;

export const TIMELINE_HEADING = 'Programs across the years of a company';
export const TIMELINE_TEXT =
  'Companies that last rarely finish with one program. The bars show when each kind of program often fits. WE works alongside the whole way, as the long-running thread, for as long as the work is useful.';
export const TIMELINE_NOTE = 'Illustrative, not a schedule. Every company follows its own path.';
export const TIMELINE_THREAD = 'WE, alongside for the long run';
export const TIMELINE_YEARS: readonly { readonly year: number; readonly label: string }[] = [
  { year: 0, label: 'Year 0' },
  { year: 2, label: 'Year 2' },
  { year: 4, label: 'Year 4' },
  { year: 6, label: 'Year 6' },
  { year: 8, label: 'Year 8' },
  { year: 10, label: 'Year 10' },
];
export const TIMELINE_TABLE_CAPTION = 'The same timeline as a table';

export const STATS_HEADING = 'The directory in numbers';
export const STATS_NOTE = 'Counted from the entries below. One program can fit more than one stage or group.';

export const FAQ: readonly { readonly question: string; readonly answer: string }[] = [
  {
    question: 'Does WE run a program like these?',
    answer:
      'No. WE sits outside this list. WE builds software-enabled companies with founders through a dedicated, fully remote team, and works alongside the programs a founder joins.',
  },
  {
    question: 'Do I have to choose between WE and an accelerator?',
    answer:
      'No. Many founders join a program and work with WE at the same time or later. The two answer different needs: a program gives peers, structure and an audience, and WE gives a team that stays for the long run.',
  },
  {
    question: 'Is any of these programs endorsed by WE?',
    answer: 'No. Every program is independent and no affiliation is implied unless an entry says so. None does.',
  },
  {
    question: 'How were the entries chosen?',
    answer:
      'WE read each program’s own page in October 2026 and kept the ones that exist and are active. Programs that could not be verified, or that were not taking applications, are left out and may be added later.',
  },
  {
    question: 'What does a program take in return?',
    answer:
      'It varies, and some programs take nothing. Where a program states its terms publicly, the entry says so. Always ask for the terms in writing before you apply, and read them with your own adviser.',
  },
  {
    question: 'Which program should I join first?',
    answer:
      'The one that answers what you need this year. Use the decision guide above, then talk to the founders who completed the program last year.',
  },
  {
    question: 'A program I know is missing. Can it be added?',
    answer: 'Yes. Tell WE through the contact page with the program’s own link, and WE will check it the same way.',
  },
];

export const UNDER_REVIEW_HEADING = 'Still under review';
export const UNDER_REVIEW_TEXT =
  'Some kinds of program do not yet have an entry because WE could not confirm a current, active page: programs for founders over 50, state economic development offices, and several programs for Black founders. WE adds them as each is verified.';

export const CTA_HEADING = 'Join them. Then build for the long run.';
export const CTA_TEXT =
  'Tell WE where your company is. A readiness review says plainly whether the work fits, and which of these programs would help most right now.';

export const EXTERNAL_MARK = 'external site';
export const OPENS_NOTE = 'Opens the program’s own site.';

export const CATEGORY_NEXT_HEADING = 'Other kinds of program';
export const ASK_FIRST_HEADING = 'Ask before you join';
export const BEST_FOR_LABEL = 'Often a fit for';
export const SBIR_NOTE = 'WE’s guide to SBIR and STTR is at';
