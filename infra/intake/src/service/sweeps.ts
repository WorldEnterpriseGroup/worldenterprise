/**
 * The two timers. The retry sweep finishes brief emails that failed or never ran and reconciles unsubscribes whose
 * Dataverse update did not complete. The nurture sweep sends the day 3, 10 and 21 follow-ups, and does nothing at all
 * unless NURTURE_ENABLED is true: when it is off the sweep makes no read and no send.
 */

import { errorCode } from '../logic/log.ts';
import { NURTURE_STAGES } from '../logic/mail.ts';
import { hasExhaustedRetries, isRetryDue, MAX_DELIVERY_ATTEMPTS, NURTURE_DAYS } from '../logic/schedule.ts';
import type { Deps } from './deps.ts';
import { sendFollowUp, sendRequestedBrief } from './deliver.ts';
import { syncCrm } from './unsubscribe.ts';

const STALE_RECEIVED_MS = 10 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const SWEEP_LIMIT = 25;

export interface RetrySummary {
  readonly delivered: number;
  readonly failed: number;
  readonly reconciled: number;
}

export async function retrySweep(deps: Deps): Promise<RetrySummary> {
  const now = deps.clock.now();
  let delivered = 0;
  let failed = 0;
  let reconciled = 0;

  let pending: Awaited<ReturnType<Deps['engagements']['listDeliveryPending']>> = [];
  try {
    pending = await deps.engagements.listDeliveryPending(new Date(now - STALE_RECEIVED_MS), SWEEP_LIMIT);
  } catch (error) {
    deps.log.error('retry_list_failed', { job: 'retry', code: errorCode(error) });
  }
  for (const record of pending) {
    if (record.status === 'delivery-failed' && !isRetryDue(record.deliveryAttempts, record.lastAttemptAt, now)) continue;
    if (hasExhaustedRetries(record.deliveryAttempts)) continue;
    const attempts = record.deliveryAttempts + 1;
    try {
      await sendRequestedBrief(deps, record);
      const at = new Date(deps.clock.now());
      await deps.engagements.update(record.id, { status: 'delivered', deliveryAttempts: attempts, lastAttemptAt: at, deliveredAt: at });
      delivered += 1;
    } catch (error) {
      failed += 1;
      deps.log.error(attempts >= MAX_DELIVERY_ATTEMPTS ? 'delivery_exhausted' : 'delivery_failed', { requestId: record.requestId, kind: record.kind, attempt: attempts, code: errorCode(error) });
      try {
        await deps.engagements.update(record.id, { status: 'delivery-failed', deliveryAttempts: attempts, lastAttemptAt: new Date(deps.clock.now()) });
      } catch (updateError) {
        deps.log.error('status_update_failed', { requestId: record.requestId, code: errorCode(updateError) });
      }
    }
  }

  try {
    for (const { emailHash, record } of await deps.suppression.listUnsynced(SWEEP_LIMIT)) {
      try {
        await syncCrm(deps, record.engagementId);
        await deps.suppression.put(emailHash, { ...record, crmSynced: true });
        reconciled += 1;
      } catch (error) {
        deps.log.error('unsubscribe_crm_sync_failed', { job: 'retry', code: errorCode(error) });
      }
    }
  } catch (error) {
    deps.log.error('suppression_list_failed', { job: 'retry', code: errorCode(error) });
  }

  deps.log.info('retry_sweep_done', { job: 'retry', count: delivered + failed + reconciled });
  return { delivered, failed, reconciled };
}

export interface NurtureSummary {
  readonly enabled: boolean;
  readonly sent: number;
  readonly suppressed: number;
}

export async function nurtureSweep(deps: Deps): Promise<NurtureSummary> {
  if (!deps.settings.nurtureEnabled) {
    deps.log.info('nurture_disabled', { job: 'nurture' });
    return { enabled: false, sent: 0, suppressed: 0 };
  }
  const now = deps.clock.now();
  let sent = 0;
  let suppressed = 0;
  let due: Awaited<ReturnType<Deps['engagements']['listNurtureDue']>> = [];
  try {
    due = await deps.engagements.listNurtureDue(new Date(now), SWEEP_LIMIT * 2);
  } catch (error) {
    deps.log.error('nurture_list_failed', { job: 'nurture', code: errorCode(error) });
  }
  for (const record of due) {
    const stage = record.nurtureStage + 1;
    if (stage > NURTURE_STAGES) continue;
    try {
      const outcome = await sendFollowUp(deps, record, stage);
      if (outcome === 'suppressed') {
        suppressed += 1;
        await deps.engagements.update(record.id, { nurtureNextAt: null });
        continue;
      }
      const gapDays = (NURTURE_DAYS[stage] ?? 0) - (NURTURE_DAYS[stage - 1] ?? 0);
      await deps.engagements.update(record.id, { nurtureStage: stage, nurtureNextAt: stage >= NURTURE_STAGES ? null : new Date(now + gapDays * DAY_MS) });
      sent += 1;
    } catch (error) {
      deps.log.error('nurture_failed', { requestId: record.requestId, stage, code: errorCode(error) });
    }
  }
  deps.log.info('nurture_sweep_done', { job: 'nurture', count: sent, outcome: 'ok' });
  return { enabled: true, sent, suppressed };
}
