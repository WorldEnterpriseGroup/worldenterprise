/**
 * In-memory implementations of every port, with failure injection, plus a request builder. Used by the service tests so
 * the whole intake flow runs with no network and no Azure SDK.
 */

import type { Contract } from '../src/logic/contract.ts';
import type { HttpRequestLike } from '../src/logic/http.ts';
import { createLogger, type LogLevel } from '../src/logic/log.ts';
import type { MailMessage } from '../src/logic/mail.ts';
import { engagementFromRow, REVIEW, STATUS, type AccountPlan, type ContactMatch, type EngagementRecord } from '../src/logic/mapping.ts';
import { consume, type RateDecision, type RateRecord } from '../src/logic/rate.ts';
import { loadContractUnderTest } from './contract-source.ts';
import type { Deps } from '../src/service/deps.ts';
import type {
  BriefEntry, BriefLinks, BriefRegistry, Clock, CreateOutcome, CrmStore, EngagementPatch, EngagementStore, Ids, LockPort, Mailer, Notifier,
  RateStore, Settings, SuppressionRecord, SuppressionStore,
} from '../src/service/ports.ts';

/** The contract every service test runs against: the committed schema, or the fixture until WP-60 lands it. */
export function loadFixtureContract(): Contract {
  return loadContractUnderTest().contract;
}

/** A failure whose message carries everything that must never reach a log: an email, a token and a signed URL. */
export function leakyError(code: string): Error & { code: string } {
  return Object.assign(new Error('GET https://dv.example/api/data/v9.2/contacts?$filter=emailaddress1 eq \'ada@example.org\' token=SECRETTOKEN0123456789abcdefghijklmnopqrstuv https://acct.blob.core.windows.net/b/x.pdf?sv=2024&sig=SASSIGNATURE'), { code });
}

export class FakeClock implements Clock {
  current: number;
  constructor(start = Date.parse('2026-10-12T12:00:00.000Z')) {
    this.current = start;
  }
  now(): number {
    return this.current;
  }
  advance(ms: number): void {
    this.current += ms;
  }
}

export class FakeRate implements RateStore {
  readonly records = new Map<string, RateRecord>();
  failWith: Error | null = null;
  consumeCalls = 0;
  async consume(key: string, now: number): Promise<RateDecision> {
    this.consumeCalls += 1;
    if (this.failWith !== null) throw this.failWith;
    const decision = consume(this.records.get(key) ?? null, now);
    this.records.set(key, decision.record);
    return decision;
  }
}

export class FakeLock implements LockPort {
  readonly keys: string[] = [];
  private tail: Promise<unknown> = Promise.resolve();
  withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    this.keys.push(key);
    const run = this.tail.then(fn, fn);
    this.tail = run.catch(() => undefined);
    return run;
  }
}

export class FakeEngagements implements EngagementStore {
  readonly rows = new Map<string, Record<string, unknown>>();
  failCreate: Error | null = null;
  failRead: Error | null = null;
  failUpdate: Error | null = null;
  private sequence = 0;
  private readonly clock: Clock;
  constructor(clock: Clock) {
    this.clock = clock;
  }

  private find(predicate: (row: Record<string, unknown>) => boolean): Record<string, unknown> | null {
    for (const row of this.rows.values()) if (predicate(row)) return row;
    return null;
  }

  async getByRequestId(requestId: string): Promise<EngagementRecord | null> {
    if (this.failRead !== null) throw this.failRead;
    const row = this.rows.get(requestId);
    return row === undefined ? null : engagementFromRow(row);
  }

  async getByTokenHash(tokenHash: string): Promise<EngagementRecord | null> {
    if (this.failRead !== null) throw this.failRead;
    const row = this.find((candidate) => candidate['we_tokenhash'] === tokenHash);
    return row === null ? null : engagementFromRow(row);
  }

  async createIfAbsent(requestId: string, row: Readonly<Record<string, unknown>>): Promise<CreateOutcome> {
    if (this.failCreate !== null) throw this.failCreate;
    if (this.rows.has(requestId)) return 'exists';
    this.sequence += 1;
    this.rows.set(requestId, { ...row, we_engagementid: `eng-${this.sequence}`, createdon: new Date(this.clock.now()).toISOString() });
    return 'created';
  }

