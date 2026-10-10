/** Retry and nurture timing. Pure functions over timestamps so the sweeps can be tested with a fake clock. */

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** Wait before attempt N+1 after N failed attempts. After the last entry the row stays `delivery-failed` and an alert is raised. */
export const RETRY_BACKOFF_MS: readonly number[] = [5 * MINUTE_MS, 15 * MINUTE_MS, 60 * MINUTE_MS, 4 * 60 * MINUTE_MS, 12 * 60 * MINUTE_MS];
export const MAX_DELIVERY_ATTEMPTS = RETRY_BACKOFF_MS.length + 1;

export function isRetryDue(attempts: number, lastAttemptAt: string, now: number): boolean {
  if (attempts >= MAX_DELIVERY_ATTEMPTS) return false;
  const last = Date.parse(lastAttemptAt);
  if (Number.isNaN(last)) return true;
  const wait = RETRY_BACKOFF_MS[Math.max(0, attempts - 1)] ?? 0;
  return now - last >= wait;
}

export function hasExhaustedRetries(attempts: number): boolean {
  return attempts >= MAX_DELIVERY_ATTEMPTS;
}

/** Days after delivery for follow-up 1, 2 and 3. */
export const NURTURE_DAYS: readonly number[] = [3, 10, 21];

/** When follow-up number `stage` (1-based) is due, given the delivery time. `null` when there is no such stage. */
export function nurtureDueAt(deliveredAt: number, stage: number): number | null {
  const days = NURTURE_DAYS[stage - 1];
  return days === undefined ? null : deliveredAt + days * DAY_MS;
}

/** The brief link lives 48 hours. The unsubscribe link never expires: a person must always be able to stop the emails. */
export const SAS_TTL_MS = 48 * 60 * MINUTE_MS;
/** Backdate the SAS start so a small clock difference between this host and Storage never makes a fresh link invalid. */
export const SAS_CLOCK_SKEW_MS = 5 * MINUTE_MS;
