/**
 * Home page questions. WP-15 switches the home page to src/data/faq.yaml once WP-08 fills it; until then these
 * five answers stay inside the claims ladder (C-01 to C-05, C-18, C-19).
 */
export interface HomeFaq {
  readonly question: string;
  readonly answer: string;
}

export const HOME_FAQS: readonly HomeFaq[] = [
  {
    question: 'What is World Enterprise Incubator?',
    answer:
      'It is a digital incubator for SaaS. WE gives a founder a method, a set of playbooks and dedicated team seats that work only on that founder\'s company.',
  },
  {
    question: 'Do I need to move or visit an office?',
    answer: 'No. The program is fully remote. There is no office to visit and nobody relocates.',
  },
  {
    question: 'Who works on my product?',
    answer:
      'Dedicated offshore seats, steered by WE. The seats work for your company, and WE is accountable for how they are managed, including any subcontractors.',
  },
  {
    question: 'Will WE fund my company?',
    answer:
      'No. WE does not promise funding. It helps you assemble the evidence a serious investor asks for, and the decision to invest stays with the investor.',
  },
  {
    question: 'Does WE give legal or tax advice?',
    answer:
      'No. Your own counsel and accountant stay your own. WE coordinates with them so the company\'s paperwork keeps pace with its product.',
  },
];