  async update(id: string, patch: EngagementPatch): Promise<void> {
    if (this.failUpdate !== null) throw this.failUpdate;
    const row = this.find((candidate) => candidate['we_engagementid'] === id);
    if (row === null) throw new Error('row_not_found');
    if (patch.status !== undefined) row['we_status'] = STATUS[patch.status];
    if (patch.deliveryAttempts !== undefined) row['we_deliveryattempts'] = patch.deliveryAttempts;
    if (patch.lastAttemptAt !== undefined) row['we_lastattemptat'] = patch.lastAttemptAt.toISOString();
    if (patch.deliveredAt !== undefined) row['we_deliveredat'] = patch.deliveredAt.toISOString();
    if (patch.briefVersion !== undefined) row['we_briefversion'] = patch.briefVersion;
    if (patch.nurtureStage !== undefined) row['we_nurturestage'] = patch.nurtureStage;
    if (patch.nurtureNextAt !== undefined) row['we_nurturenextat'] = patch.nurtureNextAt === null ? '' : patch.nurtureNextAt.toISOString();
  }

  async listDeliveryPending(staleBefore: Date, limit: number): Promise<readonly EngagementRecord[]> {
    const out: EngagementRecord[] = [];
    for (const row of this.rows.values()) {
      const record = engagementFromRow(row);
      if (record.kind !== 'brief-request') continue;
      const failed = record.status === 'delivery-failed';
      const stale = record.status === 'received' && record.deliveryAttempts === 0 && Date.parse(record.createdAt) < staleBefore.getTime();
      if (failed || stale) out.push(record);
    }
    return out.slice(0, limit);
  }

  async listNurtureDue(now: Date, limit: number): Promise<readonly EngagementRecord[]> {
    const out: EngagementRecord[] = [];
    for (const row of this.rows.values()) {
      const record = engagementFromRow(row);
      if (record.status !== 'delivered' || !record.consentUpdates || record.nurtureNextAt === '') continue;
      if (Date.parse(record.nurtureNextAt) <= now.getTime()) out.push(record);
    }
    return out.slice(0, limit);
  }

  /** Test helper: the stored row for a request id. */
  row(requestId: string): Record<string, unknown> {
    const row = this.rows.get(requestId);
    if (row === undefined) throw new Error(`no row for ${requestId}`);
    return row;
  }
}

export class FakeCrm implements CrmStore {
  readonly accounts = new Map<string, { id: string; fields: Readonly<Record<string, unknown>> }>();
  readonly contacts: { id: string; fields: Record<string, unknown> }[] = [];
  readonly optedOut = new Set<string>();
  accountCalls = 0;
  failWith: Error | null = null;
  failOptOut: Error | null = null;
  private sequence = 0;
  private readonly engagements: FakeEngagements;
  constructor(engagements: FakeEngagements) {
    this.engagements = engagements;
  }

  async ensureAccount(plan: AccountPlan): Promise<{ readonly id: string }> {
    this.accountCalls += 1;
    if (this.failWith !== null) throw this.failWith;
    const existing = this.accounts.get(plan.key);
    if (existing !== undefined) return { id: existing.id };
    this.sequence += 1;
    const created = { id: `acct-${this.sequence}`, fields: plan.fields };
    this.accounts.set(plan.key, created);
    return { id: created.id };
  }

  async findContactsByEmail(email: string): Promise<readonly ContactMatch[]> {
    if (this.failWith !== null) throw this.failWith;
    return this.contacts.filter((contact) => contact.fields['emailaddress1'] === email).map((contact) => ({ id: contact.id }));
  }

  async createContact(fields: Readonly<Record<string, unknown>>): Promise<ContactMatch> {
    if (this.failWith !== null) throw this.failWith;
    this.sequence += 1;
    const created = { id: `contact-${this.sequence}`, fields: { ...fields } };
    this.contacts.push(created);
    return { id: created.id };
  }

  async markContactOptedOut(contactId: string): Promise<void> {
    if (this.failOptOut !== null) throw this.failOptOut;
    this.optedOut.add(contactId);
  }

