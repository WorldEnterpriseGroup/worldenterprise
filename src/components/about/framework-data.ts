/**
 * The WE frameworks as data, for the frameworks galaxy (/about/frameworks/), the UBF page (/about/frameworks/ubf/) and the About story.
 *
 * Structures and names come from WE's own framework documents in the org profile repository (claim C-19, decision W9-5): definitions are
 * quoted or closely paraphrased, with no efficacy claims and none of the source marketing lines. Brand wording follows W9-11: the
 * growth phase is the "G.R.O.W.T.H. phase", S.M.A.R.T. expands to Specific, Measurable, Achievable, Relevant, Time-bound, and
 * A.N.D.R.O.I.D. uses "Implement". Every string here passes the site denylist (tests/unit/wp-55/frameworks.test.ts).
 */

export interface Part {
  /** The name the letter or component stands for. */
  readonly name: string;
  /** One short line: what it asks or means. */
  readonly line: string;
}

export interface FrameworkSystem {
  /** Stable id, used for anchors (`#fw-<id>`). */
  readonly id: string;
  /** Display name, dotted where the name is an acronym. */
  readonly name: string;
  /** What the framework is about, in a few words. */
  readonly role: string;
  /** One or two sentences, paraphrased from the source. */
  readonly summary: string;
  /** The letters, components or levels, in source order. */
  readonly parts: readonly Part[];
  /** The page that covers it in depth, when one is live. */
  readonly path: string | null;
  /** Where the source document defines it (repository-relative, for the sources ledger). */
  readonly source: string;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// UBF, the Universal Business Framework
// ---------------------------------------------------------------------------------------------------------------------------------

export interface UbfComponent extends Part {
  /** The source definition, quoted where the wording is short enough to quote. */
  readonly definition: string;
  /** How WE uses the idea with a founder. */
  readonly inPractice: string;
  /** The level of the map: industry, ecosystem, company or project. */
  readonly scale: 'Industry' | 'Ecosystem' | 'Company' | 'Project';
}

/** The ten UBF components, in source order (UBF.md, "Framework Overview"). */
export const UBF_COMPONENTS: readonly UbfComponent[] = [
  {
    name: 'Galaxy',
    line: 'An entire industry.',
    definition: '“An entire industry, defined by a NAICS Code”: the companies, organizations and stakeholders that offer similar products and compete for the same customers.',
    inPractice: 'WE maps the industry a company lives in before planning the work: who is there, how they connect and how the field is changing.',
    scale: 'Industry',
  },
  {
    name: 'Black Hole',
    line: 'The giant at the center.',
    definition: '“A large corporation at the center of a galaxy, exerting a powerful gravitational force” on subsidiaries, competitors and new ideas.',
    inPractice: 'A plan says how the company stays clear of the giants, or works with them, instead of pretending they are not there.',
    scale: 'Industry',
  },
  {
    name: 'Super Nova',
    line: 'An event that shifts the industry.',
    definition: '“A corporate cosmic-shifting event”: a major merger or acquisition, a regulatory change or a technological breakthrough.',
    inPractice: 'Reviews ask what has shifted in the industry since the last one and what that changes for the plan.',
    scale: 'Industry',
  },
  {
    name: 'Solar System',
    line: 'A holding company and its ecosystem.',
    definition: '“Holding companies within a galaxy, organized by their size, market share, and SIC Codes”, together with their suppliers, customers and competitors.',
    inPractice: 'WE looks at the ecosystem a company depends on: suppliers, partners, customers and the companies it sits beside.',
    scale: 'Ecosystem',
  },
  {
    name: 'Sun',
    line: 'The center of a system.',
    definition: '“The largest publicly visible companies within a Solar System or the headquarters of an organization”: the hub of activity and influence.',
    inPractice: 'In an engagement the company is the sun. The team, the plans and the reviews orbit it, and the founder keeps every decision.',
    scale: 'Ecosystem',
  },
  {
    name: 'Super Star',
    line: 'A flagship with room to grow.',
    definition: '“Flagship or role model companies that have the potential to become Suns.”',
    inPractice: 'The flagship product or line the company is built around, given the most attention as it grows.',
    scale: 'Company',
  },
  {
    name: 'Star',
    line: 'A small company or project.',
    definition: '“Small companies or projects defined by the S.M.A.R.T. S.T.A.R. framework.”',
    inPractice: 'Each piece of work is written to be Specific, Measurable, Achievable, Relevant and Time-bound, then reported through Space, Track, Assist and Reach.',
    scale: 'Company',
  },
  {
    name: 'Moon',
    line: 'A side project or department.',
    definition: '“Orbital, side projects, startups, subsidiaries, or departments”, each defined with the O.R.B.I.T.A.L. framework.',
    inPractice: 'A side project gets its own O.R.B.I.T.A.L. plan: objective, resources, budget, indicators, transport, activities and logistics.',
    scale: 'Project',
  },
  {
    name: 'Comet',
    line: 'An unstable project to re-plan.',
    definition: 'An unstable project “that requires better planning”.',
    inPractice: 'When a project drifts, the team says so in writing and re-plans it before it uses more of the company’s time.',
    scale: 'Project',
  },
  {
    name: 'Asteroid',
    line: 'An unstable project to avoid.',
    definition: 'An unstable project that “requires avoidance”: a risk to the company if it is taken on.',
    inPractice: 'Some work should not be started at all. WE says so, and the reason goes into the written record.',
    scale: 'Project',
  },
];

export interface LifecycleStep extends Part {
  readonly step: number;
  /** The WE stage the step belongs to. */
  readonly stage: 'Dream' | 'Build' | 'Grow';
  /** What the step looks like in the UBF picture. */
  readonly picture: string;
}

/** The five steps of "Launching and Scaling Droids" (UBF.md), mapped to WE's Dream, Build and Grow (BRIEF 2.2). */
export const UBF_LIFECYCLE: readonly LifecycleStep[] = [
  { step: 1, name: 'Ideation and conceptualization', line: 'Generate the idea, research the market and test whether it is feasible.', stage: 'Dream', picture: 'A star ignites.' },
  { step: 2, name: 'Planning and resource allocation', line: 'Write the plan: timeline, budget, people and the risks to manage.', stage: 'Dream', picture: 'O.R.B.I.T.A.L. rings are drawn around the launch pad.' },
  { step: 3, name: 'Execution and monitoring', line: 'Carry out the plan, watch the indicators and resolve issues as they come.', stage: 'Build', picture: 'Lift-off, tracked from Mission Control.' },
  { step: 4, name: 'Scaling and growth', line: 'Judge what worked, then widen the resources and the market.', stage: 'Grow', picture: 'Orbit insertion: a star grows into a super star.' },
  { step: 5, name: 'Integration and ecosystem management', line: 'Join the wider ecosystem and keep improving the relationships it runs on.', stage: 'Grow', picture: 'A world settles into its solar system, with its moons.' },
];

export interface EngagementStep {
  readonly title: string;
  readonly body: string;
  /** The UBF components the step works with, by name. */
  readonly uses: readonly string[];
}

/**
 * How WE applies UBF in an engagement (BRIEF 2.4, the UBF elements mapped to the site). A description of the method, not a promise of
 * any result (C-19).
 */
export const UBF_ENGAGEMENT: readonly EngagementStep[] = [
  {
    title: 'Map the galaxy',
    body: 'Before planning the work, WE maps the industry the company lives in: the giants at its center, the recent shifts and the ecosystem the company depends on.',
    uses: ['Galaxy', 'Black Hole', 'Super Nova', 'Solar System'],
  },
  {
    title: 'Put the company at the center',
    body: 'The company is the sun of its own system. The team WE steers, the plans and the reviews orbit it, and the founder keeps every decision.',
    uses: ['Sun'],
  },
  {
    title: 'Choose the flagship',
    body: 'One product or line carries the company first. It gets the most attention, and the plan says why it was chosen.',
    uses: ['Super Star'],
  },
  {
    title: 'Write every piece of work as a star',
    body: 'Each task is written to be Specific, Measurable, Achievable, Relevant and Time-bound, then reported through Space, Track, Assist and Reach.',
    uses: ['Star'],
  },
  {
    title: 'Plan each side project on its own orbit',
    body: 'A side project or a department gets its own O.R.B.I.T.A.L. plan, so it can grow without pulling the company off course.',
    uses: ['Moon'],
  },
  {
    title: 'Name the comets and the asteroids',
    body: 'Work that drifts is re-planned in writing. Work that should not start is declined, with the reason on the record.',
    uses: ['Comet', 'Asteroid'],
  },
  {
    title: 'Review the map at each checkpoint',
    body: 'At every review the map is redrawn: what shifted in the industry, where each body now sits and what the next stage needs.',
    uses: ['Galaxy', 'Sun', 'Star'],
  },
];

/** Agile's five planning levels beside UBF's ten (UBF_2.md). */
export const AGILE_LEVELS: readonly string[] = ['Initiative', 'Epic', 'User story', 'Feature', 'Task'];

/** How the components nest (profile README diagrams): the scene graph the planetarium follows. */
export const UBF_NESTING: readonly { readonly parent: string; readonly children: readonly string[] }[] = [
  { parent: 'Galaxy', children: ['Black Hole', 'Super Nova', 'Solar System'] },
  { parent: 'Solar System', children: ['Sun'] },
  { parent: 'Sun', children: ['Super Star', 'Star', 'Comet', 'Asteroid'] },
  { parent: 'Super Star', children: ['Moon'] },
];

/** The ladder of scale WE uses in its story: droid, world, solar system, galaxy (UBF.md introduction). */
export const SCALE_LADDER: readonly Part[] = [
  { name: 'Droid', line: 'A project, launched with one purpose.' },
  { name: 'World', line: 'A company the project grows into.' },
  { name: 'Solar system', line: 'A group of companies around a center.' },
  { name: 'Galaxy', line: 'An industry those groups shape.' },
];

// ---------------------------------------------------------------------------------------------------------------------------------
// The other frameworks, as systems in the galaxy
// ---------------------------------------------------------------------------------------------------------------------------------

export const SMART: readonly Part[] = [
  { name: 'Specific', line: 'Says exactly what is done.' },
  { name: 'Measurable', line: 'Says how done is judged.' },
  { name: 'Achievable', line: 'Fits the people and time.' },
  { name: 'Relevant', line: 'Serves the objective.' },
  { name: 'Time-bound', line: 'Has a date.' },
];

export const STAR_PARTS: readonly Part[] = [
  { name: 'Space', line: 'Where the task sits and what it depends on.' },
  { name: 'Track', line: 'Where it has been and where it goes next.' },
  { name: 'Assist', line: 'What is being done today to move it.' },
  { name: 'Reach', line: 'What the finished task should change.' },
];

export const ORBITAL_PARTS: readonly Part[] = [
  { name: 'Objective', line: 'State the goal or outcome.' },
  { name: 'Resources', line: 'Name what the work needs.' },
  { name: 'Budget', line: 'Set out the money and its timeline.' },
  { name: 'Indicators', line: 'Decide how progress is judged.' },
  { name: 'Transport', line: 'Plan how work and information move.' },
  { name: 'Activities', line: 'List the tasks, milestones and deadlines.' },
  { name: 'Logistics', line: 'Plan coordination, communication and risk.' },
];

export const ANDROID_PARTS: readonly Part[] = [
  { name: 'Advance', line: 'Keep the roadmap current and look ahead.' },
  { name: 'Network', line: 'Connect people, tools and information.' },
  { name: 'Design', line: 'Shape processes, experience and brand.' },
  { name: 'Research', line: 'Find out before deciding.' },
  { name: 'Optimize', line: 'Improve what already exists.' },
  { name: 'Implement', line: 'Put the plan into practice.' },
  { name: 'Deliver', line: 'Get value to the customer and keep it there.' },
];

export const DROID_PARTS: readonly Part[] = [
  { name: 'Design', line: 'Shape the piece of work.' },
  { name: 'Research', line: 'Check it against evidence.' },
  { name: 'Optimize', line: 'Make it better.' },
  { name: 'Integrate', line: 'Fit it into what exists.' },
  { name: 'Deliver', line: 'Hand it over, working.' },
];

export const DREAM_PARTS: readonly Part[] = [
  { name: 'Discover', line: 'Find the problem worth solving.' },
  { name: 'Relate', line: 'Understand the people who have it.' },
  { name: 'Empower', line: 'Give the founder what the next step needs.' },
  { name: 'Advise', line: 'Weigh the options in writing.' },
  { name: 'Motivate', line: 'Set a pace the founder can keep.' },
];

export const STARTUP_PARTS: readonly Part[] = [
  { name: 'Structure', line: 'The company and its records.' },
  { name: 'Think Tank', line: 'The ideas, tested.' },
  { name: 'Analysis', line: 'The market and the numbers.' },
  { name: 'Relations', line: 'Customers, partners and suppliers.' },
  { name: 'UX/UI', line: 'The experience of the product.' },
  { name: 'Publications', line: 'What the company says in public.' },
];

export const LAUNCH_PARTS: readonly Part[] = [
  { name: 'Logistics', line: 'Everything in place for go-live.' },
  { name: 'Application', line: 'The product, working.' },
  { name: 'Users', line: 'The first people using it.' },
  { name: 'Navigation', line: 'The path a user takes.' },
  { name: 'Channel', line: 'How the product reaches people.' },
  { name: 'Hive', line: 'The team and community around it.' },
];

export const GROWTH_PARTS: readonly Part[] = [
  { name: 'Gauge', line: 'Measure where the company is.' },
  { name: 'Research', line: 'Learn what moves the numbers.' },
  { name: 'Organize', line: 'Shape the team for the next size.' },
  { name: 'Work', line: 'Do the work the plan names.' },
  { name: 'Target', line: 'Choose the next market.' },
  { name: 'Health', line: 'Keep the company sound as it grows.' },
];

/** The eight SuperNova phases in source order (supernova.md); the growth phase name follows W9-11. */
export const SUPERNOVA_PHASES: readonly Part[] = [
  { name: 'D.R.E.A.M. Playbook', line: 'Discover and frame the opportunity.' },
  { name: 'O.R.B.I.T.A.L. Plan', line: 'Write the plan.' },
  { name: 'S.T.A.R.T.U.P. Initiative', line: 'Lay the foundations.' },
  { name: 'A.N.D.R.O.I.D. Ops', line: 'Run the work.' },
  { name: 'L.A.U.N.C.H. Sequence', line: 'Go live.' },
  { name: 'G.R.O.W.T.H. phase', line: 'Grow with care.' },
  { name: 'Mission Control', line: 'Steer, review and report.' },
  { name: 'Event Horizon', line: 'The company finds its place in the market.' },
];

export const FOCUS_SHIFT_PARTS: readonly Part[] = [
  { name: 'Fit', line: 'Does the plan serve the droid’s objectives?' },
  { name: 'Clarity', line: 'Is it clear what will be done?' },
  { name: 'Feasibility', line: 'Can it be done in four hours?' },
  { name: 'Difference', line: 'What could it change?' },
];

export const CONSULTING_LEVELS: readonly Part[] = [
  { name: 'DreamVerse', line: 'The whole universe of possibilities.' },
  { name: 'Galaxy Consulting', line: 'An industry, seen whole.' },
  { name: 'World Consulting', line: 'One company and its plan.' },
  { name: 'ANDROID Consulting', line: 'The work on the ground.' },
  { name: 'Ignite Curiosity', line: 'Learning, where every idea starts.' },
];

const SRC = 'WorldEnterpriseGroup/.github';

/**
 * Every framework as a system in the galaxy, in the order the hub tells them: the map (UBF), the journey (SuperNova and its phases),
 * the plans and reports, the way a team works, and the altitudes of the consulting.
 */
export const FRAMEWORK_SYSTEMS: readonly FrameworkSystem[] = [
  {
    id: 'ubf',
    name: 'UBF',
    role: 'The map of the business universe',
    summary: 'The Universal Business Framework describes industries, companies and projects through their relationships, in ten components from Galaxy to Asteroid, with a five-step lifecycle for launching and scaling droids.',
    parts: UBF_COMPONENTS.map(({ name, line }) => ({ name, line })),
    path: '/about/frameworks/ubf/',
    source: `${SRC}: Frameworks/UBF.md`,
  },
  {
    id: 'supernova',
    name: 'SuperNova',
    role: 'The journey, phase by phase',
    summary: 'The SuperNova Strategy strings eight phases together, from the D.R.E.A.M. Playbook to Event Horizon. WE’s Dream, Build and Grow stages follow the same path.',
    parts: SUPERNOVA_PHASES,
    path: null,
    source: `${SRC}: supernova.md`,
  },
  {
    id: 'dream',
    name: 'D.R.E.A.M.',
    role: 'How an idea is framed',
    summary: 'The playbook that opens the journey: Discover, Relate, Empower, Advise, Motivate.',
    parts: DREAM_PARTS,
    path: '/program/dream/',
    source: `${SRC}: supernova.md`,
  },
  {
    id: 'startup',
    name: 'S.T.A.R.T.U.P.',
    role: 'How the foundations are laid',
    summary: 'Six foundations a company is built on: Structure, Think Tank, Analysis, Relations, UX/UI, Publications.',
    parts: STARTUP_PARTS,
    path: '/program/build/',
    source: `${SRC}: supernova.md`,
  },
  {
    id: 'launch',
    name: 'L.A.U.N.C.H.',
    role: 'How a product goes live',
    summary: 'The sequence that takes a droid live: Logistics, Application, Users, Navigation, Channel, Hive.',
    parts: LAUNCH_PARTS,
    path: '/program/build/',
    source: `${SRC}: supernova.md`,
  },
  {
    id: 'growth',
    name: 'G.R.O.W.T.H. phase',
    role: 'How a company grows with care',
    summary: 'Six gauges for the growing years: Gauge, Research, Organize, Work, Target, Health.',
    parts: GROWTH_PARTS,
    path: '/program/grow/',
    source: `${SRC}: supernova.md`,
  },
  {
    id: 'orbital',
    name: 'O.R.B.I.T.A.L.',
    role: 'How a project is planned',
    summary: 'Seven questions every plan answers, from Objective to Logistics. In UBF terms, it is the orbit a moon runs on.',
    parts: ORBITAL_PARTS,
    path: '/about/frameworks/orbital/',
    source: `${SRC}: Frameworks/ORBITAL.md`,
  },
  {
    id: 'star',
    name: 'S.T.A.R.',
    role: 'How a task is reported',
    summary: 'A task is first written to be S.M.A.R.T.: Specific, Measurable, Achievable, Relevant, Time-bound. Then it is reported through Space, Track, Assist and Reach.',
    parts: STAR_PARTS,
    path: null,
    source: `${SRC}: Frameworks/STAR.md`,
  },
  {
    id: 'android',
    name: 'A.N.D.R.O.I.D.',
    role: 'How a team works',
    summary: 'Seven focus areas a team returns to as the work demands: Advance, Network, Design, Research, Optimize, Implement, Deliver.',
    parts: ANDROID_PARTS,
    path: '/about/frameworks/android-ops/',
    source: `${SRC}: Frameworks/ANDROID Ops.md`,
  },
  {
    id: 'droid',
    name: 'D.R.O.I.D.',
    role: 'How one piece of work is done',
    summary: 'The short loop for a single piece of work: Design, Research, Optimize, Integrate, Deliver.',
    parts: DROID_PARTS,
    path: null,
    source: `${SRC}: Frameworks/Short/DROID.md`,
  },
  {
    id: 'shift',
    name: 'Focus Shift',
    role: 'How attention is spent',
    summary: 'A dedicated four-hour block spent on one droid, to enhance or realign its trajectory. A plan for a shift is read against four questions.',
    parts: FOCUS_SHIFT_PARTS,
    path: null,
    source: `${SRC}: Frameworks/SHIFT.md`,
  },
  {
    id: 'levels',
    name: 'Consulting Levels',
    role: 'The altitude of the advice',
    summary: 'Five altitudes, from the whole universe of possibilities down to the classroom, so everyone knows how far out or how close in a conversation is.',
    parts: CONSULTING_LEVELS,
    path: null,
    source: `${SRC}: Frameworks/More Info/Consulting Levels.md`,
  },
];

/** Looks a framework up by id; throws so a typo fails the build instead of rendering an empty section. */
export function frameworkById(id: string): FrameworkSystem {
  const found = FRAMEWORK_SYSTEMS.find((f) => f.id === id);
  if (found === undefined) throw new Error(`Unknown framework id "${id}"; expected one of ${FRAMEWORK_SYSTEMS.map((f) => f.id).join(', ')}.`);
  return found;
}

/** The in-page anchor of a UBF component's legend card: "Super Star" becomes "ubf-super-star". */
export function ubfAnchor(name: string): string {
  return `ubf-${name.toLowerCase().replace(/\s+/g, '-')}`;
}

/** The longest initials a system's sun can carry: the seven letters of S.T.A.R.T.U.P., O.R.B.I.T.A.L. and A.N.D.R.O.I.D. */
export const INITIALS_MAX = 7;

/** The initials a system shows on its sun: "UBF", "DREAM", "SN", "FS". */
export function initials(name: string): string {
  const dotted = name.replace(/ phase$/, '');
  if (/^[A-Z](\.[A-Z])+\.?$/.test(dotted)) return dotted.replace(/\./g, '');
  const words = dotted.split(/\s+/);
  if (words.length === 1) {
    if (dotted.length <= 4) return dotted;
    const capitals = dotted.replace(/[^A-Z]/g, '');
    return capitals.length >= 2 ? capitals : dotted.slice(0, 2);
  }
  return words.map((w) => w[0] ?? '').join('').toUpperCase();
}
