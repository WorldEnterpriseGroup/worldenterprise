/**
 * Mapping between a validated submission and the Dataverse rows. The column names here are the contract with
 * `infra/intake/dataverse/definition.json`; tests/definition.test.ts fails if the two drift.
 */

import { emailDomain, isConsumerDomain } from './text.ts';
import type { Submission } from './validate.ts';

export const ENTITY_SET = 'we_engagements';
export const ACCOUNT_KEY_COLUMN = 'we_accountkey';

/** Navigation property names are case-sensitive and equal the lookup column schema names in definition.json. */
export const NAV_CONTACT = 'we_Contact';
export const NAV_ACCOUNT = 'we_Account';
export const NAV_LEAD = 'we_Lead';

/** The Dataverse column that holds the request id on a Lead; it carries the alternate key that makes a replayed Lead create a no-op. */
export const LEAD_KEY_COLUMN = 'we_requestid';

export const STATUS = {
  received: 100000000,
  delivered: 100000001,
  'delivery-failed': 100000002,
  unsubscribed: 100000003,
} as const;
export type StatusName = keyof typeof STATUS;

export const REVIEW = {
  none: 100000000,
  'contact-ambiguous': 100000001,
} as const;
export type ReviewName = keyof typeof REVIEW;

export function statusName(value: unknown): StatusName {
  for (const [name, code] of Object.entries(STATUS)) if (code === value) return name as StatusName;
  return 'received';
}

export function reviewName(value: unknown): ReviewName {
  for (const [name, code] of Object.entries(REVIEW)) if (code === value) return name as ReviewName;
  return 'none';
}

