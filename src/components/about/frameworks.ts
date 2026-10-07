/** Framework summaries shared by the hub and the deep pages. Paraphrased from the WE framework documents (C-19). */
export interface FrameworkEntry {
  readonly name: string;
  readonly short: string;
  readonly path: string | null;
  readonly summary: string;
}

export const FRAMEWORKS: readonly FrameworkEntry[] = [
  { name: 'ANDROID Ops', short: 'How a team works', path: '/about/frameworks/android-ops/', summary: 'Seven focus areas, from Advance to Deliver, that a team returns to as the work demands.' },
  { name: 'ORBITAL', short: 'How a project is planned', path: '/about/frameworks/orbital/', summary: 'Seven components a plan has to answer: Objective, Resources, Budget, Indicators, Transport, Activities, Logistics.' },
  { name: 'UBF', short: 'How a business is mapped', path: null, summary: 'A way to describe industries, companies and projects through their relationships, with a five-stage lifecycle.' },
  { name: 'STAR', short: 'How a task is reported', path: null, summary: 'Space, Track, Assist and Reach: four lenses for a short, readable status report.' },
  { name: 'SHIFT', short: 'How attention is spent', path: null, summary: 'The Focus Shift, a four-hour block spent on one droid.' },
];

export interface FocusArea {
  readonly name: string;
  readonly asks: string;
}

export const ANDROID_AREAS: readonly FocusArea[] = [
  { name: 'Advance', asks: 'Keep the roadmap current and look ahead.' },
  { name: 'Network', asks: 'Connect people, tools and information.' },
  { name: 'Design', asks: 'Shape processes, experience and brand.' },
  { name: 'Research', asks: 'Find out before deciding.' },
  { name: 'Optimize', asks: 'Improve what already exists.' },
  { name: 'Implement', asks: 'Put the plan into practice.' },
  { name: 'Deliver', asks: 'Get value to the customer and keep it there.' },
];

export const ORBITAL_PARTS: readonly FocusArea[] = [
  { name: 'Objective', asks: 'State the goal or outcome.' },
  { name: 'Resources', asks: 'Name what the work needs.' },
  { name: 'Budget', asks: 'Set out the money and its timeline.' },
  { name: 'Indicators', asks: 'Decide how progress is judged.' },
  { name: 'Transport', asks: 'Plan how work and information move.' },
  { name: 'Activities', asks: 'List the tasks, milestones and deadlines.' },
  { name: 'Logistics', asks: 'Plan coordination, communication and risk.' },
];
