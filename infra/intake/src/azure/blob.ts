/**
 * State kept in private blobs: rate counters, the contact lock, the suppression list and the brief registry reader. All of
 * it is built on `BlobPort`, a five-method view of one container, so the policy here is tested against an in-memory port
 * and `blob-sdk.ts` carries the only SDK calls.
 *
 * Counters use ETag compare-and-swap rather than leases: a crashed instance can never leave one stuck. The contact lock
 * does use a lease, because it has to exclude other instances for the length of a Dataverse round trip, and a lease
 * expires by itself.
 */

import { sha256Hex } from '../logic/crypto.ts';
import { consume, type RateDecision, type RateRecord } from '../logic/rate.ts';
import type { BriefEntry, BriefRegistry, Clock, LockPort, RateStore, SuppressionRecord, SuppressionStore } from '../service/ports.ts';

export interface BlobRead {
  readonly text: string;
  readonly etag: string;
}

export type BlobCondition =
  | { readonly kind: 'absent' }
  | { readonly kind: 'etag'; readonly etag: string }
  | { readonly kind: 'any' };

export interface BlobPort {
  get(name: string): Promise<BlobRead | null>;
  /** Writes under a condition. `conflict` means the condition failed (someone else wrote first); other failures throw. */
  put(name: string, text: string, condition: BlobCondition): Promise<'ok' | 'conflict'>;
  delete(name: string): Promise<void>;
  list(prefix: string, limit: number): Promise<readonly string[]>;
  /** Creates the blob when absent, then leases it. `null` when another holder has it. */
  acquireLease(name: string, seconds: number): Promise<string | null>;
  releaseLease(name: string, leaseId: string): Promise<void>;
}

export class StateError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = 'StateError';
    this.code = code;
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new StateError('state_corrupt');
  }
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

const CAS_ATTEMPTS = 6;

export class BlobRateStore implements RateStore {
  private readonly blobs: BlobPort;

  constructor(blobs: BlobPort) {
    this.blobs = blobs;
  }

  async consume(key: string, now: number): Promise<RateDecision> {
    const name = `rate/${sha256Hex(key)}.json`;
    for (let attempt = 0; attempt < CAS_ATTEMPTS; attempt += 1) {
      const existing = await this.blobs.get(name);
      const decision = consume(existing === null ? null : readCounter(existing.text), now);
      // A refused request changes nothing, so it writes nothing.
      if (!decision.allowed) return decision;
      const written = await this.blobs.put(name, JSON.stringify(decision.record), existing === null ? { kind: 'absent' } : { kind: 'etag', etag: existing.etag });
      if (written === 'ok') return decision;
    }
    throw new StateError('rate_contention');
  }
}

function readCounter(text: string): RateRecord | null {
  const record = asRecord(parseJson(text));
  const windowStart = record?.['windowStart'];
  const count = record?.['count'];
  if (typeof windowStart !== 'number' || typeof count !== 'number') return null;
  return { windowStart, count };
}

export interface LockOptions {
  readonly leaseSeconds?: number;
  readonly waitMs?: number;
  readonly pollMs?: number;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly clock: Clock;
}

export class BlobLock implements LockPort {
  private readonly blobs: BlobPort;
  private readonly options: LockOptions;

  constructor(blobs: BlobPort, options: LockOptions) {
    this.blobs = blobs;
    this.options = options;
  }

  async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const name = `lock/${sha256Hex(key)}`;
    const sleep = this.options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
    const deadline = this.options.clock.now() + (this.options.waitMs ?? 4000);
    let leaseId = await this.blobs.acquireLease(name, this.options.leaseSeconds ?? 30);
    while (leaseId === null) {
      if (this.options.clock.now() >= deadline) throw new StateError('lock_unavailable');
      await sleep(this.options.pollMs ?? 150);
      leaseId = await this.blobs.acquireLease(name, this.options.leaseSeconds ?? 30);
    }
    try {
      return await fn();
    } finally {
      try {
        await this.blobs.releaseLease(name, leaseId);
      } catch {
        // A lease that cannot be released expires on its own after leaseSeconds; the work already finished.
      }
    }
  }
}

