/**
 * The journey hub's two media moments (WP-24), drawn from the program's own five steps (src/components/program/steps.ts). The journey
 * pages state no duration and make no promise (C-16, tests/e2e/wave8/wp-72/journey.spec.ts), so these moments carry no figure, no time
 * and no external statistic: they show the order of the steps, which of them repeat, and what the founder holds after each one, in
 * words taken from the step bodies. Pure data, no Astro imports.
 */
import { PROGRAM_STEPS } from '../program/steps.ts';
import type { ProgramIcon } from '../visuals/icons.ts';

/** The way in happens once, in order; the cycle is the working rhythm that repeats. */
export type JourneyPhase = 'way-in' | 'cycle';

export const PHASE_LABELS: Readonly<Record<JourneyPhase, string>> = {
  'way-in': 'The way in',
  cycle: 'The cycle',
};

export interface JourneyHold {
  /** The step's title, exactly as PROGRAM_STEPS has it. */
  readonly step: string;
  readonly phase: JourneyPhase;
  readonly icon: ProgramIcon;
  /** What the founder holds when the step is done, from the step's own body. */
  readonly holds: string;
}

const HOLDS: readonly JourneyHold[] = [
  { step: 'Apply', phase: 'way-in', icon: 'document', holds: 'A one-page read of where the company sits on the business clock.' },
  {
    step: 'Agree the scope',
    phase: 'way-in',
    icon: 'checklist',
    holds: 'An NDA, draft agreements and an order form with every term written down, to review with your own counsel.',
  },
  { step: 'Assemble your team', phase: 'way-in', icon: 'team', holds: 'A team recruited for the roles the plan calls for, working only on your company.' },
  { step: 'Work in focused cycles', phase: 'cycle', icon: 'steering', holds: 'A stated goal and a visible set of artifacts for each cycle.' },
  {
    step: 'Review and decide',
    phase: 'cycle',
    icon: 'report',
    holds: 'A written status, service reports and business reviews, and your decision on what the next cycle holds.',
  },
];

/**
 * The holds, checked against the program: one per step, in the program's order, with the program's titles. A renamed or reordered
 * step fails the build here instead of drawing a journey the program does not have.
 */
export function journeyHolds(): readonly JourneyHold[] {
  if (HOLDS.length !== PROGRAM_STEPS.length) {
    throw new Error(`journey: ${HOLDS.length} holds for ${PROGRAM_STEPS.length} program steps`);
  }
  HOLDS.forEach((hold, i) => {
    const title = PROGRAM_STEPS[i]?.title;
    if (hold.step !== title) throw new Error(`journey: hold ${i + 1} is "${hold.step}", the program step is "${title ?? 'missing'}"`);
  });
  const cycleStart = HOLDS.findIndex((h) => h.phase === 'cycle');
  if (cycleStart <= 0 || HOLDS.slice(cycleStart).some((h) => h.phase !== 'cycle')) {
    throw new Error('journey: the way in must come first and the cycle must close the list');
  }
  return HOLDS;
}
