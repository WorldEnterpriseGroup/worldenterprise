/**
 * The five steps from the first conversation to the rhythm of the work (SAGE-PLAN 7.1). The journey family uses the titles as its
 * page headings (tests/unit/wp-72/journey.test.ts), so the titles stay; the bodies follow the long-horizon engagement (SITE-COPY 2.7,
 * W9-12): no durations (C-16), no prices and no seat counts.
 */
export interface ProgramStep {
  readonly title: string;
  readonly body: string;
}

export const PROGRAM_STEPS: readonly ProgramStep[] = [
  {
    title: 'Apply',
    body: 'Start a readiness review: tell WE where the company stands. The application is short and asks only what WE needs to judge fit. WE then sends a one-page read of where the company sits on the business clock.',
  },
  {
    title: 'Agree the scope',
    body: 'WE and the founder choose which service lines the company needs and what each one will and will not cover. An NDA comes first, then draft agreements and an order form with every term written down, which you review with your own counsel.',
  },
  {
    title: 'Seat your team',
    body: 'WE recruits the team for the roles the plan calls for. The team works only on your company. WE steers it, manages any subcontractors and answers for how it is run.',
  },
  {
    title: 'Work in focused cycles',
    body: 'The team works in short, reviewed cycles. Each cycle has a stated goal and a visible set of artifacts. WE uses its A.N.D.R.O.I.D. Ops loop to decide what a cycle contains.',
  },
  {
    title: 'Review and decide',
    body: 'Every week a written status, every month a service report, every quarter a business review, and an Orbit Review at each phase checkpoint. You decide what the next cycle holds, and roles change by notice as the agreement sets out.',
  },
] as const;
