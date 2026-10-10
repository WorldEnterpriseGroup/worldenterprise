import { STAGE_LABELS } from '../../pricing/stages.ts';
import { readinessStatements } from '../we-readiness-check/statements.ts';

/**
 * The evidence room's checklist as data: every item, the group it sits in, and the first company stage it is suggested for.
 * Pure data with no Astro imports, so the unit tests can load it.
 *
 * Provenance. The folder groups come from the data-room guide (src/content/guides/data-room.mdx): each item is a phrase from that
 * guide's "what belongs in it" column, and `source` holds the phrase so a test can confirm it is still there. The readiness group is
 * the artifact of each of the twelve readiness statements (src/components/islands/we-readiness-check/statements.ts). The last group is
 * the guide's "Before you share it" list. The stage an item is suggested for is WE's own ordering, not something either guide states,
 * and the page says so.
 */

/** The three stages the filter offers. The fourth published stage has no filter of its own: it shows every item. */
export const STAGE_ORDER = ['idea-or-prototype', 'first-product', 'early-customer-evidence'] as const;
export type EvidenceStage = (typeof STAGE_ORDER)[number];
export type StageFilter = 'all' | EvidenceStage;

export const STAGE_FILTERS: readonly StageFilter[] = ['all', ...STAGE_ORDER];

export function stageName(stage: StageFilter): string {
  return stage === 'all' ? 'All items' : STAGE_LABELS[stage];
}

export function isStageFilter(value: string): value is StageFilter {
  return (STAGE_FILTERS as readonly string[]).includes(value);
}

export const GROUP_IDS = ['company', 'product', 'customers', 'metrics', 'people', 'ip', 'security', 'legal', 'updates', 'readiness', 'share'] as const;
export type GroupId = (typeof GROUP_IDS)[number];

export type ItemOrigin = 'data-room' | 'readiness' | 'share';

export interface EvidenceGroup {
  readonly id: GroupId;
  readonly title: string;
  /** One sentence that opens the group. For a folder it is the guide's "what it shows" sentence. */
  readonly intro: string;
  readonly origin: ItemOrigin;
}

export interface EvidenceItem {
  /** Short and stable, so it can sit in the address bar: `1a`, `r3`, `s2`. Never reuse a code for a different item. */
  readonly code: string;
  readonly group: GroupId;
  readonly label: string;
  /** The first stage the item is suggested for. A later stage includes it too. */
  readonly stage: EvidenceStage;
  /** A phrase that appears in the guide the item came from (case-insensitive), or for a readiness item the statement's artifact. */
  readonly source: string;
  /** For a readiness item: the statement it backs. */
  readonly backs?: string;
  /** For a readiness item: where to start when it is missing. */
  readonly gapTitle?: string;
  readonly gapHref?: string;
}

export const EVIDENCE_GROUPS: readonly EvidenceGroup[] = [
  { id: 'company', title: '1. Company', intro: 'What it shows: that the company exists and who owns it.', origin: 'data-room' },
  { id: 'product', title: '2. Product', intro: 'What it shows: what exists, and what you chose not to build yet.', origin: 'data-room' },
  { id: 'customers', title: '3. Customers', intro: 'What it shows: who uses the product and what they committed to.', origin: 'data-room' },
  { id: 'metrics', title: '4. Metrics and finance', intro: 'What it shows: that the numbers are defined once and calculated consistently.', origin: 'data-room' },
  { id: 'people', title: '5. People and contracts', intro: 'What it shows: that the company owns the work it sells.', origin: 'data-room' },
  { id: 'ip', title: '6. Intellectual property', intro: 'What it shows: what the company controls and on what terms.', origin: 'data-room' },
  { id: 'security', title: '7. Security and privacy', intro: 'What it shows: where customer data lives and who can reach it.', origin: 'data-room' },
  { id: 'legal', title: '8. Legal', intro: 'What it shows: what obligations the company has taken on.', origin: 'data-room' },
  { id: 'updates', title: '9. Updates', intro: 'What it shows: a consistent history of reporting.', origin: 'data-room' },
  {
    id: 'readiness',
    title: 'Evidence for the twelve readiness statements',
    intro: 'Each item is the artifact that would show one readiness statement is true. The statement it backs is quoted under it.',
    origin: 'readiness',
  },
  { id: 'share', title: 'Before you share the data room', intro: 'Five checks to make before anyone is given access.', origin: 'share' },
];

type Row = readonly [code: string, label: string, stage: EvidenceStage, source: string];

