/**
 * The home page's questions, by id. The questions and answers live in src/data/faq.yaml (the faq collection), where each answer
 * names the claims it rests on, so the home page and /faq/ can never say different things. The home page shows these five, in this order.
 */
export const HOME_FAQ_IDS = ['what-is-we', 'what-is-a-seat', 'relocate', 'promise-funding', 'legal-advice'] as const;