  async contactOfEngagement(engagementId: string): Promise<string | null> {
    for (const row of this.engagements.rows.values()) {
      if (row['we_engagementid'] !== engagementId) continue;
      const bind = row['we_Contact@odata.bind'];
      const match = typeof bind === 'string' ? /^\/contacts\((.+)\)$/.exec(bind) : null;
      return match?.[1] ?? null;
    }
    return null;
  }
}

export class FakeSuppression implements SuppressionStore {
  readonly records = new Map<string, SuppressionRecord>();
  failPut: Error | null = null;
  async get(emailHash: string): Promise<SuppressionRecord | null> {
    return this.records.get(emailHash) ?? null;
  }
  async put(emailHash: string, record: SuppressionRecord): Promise<void> {
    if (this.failPut !== null) throw this.failPut;
    this.records.set(emailHash, record);
  }
  async listUnsynced(limit: number): Promise<readonly { emailHash: string; record: SuppressionRecord }[]> {
    return [...this.records].filter(([, record]) => !record.crmSynced).slice(0, limit).map(([emailHash, record]) => ({ emailHash, record }));
  }
}

export const BRIEFS: readonly BriefEntry[] = [
  { id: 'funding-paths', title: 'Funding paths', version: '1.0', pdfPath: 'briefs/funding-paths/v1.0/funding-paths.pdf', htmlPath: 'briefs/funding-paths/v1.0/funding-paths.html' },
  { id: 'company-setup', title: 'Company setup', version: '1.2', pdfPath: 'briefs/company-setup/v1.2/company-setup.pdf', htmlPath: 'briefs/company-setup/v1.2/company-setup.html' },
];

export class FakeRegistry implements BriefRegistry {
  entries: readonly BriefEntry[] = BRIEFS;
  failWith: Error | null = null;
  async list(): Promise<readonly BriefEntry[]> {
    if (this.failWith !== null) throw this.failWith;
    return this.entries;
  }
}

export class FakeLinks implements BriefLinks {
  readonly minted: { id: string; at: number }[] = [];
  failWith: Error | null = null;
  async mintLink(entry: BriefEntry, now: number): Promise<string> {
    if (this.failWith !== null) throw this.failWith;
    this.minted.push({ id: entry.id, at: now });
    return `https://fake.blob.test/briefs/${entry.pdfPath}?sv=2024-11-04&se=FAKE&sp=r&sig=FAKESIGNATURE0123`;
  }
}

export class FakeMailer implements Mailer {
  readonly sent: MailMessage[] = [];
  failWith: Error | null = null;
  async send(message: MailMessage): Promise<void> {
    if (this.failWith !== null) throw this.failWith;
    this.sent.push(message);
  }
}

export class FakeNotifier implements Notifier {
  readonly events: Readonly<Record<string, string | number>>[] = [];
  failWith: Error | null = null;
  async notify(event: Readonly<Record<string, string | number>>): Promise<void> {
    if (this.failWith !== null) throw this.failWith;
    this.events.push(event);
  }
}

export class SequenceIds implements Ids {
  private count = 0;
  requestId(): string {
    this.count += 1;
    return `00000000-0000-4000-8000-${String(this.count).padStart(12, '0')}`;
  }
  token(): string {
    this.count += 1;
    return `TOKEN${String(this.count).padStart(3, '0')}abcdefghijklmnopqrstuvwxyz`;
  }
}

export interface Harness {
  readonly deps: Deps;
  readonly clock: FakeClock;
  readonly rate: FakeRate;
  readonly lock: FakeLock;
  readonly engagements: FakeEngagements;
  readonly crm: FakeCrm;
  readonly suppression: FakeSuppression;
  readonly registry: FakeRegistry;
  readonly links: FakeLinks;
  readonly mailer: FakeMailer;
  readonly notifier: FakeNotifier;
  readonly logs: { level: LogLevel; line: string }[];
  readonly settings: Settings;
}