const SUPPRESSION = 'suppression/';
const PENDING = 'suppression-pending/';

export class BlobSuppression implements SuppressionStore {
  private readonly blobs: BlobPort;

  constructor(blobs: BlobPort) {
    this.blobs = blobs;
  }

  async get(emailHash: string): Promise<SuppressionRecord | null> {
    const read = await this.blobs.get(`${SUPPRESSION}${emailHash}.json`);
    return read === null ? null : readSuppression(read.text);
  }

  /**
   * The main record is written first: it is what stops mail. The pending marker lets the sweep find unsynced records
   * without reading every suppression.
   */
  async put(emailHash: string, record: SuppressionRecord): Promise<void> {
    await this.blobs.put(`${SUPPRESSION}${emailHash}.json`, JSON.stringify(record), { kind: 'any' });
    if (record.crmSynced) await this.blobs.delete(`${PENDING}${emailHash}`);
    else await this.blobs.put(`${PENDING}${emailHash}`, '', { kind: 'any' });
  }

  async listUnsynced(limit: number): Promise<readonly { readonly emailHash: string; readonly record: SuppressionRecord }[]> {
    const found: { emailHash: string; record: SuppressionRecord }[] = [];
    for (const name of await this.blobs.list(PENDING, limit)) {
      const emailHash = name.slice(PENDING.length);
      const record = await this.get(emailHash);
      if (record !== null && !record.crmSynced) found.push({ emailHash, record });
    }
    return found;
  }
}

function readSuppression(text: string): SuppressionRecord {
  const record = asRecord(parseJson(text));
  if (typeof record?.['at'] !== 'string' || typeof record['engagementId'] !== 'string') throw new StateError('state_corrupt');
  return { at: record['at'], crmSynced: record['crmSynced'] === true, engagementId: record['engagementId'] };
}

const REGISTRY_BLOB = 'briefs.json';
const REGISTRY_TTL_MS = 60_000;

/** Reads the registry the render job published, and keeps it for a minute. A malformed registry is an error, never an empty list. */
export class BlobBriefRegistry implements BriefRegistry {
  private readonly blobs: BlobPort;
  private readonly clock: Clock;
  private cached: { readonly at: number; readonly entries: readonly BriefEntry[] } | null = null;

  constructor(blobs: BlobPort, clock: Clock) {
    this.blobs = blobs;
    this.clock = clock;
  }

  async list(): Promise<readonly BriefEntry[]> {
    const now = this.clock.now();
    if (this.cached !== null && now - this.cached.at < REGISTRY_TTL_MS) return this.cached.entries;
    const read = await this.blobs.get(REGISTRY_BLOB);
    if (read === null) throw new StateError('registry_missing');
    const entries = parseRegistry(read.text);
    this.cached = { at: now, entries };
    return entries;
  }
}

export function parseRegistry(text: string): readonly BriefEntry[] {
  const root = asRecord(parseJson(text));
  const briefs = root?.['briefs'];
  if (root?.['version'] !== 1 || !Array.isArray(briefs)) throw new StateError('registry_invalid');
  return briefs.map((item: unknown): BriefEntry => {
    const entry = asRecord(item);
    const id = entry?.['id'];
    const title = entry?.['title'];
    const version = entry?.['version'];
    const pdfPath = entry?.['pdfPath'];
    const htmlPath = entry?.['htmlPath'];
    if (typeof id !== 'string' || typeof title !== 'string' || typeof version !== 'string' || typeof pdfPath !== 'string' || typeof htmlPath !== 'string') {
      throw new StateError('registry_invalid');
    }
    const prefix = `briefs/${id}/v${version}/`;
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id) || !/^[0-9]+(\.[0-9]+){0,2}$/.test(version) || !pdfPath.startsWith(prefix) || !htmlPath.startsWith(prefix) || pdfPath.includes('..') || htmlPath.includes('..')) {
      throw new StateError('registry_invalid');
    }
    return { id, title, version, pdfPath, htmlPath };
  });
}
