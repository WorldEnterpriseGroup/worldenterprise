/**
 * The words of /program/how-we-decide/ (WP-43), apart from the page intro in src/content/pages/program/how-we-decide.mdx, the fit lists
 * in fit.ts and the form's own words in fields.ts. Every sentence here restates something the site already says (DP-5: no new
 * criterion, no timeline, no count, no response time). `.astro-magazine/sources/wp-43.json` maps each sentence to the page and line or
 * the claim it comes from, and tests/unit/wp-43/sources.test.ts fails on a sentence with no mapping.
 *
 * Pure data, free of Astro globals, so node tests import it as well as the page.
 */

export interface LinkedLine {
  readonly before: string;
  readonly link: { readonly text: string; readonly href: string };
  readonly after: string;
}

export const DECIDE_COPY = {
  lead: 'How an application is read, and what WE does not decide.',

  read: {
    heading: 'How an application is read',
    intro: 'WE reviews each application. The application is short and asks only what WE needs to judge fit.',
    steps: [
      { title: 'WE reviews your application', body: 'WE reviews what you wrote about the idea and the team you have in mind.' },
      { title: 'WE replies', body: 'WE replies to the email address you give.' },
      { title: 'If the idea fits, WE scopes the work with you', body: 'WE and the founder choose which service lines the company needs and what each one will and will not cover.' },
    ],
    note: 'WE does not state a response time on this site.',
    more: { before: 'The full path is on ', link: { text: 'How the program works', href: '/program/how-it-works/' }, after: '.' } satisfies LinkedLine,
  },

  fit: {
    intro: 'Use these two lists to judge your own fit before you apply.',
  },

  send: {
    heading: 'What you can send',
    intro: 'The form asks for these answers.',
  },

  no: {
    heading: 'What a clear no looks like',
    lines: ['A clear no is as useful to you as a yes.', 'WE is probably not the right fit for some ideas and founders.'],
    more: { before: 'The cases are listed in ', link: { text: 'Who the program is for', href: '/program/who-its-for/' }, after: '.' } satisfies LinkedLine,
  },

  decide: {
    heading: 'What WE does not decide',
    rows: [
      {
        term: 'Funding',
        text: 'WE makes no promise of funding. The work helps you prepare the evidence investors ask for. It does not predict that any company will raise money.',
      },
      { term: 'Direction', text: 'You keep ownership of the direction.' },
      { term: 'The next cycle', text: 'You decide what the next cycle holds.' },
    ],
  },

  cta: {
    title: 'Ready to apply?',
    text: 'The application is short.',
  },

  next: [
    { title: 'How the program works', href: '/program/how-it-works/', description: 'Five steps from application to a working team.' },
    { title: 'Who the program is for', href: '/program/who-its-for/', description: 'Check your own fit before you apply.' },
    { title: 'Frequently asked questions', href: '/faq/', description: 'Short answers on stage, scope and cost.' },
  ],
} as const;

/** The "What WE reads" aside on /apply/ and the cross-link on /contact/, which point readers to the page above. */
export const ASIDE_COPY = {
  heading: 'What WE reads',
  reads: 'WE reads what the form asks for: who you are, where the idea stands and, if you add it, the team you have in mind.',
  page: { before: '', link: { text: 'How WE decides', href: '/program/how-we-decide/' }, after: ' lists who fits, who probably does not and what WE does not decide.' } satisfies LinkedLine,
  contact: { before: '', link: { text: 'How WE decides', href: '/program/how-we-decide/' }, after: ' says how an application is read.' } satisfies LinkedLine,
} as const;

/** A linked line as one plain sentence, for tests and the sources map. */
export function plainLine(line: LinkedLine): string {
  return `${line.before}${line.link.text}${line.after}`;
}
