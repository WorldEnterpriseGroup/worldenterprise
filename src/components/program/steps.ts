/**
 * The five steps from the first conversation to the rhythm of the work (SITE-COPY 2.7, SAGE-PLAN 7.1). No durations (claim C-16), no
 * prices and no seat counts (W9-12).
 */
export interface ProgramStep {
  readonly title: string;
  readonly body: string;
}

export const PROGRAM_STEPS: readonly ProgramStep[] = [
  {
    title: 'Start a readiness review',
    body: 'Tell WE where the company stands. WE arranges a conversation, then sends a one-page read of where the company sits on the business clock and what the next phase needs.',
  },
  {
    title: 'Agree the terms',
    body: 'An NDA first, then draft agreements and an order form with every term written down. You review them with your own counsel before anything is signed.',
  },
  {
    title: 'Day One',
    body: 'Accounts, access, introductions, a working agreement and a first deliverable. WE recruits the team for the roles the plan calls for, steers it and manages any subcontractors.',
  },
  {
    title: 'Work in reviewed cycles',
    body: 'The team works in short cycles, each with a stated goal and a visible set of artifacts. WE uses its A.N.D.R.O.I.D. Ops loop to decide what a cycle contains.',
  },
  {
    title: 'Review and decide',
    body: 'Every week a written status, every month a service report, every quarter a business review, and an Orbit Review at each phase checkpoint. You decide what comes next, and the team changes by notice as the agreement sets out.',
  },
] as const;
