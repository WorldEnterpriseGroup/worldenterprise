/**
 * Diagram content for the fundability family (WP-23, #89). Every step and folder paraphrases the guide it illustrates
 * (src/content/guides/*.mdx), so a diagram never says more than its page. No figures live here: statistics come from
 * research/media/data.ts.
 */
import type { Cluster } from '../research/media/ClusterDiagram.astro';
import type { FlowStep } from '../research/media/FlowDiagram.astro';
import type { Folder } from '../research/media/FolderTree.astro';
import type { Layer } from '../research/media/LayerStack.astro';
import type { Option } from '../research/media/OptionGrid.astro';

/** The guides that carry media bands, in hub order. */
export const GUIDE_MEDIA_SLUGS = [
  'investor-readiness-checklist',
  'data-room',
  'safe-explained',
  'investor-updates',
  'term-sheet-checklist',
  'security-questionnaire-answers',
  'pricing-experiments',
  'customer-interview-synthesis',
] as const;
export type GuideMediaSlug = (typeof GUIDE_MEDIA_SLUGS)[number];
export const isGuideMediaSlug = (slug: string): slug is GuideMediaSlug => (GUIDE_MEDIA_SLUGS as readonly string[]).includes(slug);

/** data-room.mdx, "The folders". */
export const DATA_ROOM_FOLDERS: readonly Folder[] = [
  { name: 'Index', items: ['One row per document', 'Gaps noted with a date'], shows: 'The file a stranger opens first' },
  { name: '1. Company', items: ['Formation documents', 'Current cap table'], shows: 'That the company exists and who owns it' },
  { name: '2. Product', items: ['Roadmap', 'Deferred decisions'], shows: 'What exists' },
  { name: '3. Customers', items: ['Signed pilot scopes', 'Conversation log summary'], shows: 'Who committed to what' },
  { name: '4. Metrics and finance', items: ['Metric definitions', 'Monthly figures'], shows: 'Numbers defined once' },
  { name: '5. People and contracts', items: ['Assignments of work'], shows: 'That the company owns its work' },
  { name: '6. Intellectual property', items: ['Repositories and who controls them'], shows: 'What the company controls' },
  { name: '7. Security and privacy', items: ['Data inventory', 'Access list'], shows: 'Where customer data lives' },
  { name: '8. Legal', items: ['Customer agreements'], shows: 'Obligations taken on' },
  { name: '9. Updates', items: ['Dated investor updates'], shows: 'A history of reporting' },
];

/** Hub: a common sequence of a conversation with an investor (fundability hub copy, data-room.mdx "Share in stages", term sheet guide). */
export const MEETING_FLOW: readonly FlowStep[] = [
  { label: 'Introduction', text: 'A short note on the company and what you are raising for.' },
  { label: 'First meeting', text: 'The story, the evidence, and the questions you cannot answer yet.' },
  { label: 'Overview folders', text: 'Company, product and metrics first, from the data room index.' },
  { label: 'Diligence', text: 'Claims checked against records; sensitive folders opened when needed.' },
  { label: 'Terms or a pass', text: 'A term sheet, a no, or a request to stay in touch.' },
  { label: 'Your counsel', text: 'Your own lawyer reads any terms before you sign.' },
];

/** investor-readiness-checklist.mdx, "How to use the checklist" and "What counts as an artifact". */
export const ARTIFACT_FLOW: readonly FlowStep[] = [
  { label: 'Read the statement', text: 'Answer honestly. "Mostly" is a no.' },
  { label: 'Find the record', text: 'If you cannot find it, change the answer.' },
  { label: 'Test it', text: 'A stranger can open it, it is dated, it says what it is, it lives in one place.' },
  { label: 'Close the gap', text: 'For every no, follow the guide or template that builds the missing piece.' },
  { label: 'Return in a month', text: 'The list is meant to shrink.' },
];

/** data-room.mdx, "Share in stages" and "Keep it honest". */
export const SHARE_STAGES: readonly FlowStep[] = [
  { label: 'Index', text: 'The one file a stranger opens first.' },
  { label: 'Overview folders', text: 'Company, product, and metrics and finance.' },
  { label: 'Sensitive folders', text: 'Opened only when the conversation needs them.' },
  { label: 'Access log', text: 'Each step recorded: who saw what, and when.' },
];

/** safe-explained.mdx, "The idea in one paragraph" and "How it differs from a priced round". */
export const SAFE_FLOW: readonly FlowStep[] = [
  { label: 'Sign', text: 'The investor pays now and receives a right to shares later, not shares.' },
  { label: 'No price yet', text: 'No price per share is set on the day the contract is signed.' },
  { label: 'A defined event', text: 'Usually a priced round, or another event the document defines.' },
  { label: 'Conversion', text: 'Rules written into the document work out the price and the number of shares.' },
  { label: 'Shares issued', text: 'The right becomes stock. Model it with your counsel before you sign.' },
];

/** safe-explained.mdx, "How it differs from a priced round". */
export const SAFE_VS_PRICED: readonly Option[] = [
  { label: 'Priced round', text: 'A price per share is agreed on the day the money moves, and shares are issued.', icon: 'gate', meta: 'Ownership is known at signing' },
  { label: 'SAFE', text: 'A contract for future shares. The price is worked out later by rules in the document.', icon: 'document', meta: 'Ownership is known at conversion' },
  { label: 'Loan or convertible note', text: 'A different instrument again. A lawyer can explain how it differs for your company.', icon: 'contact', meta: 'Ask your counsel' },
];

