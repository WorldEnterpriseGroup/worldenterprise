/**
 * Fixed-window rate limit decision. The Azure adapter stores one counter record per key and passes it through `consume`
 * under a blob lease; this function holds the policy so a fake clock can test it.
 */

export const RATE_LIMIT = 5;
export const RATE_WINDOW_MS = 60 * 60 * 1000;

export interface RateRecord {
  readonly windowStart: number;
  readonly count: number;
}

export interface RateDecision {
  readonly allowed: boolean;
  readonly record: RateRecord;
  /** Whole seconds until the window ends, at least 1. Present for every decision; the caller sends it only on a refusal. */
  readonly retryAfterSeconds: number;
}

export function consume(previous: RateRecord | null, now: number, limit: number = RATE_LIMIT, windowMs: number = RATE_WINDOW_MS): RateDecision {
  const expired = previous === null || now - previous.windowStart >= windowMs || now < previous.windowStart;
  const base: RateRecord = expired ? { windowStart: now, count: 0 } : previous;
  const retryAfterSeconds = Math.max(1, Math.ceil((base.windowStart + windowMs - now) / 1000));
  if (base.count >= limit) return { allowed: false, record: base, retryAfterSeconds };
  return { allowed: true, record: { windowStart: base.windowStart, count: base.count + 1 }, retryAfterSeconds };
}

/** The two counters every submission consumes: the client address and the email address, scoped to the kind. */
export function rateKeys(kind: string, addressHash: string, emailHash: string | null): readonly string[] {
  const keys = [`ip:${kind}:${addressHash}`];
  if (emailHash !== null) keys.push(`email:${kind}:${emailHash}`);
  return keys;
}