export function harness(overrides: Partial<Settings> = {}): Harness {
  const clock = new FakeClock();
  const rate = new FakeRate();
  const lock = new FakeLock();
  const engagements = new FakeEngagements(clock);
  const crm = new FakeCrm(engagements);
  const suppression = new FakeSuppression();
  const registry = new FakeRegistry();
  const links = new FakeLinks();
  const mailer = new FakeMailer();
  const notifier = new FakeNotifier();
  const logs: { level: LogLevel; line: string }[] = [];
  const settings: Settings = {
    allowedOrigins: ['https://worldenterprise.org', 'https://preview.example.test'],
    siteOrigin: 'https://worldenterprise.org',
    apiOrigin: 'https://intake.worldenterprise.org',
    unsubscribeKey: 'test-unsubscribe-key-0123456789',
    nurtureEnabled: false,
    footerAddress: '',
    ...overrides,
  };
  const deps: Deps = {
    contract: loadFixtureContract(),
    settings,
    clock,
    ids: new SequenceIds(),
    rate,
    lock,
    engagements,
    crm,
    suppression,
    registry,
    links,
    mailer,
    notifier,
    log: createLogger({ write: (level, line) => logs.push({ level, line }) }),
  };
  return { deps, clock, rate, lock, engagements, crm, suppression, registry, links, mailer, notifier, logs, settings };
}

export interface RequestInit {
  readonly method?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly query?: Readonly<Record<string, string>>;
}

export function request(init: RequestInit = {}): HttpRequestLike {
  const headers = new Map(Object.entries(init.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]));
  const body = init.body ?? '';
  return {
    method: init.method ?? 'POST',
    header: (name) => headers.get(name.toLowerCase()),
    readBody: async (maxBytes) => (Buffer.byteLength(body) > maxBytes ? null : body),
    query: (name) => init.query?.[name],
  };
}

export const ORIGIN = 'https://worldenterprise.org';
export const CLIENT_IP = '203.0.113.7';

/** A POST from the production site with a JSON body. */
export function jsonPost(payload: unknown, extra: Readonly<Record<string, string>> = {}, init: RequestInit = {}): HttpRequestLike {
  return request({ method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json', 'x-azure-clientip': CLIENT_IP, ...extra }, body: JSON.stringify(payload), ...init });
}

export function formPost(fields: Readonly<Record<string, string>>, extra: Readonly<Record<string, string>> = {}): HttpRequestLike {
  return request({
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/x-www-form-urlencoded', 'x-azure-clientip': CLIENT_IP, ...extra },
    body: new URLSearchParams(fields).toString(),
  });
}

let counter = 0;
export function uuid(): string {
  counter += 1;
  return `6f1c2d3e-8a4b-4c5d-9e0f-${String(counter).padStart(12, '0')}`;
}

const BASE = {
  name: 'Ada Example', email: 'ada@example.org', company: '', stage: '', seats: '', topic: '', message: '', briefId: '', companyUrl: '',
  partnerCategory: '', investorKind: '', focus: '', offer: '', consent: true, consentUpdates: false, website: '',
  startedAt: '2026-10-12T14:00:00.000Z', submittedAt: '2026-10-12T14:00:41.000Z', page: '/briefs/funding-paths/',
};

/** A valid payload for each kind, matching the required matrix. */
export function validPayload(kind: string, overrides: Readonly<Record<string, unknown>> = {}): Record<string, unknown> {
  const byKind: Record<string, Record<string, unknown>> = {
    apply: { audience: 'startup', stage: 'validating', seats: 'Product design x1', message: 'Hello' },
    contact: { audience: 'startup', topic: 'general', message: 'A question.' },
    newsletter: { audience: '', name: '' },
    'brief-request': { audience: 'startup', briefId: 'funding-paths' },
    'investor-interest': { audience: 'investor', company: 'Example Capital', companyUrl: 'https://example.org', investorKind: 'fund', focus: 'Seed-stage software' },
    'partner-enquiry': { audience: 'partner', company: 'Example Cloud', companyUrl: 'https://example.org/partners', partnerCategory: 'cloud-credits', offer: 'Hosting credits for early teams.' },
  };
  const payload: Record<string, unknown> = { ...BASE, form: kind, requestId: kind === 'newsletter' ? '' : uuid(), ...byKind[kind], ...overrides };
  return payload;
}

export { REVIEW, STATUS };
