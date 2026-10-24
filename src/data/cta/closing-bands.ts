import { ARTICLE_DESKS } from './families.ts';

/**
 * The surfaces of `FAMILY_SURFACES` that close with a band of their own instead of the end band of the CTA system. Wave 9 and the older
 * hand-placed pages fill the layout's `after` or `cta-end` slot themselves, which takes the place of the default band. The surface matrix
 * (tests/e2e/wave8/wp-62/surface-matrix.spec.ts) holds each row listed here to exactly that band and no `data-cta="end"` element, and holds
 * every other row with a band to exactly one `data-cta="end"` element and none of these bands. A row leaves this list when its page moves
 * to the CTA system, and `tests/unit/wp-62/cta-families.test.ts` fails on an id that is not a row of the table.
 */
export interface ClosingBand {
  /** The CSS selector of the band the page closes with. It must match exactly one element. */
  readonly selector: string;
  /** Who put it there, for the report. */
  readonly source: string;
}

const LADDER: ClosingBand = { selector: '[data-cta-ladder]', source: 'the sales ladder of the reading templates (WP-56, SALES.md 6)' };
const OLD_BAND: ClosingBand = { selector: 'section.ctaband', source: 'the hand-placed CtaBand or SafeCtaBand of the page' };

export const CLOSING_BANDS: Readonly<Record<string, ClosingBand>> = {
  home: { selector: 'section[aria-labelledby="home-end-title"]', source: 'the wave 9 home closing band (W9-13, pinned by tests/unit/wp-44/home.test.ts)' },
  program: { selector: 'section.program-end', source: 'the program closing band (WP-53, ProgramEnd)' },
  'program:how-we-decide': OLD_BAND,
  services: OLD_BAND,
  about: OLD_BAND,
  'about:trust': OLD_BAND,
  'about:press': OLD_BAND,
  'network:operators': OLD_BAND,
  'tools:hub': OLD_BAND,
  'tools:team-composer': OLD_BAND,
  'tools:page': OLD_BAND,
  'hubs:playbooks': OLD_BAND,
  'briefs:hub': LADDER,
  'hubs:insights': LADDER,
  'hubs:library': LADDER,
  'hubs:research': LADDER,
  playbooks: LADDER,
  guides: LADDER,
  library: LADDER,
  research: LADDER,
  'industries:fintech': LADDER,
  'compare:pair': LADDER,
  'journey:after-you-apply': LADDER,
  'journey:first-months': LADDER,
  'journey:onboarding-checklist': LADDER,
  ...Object.fromEntries(ARTICLE_DESKS.map((desk) => [`articles:${desk}`, LADDER])),
};
