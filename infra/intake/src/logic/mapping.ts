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
  readonly consentUpdates: boolean;
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
  'we_unsubscribetoken', 'createdon',
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
    consentUpdates: row['we_consentupdates'] === true,
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
