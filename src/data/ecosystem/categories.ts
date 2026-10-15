import type { CategoryId, CategoryInfo } from './types.ts';

/** The eight kinds of program. `window` is an illustrative span in years of a company's life (0 = first idea), used by the timeline only. */
export const CATEGORIES: readonly CategoryInfo[] = [
  {
    id: 'accelerators',
    name: 'Accelerators and cohort programs',
    short: 'Accelerators',
    what: 'Time-boxed programs that take a group of companies through a batch of mentoring, peers and a closing showcase.',
    bestFor: 'Founders with a first product or a strong team who want speed, peers and an investor audience.',
    askFirst: [
      'What does the program take in return, and is that written down before you apply?',
      'How many hours a week does the batch really need?',
      'What do alumni say a year after the batch ended?',
    ],
    window: { from: 0.5, to: 2 },
  },
  {
    id: 'incubators',
    name: 'Incubators',
    short: 'Incubators',
    what: 'Places and programs that give an early company space, equipment, advice and a community while it forms.',
    bestFor: 'Teams that need a lab, a shop, a campus or a steady community more than a short sprint.',
    askFirst: [
      'Is membership open-ended or does it end on a date?',
      'Which shared equipment and advisors are included in the membership?',
      'Who are the other members you would work beside?',
    ],
    window: { from: 0, to: 3 },
  },
  {
    id: 'university',
    name: 'University and research programs',
    short: 'University',
    what: 'Programs run by universities and research funders to move ideas out of the lab and into the market.',
    bestFor: 'Students, faculty, alumni and researchers with technology that needs customers and a commercial path.',
    askFirst: [
      'Do you need a current tie to the school to join?',
      'Who owns the intellectual property made during the program?',
      'Does the program connect you to customers or only to coursework?',
    ],
    window: { from: 0, to: 2 },
  },
  {
    id: 'coworking',
    name: 'Coworking and community spaces',
    short: 'Coworking',
    what: 'Shared workplaces and regular gatherings where founders meet each other and the wider local scene.',
    bestFor: 'Anyone who works better around other builders, from the first week to the first hire.',
    askFirst: [
      'Can the space grow with a team, or will you have to move?',
      'Which events are open to members and which to the public?',
      'Is there a month-to-month option?',
    ],
    window: { from: 0, to: 6 },
  },
  {
    id: 'angels',
    name: 'Angel groups and investor-relations programs',
    short: 'Angels and investors',
    what: 'Groups of individual investors, and programs that organize pitches, forums and demo days where founders meet them.',
    bestFor: 'Companies with a working product and early traction that are ready to raise from many small investors.',
    askFirst: [
      'Does the group charge to present, and how does it decide?',
      'Which stages and sectors do its members back?',
      'How does the group support companies after the first check?',
    ],
    window: { from: 1.5, to: 5 },
  },
  {
    id: 'sba',
    name: 'SBA resource partners',
    short: 'SBA partners',
    what: 'Local advising and training networks supported by the U.S. Small Business Administration and other federal agencies.',
    bestFor: 'Owners at any stage who want practical advice close to home, from a first plan to government contracting.',
    askFirst: [
      'Which center covers your county, and what does it offer?',
      'Does the advisor know your industry?',
      'Can the center help with certification or contracting?',
    ],
    window: { from: 0, to: 10 },
  },
  {
    id: 'government',
    name: 'Government and community funding',
    short: 'Government and funding',
    what: 'Federal research awards, manufacturing help, loans and community lenders that fund companies on public terms.',
    bestFor: 'Technical teams with research to do, manufacturers, and owners who need a loan on understood terms.',
    askFirst: [
      'What are the eligibility rules and deadlines for this round?',
      'What reporting does the award or loan require after you receive it?',
      'How long from application to decision?',
    ],
    window: { from: 1, to: 8 },
  },
  {
    id: 'communities',
    name: 'Founder communities',
    short: 'Founder communities',
    what: 'Networks, programs and lenders built for particular groups of founders: women, veterans, immigrants, Latino and multicultural founders, and rural founders.',
    bestFor: 'Founders who want peers with a shared background and programs designed around it.',
    askFirst: [
      'Who is the program built for, and does that match you?',
      'Is the community active this year?',
      'Which programs does it run itself and which does it refer to others?',
    ],
    window: { from: 0, to: 10 },
  },
];

export const CATEGORY_BY_ID: Readonly<Record<CategoryId, CategoryInfo>> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
) as Record<CategoryId, CategoryInfo>;