const ROOM_ROWS: Readonly<Record<Exclude<GroupId, 'readiness' | 'share'>, readonly Row[]>> = {
  company: [
    ['1a', 'Formation documents', 'idea-or-prototype', 'Formation documents'],
    ['1b', 'Ownership records and the current cap table', 'idea-or-prototype', 'ownership records, the current cap table'],
    ['1c', 'Founder agreements', 'idea-or-prototype', 'founder agreements'],
    ['1d', 'Board and shareholder decisions', 'first-product', 'board and shareholder decisions'],
  ],
  product: [
    ['2a', 'A plain description of the product', 'idea-or-prototype', 'A plain description of the product'],
    ['2b', 'The current roadmap', 'idea-or-prototype', 'the current roadmap'],
    ['2c', 'An architecture overview', 'first-product', 'an architecture overview'],
    ['2d', 'The list of deferred decisions', 'first-product', 'the list of deferred decisions'],
  ],
  customers: [
    ['3a', 'A list of customers and pilots', 'first-product', 'A list of customers and pilots'],
    ['3b', 'The signed pilot scopes', 'first-product', 'the signed pilot scopes'],
    ['3c', 'A summary of the conversation log', 'idea-or-prototype', 'a summary of the conversation log'],
  ],
  metrics: [
    ['4a', 'Your metrics definitions', 'first-product', 'Your metrics definitions'],
    ['4b', 'Monthly figures calculated from those definitions', 'early-customer-evidence', 'monthly figures calculated from them'],
    ['4c', 'Bank and accounting summaries', 'first-product', 'bank and accounting summaries'],
    ['4d', 'A simple budget', 'first-product', 'a simple budget'],
  ],
  people: [
    ['5a', 'Contractor and employee agreements', 'first-product', 'Contractor and employee agreements'],
    ['5b', 'Assignments of work', 'idea-or-prototype', 'assignments of work'],
    ['5c', 'Advisor agreements', 'first-product', 'advisor agreements'],
    ['5d', 'Any outstanding commitments', 'first-product', 'any outstanding commitments'],
  ],
  ip: [
    ['6a', 'Domain names', 'idea-or-prototype', 'Domain names'],
    ['6b', 'Source repositories and who controls them', 'idea-or-prototype', 'source repositories and who controls them'],
    ['6c', 'Open-source licenses in use', 'first-product', 'open-source licenses in use'],
    ['6d', 'Brand assets', 'first-product', 'brand assets'],
  ],
  security: [
    ['7a', 'A data inventory', 'first-product', 'A data inventory'],
    ['7b', 'An access list', 'first-product', 'an access list'],
    ['7c', 'The privacy notice you publish', 'first-product', 'the privacy notice you publish'],
    ['7d', 'The vendors that handle customer data', 'early-customer-evidence', 'the vendors that handle customer data'],
  ],
  legal: [
    ['8a', 'Public terms', 'first-product', 'Public terms'],
    ['8b', 'Customer agreements', 'early-customer-evidence', 'customer agreements'],
    ['8c', 'Any disputes or notices', 'early-customer-evidence', 'any disputes or notices'],
    ['8d', 'The questions you have put to your counsel', 'idea-or-prototype', 'the questions you have put to your counsel'],
  ],
  updates: [
    ['9a', 'Your dated investor updates', 'early-customer-evidence', 'Your dated investor updates'],
    ['9b', 'Any materials you have shared with investors', 'early-customer-evidence', 'any materials you have shared with investors'],
  ],
};

/** The readiness artifacts, in the order of the self-check, each with the first stage it is suggested for. */
const READINESS_STAGE: Readonly<Record<string, EvidenceStage>> = {
  'problem-stated': 'idea-or-prototype',
  'customer-interviews': 'idea-or-prototype',
  'product-in-use': 'first-product',
  'first-customers': 'early-customer-evidence',
  'metrics-defined': 'first-product',
  'repeatable-channel': 'early-customer-evidence',
  'ip-assignments': 'idea-or-prototype',
  'entity-and-ownership': 'idea-or-prototype',
  'data-room-folder': 'first-product',
  'data-inventory': 'first-product',
  'update-habit': 'early-customer-evidence',
  'safe-with-counsel': 'first-product',
};

const SHARE_ROWS: readonly Row[] = [
  ['s1', 'Read the index as if you were a stranger', 'first-product', 'Read the index as if you were a stranger'],
  ['s2', 'Check the dates, and replace or archive anything out of date', 'first-product', 'Check the dates'],
  ['s3', 'Open each folder in a private window to confirm the permissions', 'first-product', 'Open each folder in a private window'],
  ['s4', 'Ask your own counsel to review folders 1, 5, 6 and 8', 'first-product', 'Ask your own counsel to review folders 1, 5, 6 and 8'],
  ['s5', 'Keep a log of who was given access and when', 'first-product', 'Keep a log of who was given access and when'],
];

function fromRows(group: GroupId, rows: readonly Row[]): EvidenceItem[] {
  return rows.map(([code, label, stage, source]) => ({ code, group, label, stage, source }));
}

const readinessItems: readonly EvidenceItem[] = readinessStatements.map((statement, index) => {
  const stage = READINESS_STAGE[statement.id];
  if (stage === undefined) throw new Error(`Evidence room: readiness statement "${statement.id}" has no stage.`);
  return {
    code: `r${index + 1}`,
    group: 'readiness',
    label: statement.artifact,
    stage,
    source: statement.artifact,
    backs: statement.statement,
    gapTitle: statement.gapTitle,
    gapHref: statement.gapHref,
  };
});

export const EVIDENCE_ITEMS: readonly EvidenceItem[] = [
  ...(Object.keys(ROOM_ROWS) as (keyof typeof ROOM_ROWS)[]).flatMap((group) => fromRows(group, ROOM_ROWS[group])),
  ...readinessItems,
  ...fromRows('share', SHARE_ROWS),
];

const ITEM_BY_CODE: ReadonlyMap<string, EvidenceItem> = new Map(EVIDENCE_ITEMS.map((item) => [item.code, item]));

export function itemByCode(code: string): EvidenceItem | undefined {
  return ITEM_BY_CODE.get(code);
}

export function groupById(id: GroupId): EvidenceGroup {
  const found = EVIDENCE_GROUPS.find((group) => group.id === id);
  if (found === undefined) throw new Error(`Evidence room: unknown group "${id}".`);
  return found;
}

export function itemsInGroup(id: GroupId): readonly EvidenceItem[] {
  return EVIDENCE_ITEMS.filter((item) => item.group === id);
}

/** True when the item shows under the filter. A filter includes its own stage and every earlier one. */
export function isShownAt(item: EvidenceItem, stage: StageFilter): boolean {
  if (stage === 'all') return true;
  return STAGE_ORDER.indexOf(item.stage) <= STAGE_ORDER.indexOf(stage);
}