/** A row as the service reads it back. Only the fields the service needs after the write. */
export interface EngagementRecord {
  readonly id: string;
  readonly requestId: string;
  readonly kind: string;
  readonly audience: string;
  readonly status: StatusName;
  readonly review: ReviewName;
  readonly name: string;
  readonly email: string;
  readonly briefId: string;
  readonly briefVersion: string;
  readonly company: string;
  readonly companyUrl: string;
  readonly stage: string;
  readonly seats: string;
  readonly topic: string;
  readonly message: string;
  readonly partnerCategory: string;
  readonly investorKind: string;
  readonly focus: string;
  readonly offer: string;
  readonly page: string;
  readonly consentUpdates: boolean;
  /** Empty until the Lead exists, and for the form that makes none. */
  readonly leadId: string;
  readonly contactId: string;
  readonly accountId: string;
  /** ISO time the info@ notification was accepted; empty until then. */
  readonly notifiedAt: string;
  readonly deliveryAttempts: number;
  readonly lastAttemptAt: string;
  readonly nurtureStage: number;
  readonly nurtureNextAt: string;
  readonly tokenCiphertext: string;
  readonly createdAt: string;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function whole(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : 0;
}

export const ENGAGEMENT_SELECT = [
  'we_engagementid', 'we_requestid', 'we_kind', 'we_audience', 'we_status', 'we_review', 'we_submittername', 'we_email', 'we_briefid',
  'we_briefversion', 'we_consentupdates', 'we_deliveryattempts', 'we_lastattemptat', 'we_nurturestage', 'we_nurturenextat',
  'we_unsubscribetoken', 'createdon', 'we_company', 'we_companyurl', 'we_stage', 'we_seats', 'we_topic', 'we_message', 'we_partnercategory',
  'we_investorkind', 'we_focus', 'we_offer', 'we_sourcepage', 'we_notifiedat', '_we_lead_value', '_we_contact_value', '_we_account_value',
] as const;

export function engagementFromRow(row: Readonly<Record<string, unknown>>): EngagementRecord {
  return {
    id: text(row['we_engagementid']),
    requestId: text(row['we_requestid']),
    kind: text(row['we_kind']),
    audience: text(row['we_audience']),
    status: statusName(row['we_status']),
    review: reviewName(row['we_review']),
    name: text(row['we_submittername']),
    email: text(row['we_email']),
    briefId: text(row['we_briefid']),
    briefVersion: text(row['we_briefversion']),
    company: text(row['we_company']),
    companyUrl: text(row['we_companyurl']),
    stage: text(row['we_stage']),
    seats: text(row['we_seats']),
    topic: text(row['we_topic']),
    message: text(row['we_message']),
    partnerCategory: text(row['we_partnercategory']),
    investorKind: text(row['we_investorkind']),
    focus: text(row['we_focus']),
    offer: text(row['we_offer']),
    page: text(row['we_sourcepage']),
    consentUpdates: row['we_consentupdates'] === true,
    leadId: text(row['_we_lead_value']),
    contactId: text(row['_we_contact_value']),
    accountId: text(row['_we_account_value']),
    notifiedAt: text(row['we_notifiedat']),
    deliveryAttempts: whole(row['we_deliveryattempts']),
    lastAttemptAt: text(row['we_lastattemptat']),
    nurtureStage: whole(row['we_nurturestage']),
    nurtureNextAt: text(row['we_nurturenextat']),
    tokenCiphertext: text(row['we_unsubscribetoken']),
    createdAt: text(row['createdon']),
  };
}

export interface RowLinks {
  readonly accountId: string | null;
  readonly contactId: string | null;
  readonly review: ReviewName;
}

export interface RowContext {
  readonly now: Date;
  readonly tokenCiphertext: string;
  readonly tokenHash: string;
  readonly briefVersion: string;
}

/** The create body for one engagement row. Keys are Dataverse logical names; lookups use `@odata.bind`. */
export function buildEngagementRow(submission: Submission, links: RowLinks, context: RowContext): Record<string, unknown> {
  const row: Record<string, unknown> = {
    we_name: `${submission.kind}:${submission.requestId.slice(0, 8)}`,
    we_requestid: submission.requestId,
    we_kind: submission.kind,
    we_audience: submission.audience,
    we_briefid: submission.briefId,
    we_briefversion: context.briefVersion,
    we_stage: submission.stage,
    we_partnercategory: submission.partnerCategory,
    we_investorkind: submission.investorKind,
    we_sourcepage: submission.page,
    we_consent_at: context.now.toISOString(),
    we_consentupdates: submission.consentUpdates,
    we_status: STATUS.received,
    we_review: REVIEW[links.review],
    we_submittername: submission.name,
    we_email: submission.email,
    we_company: submission.company,
    we_companyurl: submission.companyUrl,
    we_seats: submission.seats,
    we_topic: submission.topic,
    we_message: submission.message,
    we_focus: submission.focus,
    we_offer: submission.offer,
    we_deliveryattempts: 0,
    we_nurturestage: 0,
    we_unsubscribetoken: context.tokenCiphertext,
    we_tokenhash: context.tokenHash,
  };
  if (links.contactId !== null) row[`${NAV_CONTACT}@odata.bind`] = `/contacts(${links.contactId})`;
  if (links.accountId !== null) row[`${NAV_ACCOUNT}@odata.bind`] = `/accounts(${links.accountId})`;
  return row;
}

export interface AccountPlan {
  /** Value of the `we_accountkey` alternate key. */
  readonly key: string;
  readonly fields: Readonly<Record<string, unknown>>;
  /** True when the Account stands for an organization, so a contact is attached to it as its employer. */
  readonly organization: boolean;
}

/**
 * One Account per organization, keyed on the normalized email domain, but only for domains that identify an organization.
 * A consumer mailbox (Gmail and the like) gets a person-level Account keyed on the address instead, so two unrelated
 * founders on the same free provider are never merged into one company.
 */
export function planAccount(submission: Submission): AccountPlan {
  const domain = emailDomain(submission.email);
  if (!isConsumerDomain(domain)) {
    return {
      key: `domain:${domain}`,
      fields: { name: submission.company !== '' ? submission.company : domain, websiteurl: submission.companyUrl !== '' ? submission.companyUrl : `https://${domain}` },
      organization: true,
    };
  }
  return {
    key: `person:${submission.email}`,
    fields: { name: submission.company !== '' ? submission.company : displayName(submission) },
    organization: false,
  };
}

/** The newsletter form collects an address and no name, so the address stands in wherever a name is required. */
function displayName(submission: Submission): string {
  return submission.name !== '' ? submission.name : submission.email;
}

export function splitName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { first: '', last: parts[0] ?? name };
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] ?? '' };
}

/** A contact create body. Bulk mail is allowed only when the person ticked the updates box. */
export function buildContactFields(submission: Submission, accountId: string | null): Record<string, unknown> {
  const { first, last } = splitName(displayName(submission));
  const fields: Record<string, unknown> = {
    firstname: first,
    lastname: last,
    emailaddress1: submission.email,
    donotbulkemail: !submission.consentUpdates,
  };
  if (accountId !== null) fields['parentcustomerid_account@odata.bind'] = `/accounts(${accountId})`;
  return fields;
}

export interface ContactMatch {
  readonly id: string;
}

export type ContactSelection =
  | { readonly outcome: 'create' }
  | { readonly outcome: 'use'; readonly contact: ContactMatch }
  /** More than one contact has this address. WE does not pick one: the row is kept unlinked and flagged for a person to resolve. */
  | { readonly outcome: 'ambiguous' };

