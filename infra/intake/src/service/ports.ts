/**
 * The seams between the service logic and Azure. The service depends only on these interfaces; `src/azure/**` implements
 * them with the Azure SDKs and `tests/fakes.ts` implements them in memory. Adapters throw on failure, and the service
 * decides what a failure means for the visitor. An adapter must never put request data in an error message.
 */

import type { MailMessage } from '../logic/mail.ts';
import type { RateDecision } from '../logic/rate.ts';
import type { AccountPlan, ContactMatch, EngagementRecord, StatusName } from '../logic/mapping.ts';

export interface Clock {
  now(): number;
}

export interface RateStore {
  /** Consumes one unit of `key` in its window under a lease, and says whether the request may proceed. */
  consume(key: string, now: number, limit?: number): Promise<RateDecision>;
}

export interface LockPort {
  /** Runs `fn` while holding an exclusive lease on `key`. Waits briefly, then throws `lock_unavailable`. */
  withLock<T>(key: string, fn: () => Promise<T>): Promise<T>;
}

export type CreateOutcome = 'created' | 'exists';

export interface EngagementPatch {
  readonly status?: StatusName;
  readonly deliveryAttempts?: number;
  readonly lastAttemptAt?: Date;
  readonly deliveredAt?: Date;
  readonly briefVersion?: string;
  readonly nurtureStage?: number;
  readonly nurtureNextAt?: Date | null;
}

export interface EngagementStore {
  getByRequestId(requestId: string): Promise<EngagementRecord | null>;
  getByTokenHash(tokenHash: string): Promise<EngagementRecord | null>;
  /** Creates the row, or reports that one with this `we_requestid` already exists. Never overwrites. */
  createIfAbsent(requestId: string, row: Readonly<Record<string, unknown>>): Promise<CreateOutcome>;
  update(id: string, patch: EngagementPatch): Promise<void>;
  /**
   * Brief requests still owed an email, oldest first, at most `limit`: rows in `delivery-failed`, plus rows still in
   * `received` that were created before `staleBefore` and never attempted (the response was sent but the email step did not run).
   */
  listDeliveryPending(staleBefore: Date, limit: number): Promise<readonly EngagementRecord[]>;
  /** Delivered rows with `we_consentupdates` and a stage still to send whose due time has passed. */
  listNurtureDue(now: Date, limit: number): Promise<readonly EngagementRecord[]>;
}

export interface CrmStore {
  /** Creates the Account if its key is new, otherwise returns the existing one without changing it. */
  ensureAccount(plan: AccountPlan): Promise<{ readonly id: string }>;
  findContactsByEmail(email: string): Promise<readonly ContactMatch[]>;
  createContact(fields: Readonly<Record<string, unknown>>): Promise<ContactMatch>;
  markContactOptedOut(contactId: string): Promise<void>;
  /** The contact id linked to an engagement row, when there is one. */
  contactOfEngagement(engagementId: string): Promise<string | null>;
}

export interface SuppressionRecord {
  readonly at: string;
  readonly crmSynced: boolean;
  /** The engagement row the person unsubscribed from, so the sweep can finish the Dataverse update. */
  readonly engagementId: string;
}

export interface SuppressionStore {
  get(emailHash: string): Promise<SuppressionRecord | null>;
  put(emailHash: string, record: SuppressionRecord): Promise<void>;
  /** Email hashes whose Dataverse update did not complete. */
  listUnsynced(limit: number): Promise<readonly { readonly emailHash: string; readonly record: SuppressionRecord }[]>;
}

export interface BriefEntry {
  readonly id: string;
  readonly title: string;
  readonly version: string;
  /** Blob path of the PDF inside the private container. */
  readonly pdfPath: string;
  readonly htmlPath: string;
}

export interface BriefRegistry {
  /** The registry the render job published. Cached briefly by the adapter. */
  list(): Promise<readonly BriefEntry[]>;
}

export interface BriefLinks {
  /** A read-only user-delegation SAS URL for the entry, valid 48 hours. */
  mintLink(entry: BriefEntry, now: number): Promise<string>;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

export interface Notifier {
  /** Posts a signed, personal-data-free event to the optional webhook. A no-op when none is configured. */
  notify(event: Readonly<Record<string, string | number>>): Promise<void>;
}

export interface Ids {
  requestId(): string;
  token(): string;
}

export interface Settings {
  /** Allowed browser origins, exact match. The first is the production site. */
  readonly allowedOrigins: readonly string[];
  readonly siteOrigin: string;
  /** Public origin of this service, used to build the unsubscribe link. */
  readonly apiOrigin: string;
  readonly unsubscribeKey: string;
  readonly nurtureEnabled: boolean;
  readonly footerAddress: string;
}
