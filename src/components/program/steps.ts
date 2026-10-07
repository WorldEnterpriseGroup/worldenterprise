/** The five steps from application to a working team (SAGE-PLAN 7.1). No durations: claim C-16. */
export interface ProgramStep {
  readonly title: string;
  readonly body: string;
}

export const PROGRAM_STEPS: readonly ProgramStep[] = [
  {
    title: 'Apply',
    body: 'Tell WE about the idea, the founder and the stage you are at. The application is short and asks only what WE needs to judge fit.',
  },
  {
    title: 'Agree the scope',
    body: 'WE and the founder choose which service lines the company needs and what each one will and will not cover. The scope is written down in an agreement, so both companies work from the same page.',
  },
  {
    title: 'Seat your team',
    body: 'WE assembles dedicated offshore seats for the roles the scope calls for. The seats work only on your company. WE steers them and manages any subcontractors.',
  },
  {
    title: 'Work in focused cycles',
    body: 'The team works in short, reviewed cycles. Each cycle has a stated goal and a visible set of artifacts. WE uses its ANDROID Ops loop to decide what a cycle contains.',
  },
  {
    title: 'Review and decide',
    body: 'At each review you see what exists now, what changed and what is next. You decide what the next cycle holds, and you can scale seats up or down by notice as the agreement sets out.',
  },
] as const;