export function selectContact(matches: readonly ContactMatch[]): ContactSelection {
  if (matches.length === 0) return { outcome: 'create' };
  const [only] = matches;
  if (matches.length === 1 && only !== undefined) return { outcome: 'use', contact: only };
  return { outcome: 'ambiguous' };
}

/** The forms that are a sales or partnership enquiry and so become a Lead. The newsletter signup is a Contact and nothing more. */
export const LEAD_KINDS: readonly string[] = ['apply', 'contact', 'investor-interest', 'partner-enquiry', 'brief-request'];

export function makesLead(kind: string): boolean {
  return LEAD_KINDS.includes(kind);
}

const KIND_LABEL: Readonly<Record<string, string>> = {
  apply: 'Application',
  contact: 'Contact',
  newsletter: 'Newsletter signup',
  'brief-request': 'Brief request',
  'investor-interest': 'Investor interest',
  'partner-enquiry': 'Partner enquiry',
};

export function kindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind;
}

/** `leadsourcecode` 8 is "Web" in the standard Lead option set. */
const LEAD_SOURCE_WEB = 8;
/** The standard Lead `description` column holds 2000 characters. The full text stays on the engagement row. */
const LEAD_DESCRIPTION_MAX = 2000;

/** Deterministic, so a person searching Dynamics finds the lead from the id in a notification and a replay can be recognised by eye. */
export function leadSubject(record: Pick<EngagementRecord, 'kind' | 'requestId' | 'name' | 'email'>): string {
  const who = record.name !== '' ? record.name : record.email;
  return `${kindLabel(record.kind)}: ${who} (${record.requestId.slice(0, 8)})`.slice(0, 300);
}

function leadDescription(record: EngagementRecord): string {
  const lines: [string, string][] = [
    ['Form', kindLabel(record.kind)],
    ['Audience', record.audience],
    ['Topic', record.topic],
    ['Company stage', record.stage],
    ['Seats', record.seats],
    ['Brief', record.briefId],
    ['Partner category', record.partnerCategory],
    ['Investor kind', record.investorKind],
    ['Focus', record.focus],
    ['Offer', record.offer],
    ['Source page', record.page],
    ['Message', record.message],
  ];
  const text = lines.filter(([, value]) => value !== '').map(([label, value]) => `${label}: ${value}`).join('\n');
  return text.length <= LEAD_DESCRIPTION_MAX ? text : `${text.slice(0, LEAD_DESCRIPTION_MAX - 1)}\u2026`;
}

/**
 * The create body for the standard Dynamics 365 `lead` that mirrors one engagement row. It carries the request id in the
 * alternate-key column, so creating it twice for one request is a no-op. The owner is left to Dataverse: the Lead is owned
 * by the intake application user, which sits in the World Enterprise business unit.
 */
export function buildLeadFields(record: EngagementRecord): Record<string, unknown> {
  const { first, last } = splitName(record.name !== '' ? record.name : record.email);
  const fields: Record<string, unknown> = {
    subject: leadSubject(record),
    firstname: first,
    lastname: last,
    emailaddress1: record.email,
    companyname: record.company,
    description: leadDescription(record),
    leadsourcecode: LEAD_SOURCE_WEB,
    donotbulkemail: !record.consentUpdates,
    [LEAD_KEY_COLUMN]: record.requestId,
  };
  if (record.companyUrl !== '') fields['websiteurl'] = record.companyUrl;
  return fields;
}

/** What the notification workflow receives. No message body, no email address. */
export interface NotifyEvent {
  readonly requestId: string;
  readonly kind: string;
  readonly formLabel: string;
  readonly name: string;
  /** The Dynamics record to open: the Lead, else the Contact, else the engagement row. */
  readonly recordUrl: string;
  /** True for traffic from the end-to-end test, which uses a reserved `.invalid` address. */
  readonly test: boolean;
}

export function isTestTraffic(email: string): boolean {
  return emailDomain(email).endsWith('.invalid');
}

export function recordUrl(baseUrl: string, record: EngagementRecord): string {
  const [table, id] = record.leadId !== '' ? ['lead', record.leadId] : record.contactId !== '' ? ['contact', record.contactId] : ['we_engagement', record.id];
  return `${baseUrl}/main.aspx?pagetype=entityrecord&etn=${table}&id=${id}`;
}

export function buildNotifyEvent(record: EngagementRecord, crmBaseUrl: string): NotifyEvent {
  return {
    requestId: record.requestId,
    kind: record.kind,
    formLabel: kindLabel(record.kind),
    name: record.name !== '' ? record.name : '(no name given)',
    recordUrl: recordUrl(crmBaseUrl, record),
    test: isTestTraffic(record.email),
  };
}