/** investor-updates.mdx, "A structure that holds". */
export const UPDATE_PARTS: readonly FlowStep[] = [
  { label: 'Headline', text: 'One sentence on how the period went.' },
  { label: 'Progress', text: 'Last time’s goals, done or not done.' },
  { label: 'Numbers', text: 'The agreed metrics, calculated the same way.' },
  { label: 'Problems', text: 'What is hard right now.' },
  { label: 'Asks', text: 'One or two specific requests.' },
  { label: 'Next period', text: 'Two or three goals to report on.' },
];

/** term-sheet-checklist.mdx, "Before the term sheet arrives". */
export const TERM_SHEET_PREP: readonly FlowStep[] = [
  { label: 'Update the cap table', text: 'You cannot judge a change without the starting point.' },
  { label: 'Know your runway', text: 'How long the cash lasts at the current burn.' },
  { label: 'Choose your counsel', text: 'A lawyer who works for you, chosen before you need one.' },
  { label: 'Order your goals', text: 'Control, price, speed and the character of the investor, written down.' },
];

/** term-sheet-checklist.mdx, "The checklist", grouped. */
export const TERM_SHEET_SECTIONS: readonly Folder[] = [
  { name: 'Economics', items: ['Price and amount', 'Type of security', 'Liquidation preference'], shows: 'Who owns what, and who is paid first' },
  { name: 'Control', items: ['Voting and the board', 'Information rights'], shows: 'Who decides, and what you report' },
  { name: 'Protection', items: ['A lower price later', 'Later rounds'], shows: 'What happens in the next financing' },
  { name: 'Founders', items: ['Vesting of founder shares'], shows: 'What happens if a founder leaves' },
  { name: 'Process', items: ['Exclusivity', 'Costs and conditions'], shows: 'What must happen before closing' },
];

/** security-questionnaire-answers.mdx: what stands behind each answer. Top layer first. */
export const ANSWER_LAYERS: readonly Layer[] = [
  { name: 'The questionnaire', text: 'The customer’s spreadsheet, a standard question set, or a request for an independent report.', tag: 'What arrives' },
  { name: 'Answer library', text: 'One approved, dated answer per question, reused so answers stay consistent.', tag: 'What you send' },
  { name: 'Evidence', text: 'The records that show each control working today, with the date you last checked.', tag: 'What you show' },
  { name: 'Controls and inventory', text: 'The systems, the data each holds and who can reach it. Every answer rests here.', tag: 'What exists' },
];

/** security-questionnaire-answers.mdx, "Use a small set of honest statuses". */
export const ANSWER_STATUSES: readonly Option[] = [
  { label: 'In place', text: 'The control exists and you can show it working today.', icon: 'checklist', meta: 'Add the evidence and the date checked' },
  { label: 'Partly', text: 'It exists for some systems or people, not all.', icon: 'data', meta: 'Say what is covered and who owns the rest' },
  { label: 'Planned', text: 'Decided, not built. Never answer yes to a plan.', icon: 'calendar', meta: 'Add the owner and a target date' },
  { label: 'Not in place', text: 'It does not exist and is not planned.', icon: 'gate', meta: 'Say what you do instead, if anything' },
  { label: 'Not applicable', text: 'The question concerns something you do not have.', icon: 'document', meta: 'Say why' },
];

/** pricing-experiments.mdx, "Write the hypothesis first" and what follows. */
export const PRICING_LOOP: readonly FlowStep[] = [
  { label: 'The change', text: 'One thing differs between the groups.' },
  { label: 'The prediction', text: 'What you expect, and why.' },
  { label: 'The measure', text: 'Replies, trials, signatures: chosen now.' },
  { label: 'The decision rule', text: 'Fixed before you look at results.' },
  { label: 'Log each exposure', text: 'Who saw which price, and when.' },
  { label: 'Read it honestly', text: 'Then decide, and write the next test.' },
];

/** pricing-experiments.mdx, "Choose the kind of test". */
export const PRICE_TESTS: readonly Option[] = [
  { label: 'Conversation', text: 'State the price in an interview and record the reaction.', icon: 'contact', meta: 'Risk: politeness is not a purchase' },
  { label: 'Quote', text: 'Comparable prospects receive different quotes for the same thing.', icon: 'document', meta: 'Risk: groups may not compare' },
  { label: 'Packaging', text: 'Same price, different contents.', icon: 'data', meta: 'Risk: confusion looks like a price effect' },
  { label: 'Page', text: 'A different price on the pricing page, for a defined group.', icon: 'globe', meta: 'Risk: too few visitors to read' },
  { label: 'Term', text: 'Monthly or annual at the same price.', icon: 'calendar', meta: 'Risk: cash flow hides the reaction' },
];

/** customer-interview-synthesis.mdx, steps 1 to 5. */
export const SYNTHESIS_STEPS: readonly FlowStep[] = [
  { label: 'Analyze soon', text: 'After each round, while it is fresh.' },
  { label: 'Observations', text: 'One per line, coded did, said or predicted.' },
  { label: 'Cluster', text: 'Group them until each group has a plain name.' },
  { label: 'Findings', text: 'Each cluster with its evidence and confidence.' },
  { label: 'Unknowns', text: 'Counter-evidence, open questions, people not yet heard.' },
];

/** customer-interview-synthesis.mdx, "A worked example" (fictional, eight interviews). */
export const SYNTHESIS_EXAMPLE: readonly Cluster[] = [
  { label: 'Owners fix schedule conflicts by text message on the day.', observations: ['D', 'D', 'D', 'D', 'D', 'S'], confidence: 'High: most are things people did.' },
  { label: 'Owners say they would pay to avoid the texting.', observations: ['P', 'P', 'P', 'P'], confidence: 'Low: predictions only, and nobody has paid yet.' },
  { label: 'Larger cafes use a spreadsheet and are content with it.', observations: ['S', 'S'], confidence: 'Low: only two, both about the past.' },
];
