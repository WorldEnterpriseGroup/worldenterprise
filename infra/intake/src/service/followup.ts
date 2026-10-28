/**
 * The steps that follow the durable engagement write: the Dynamics 365 Lead, and the notification to the World Enterprise
 * inbox. Each step records its result on the engagement row (`we_Lead`, `we_notifiedat`) and never throws, so a failure
 * cannot turn a stored submission into an error for the visitor. Whatever is still undone is found by the retry sweep,
 * which calls the same functions.
 */

import { errorCode } from '../logic/log.ts';
import { buildLeadFields, buildNotifyEvent, makesLead, type EngagementRecord } from '../logic/mapping.ts';
import type { Deps } from './deps.ts';

/** Creates the Lead when the form makes one and the row has none. Returns the row with the Lead linked, or unchanged on failure. */
export async function ensureLeadFor(deps: Deps, record: EngagementRecord): Promise<EngagementRecord> {
  if (!makesLead(record.kind) || record.leadId !== '') return record;
  let leadId: string;
  try {
    leadId = (await deps.crm.ensureLead(record.requestId, buildLeadFields(record))).id;
  } catch (error) {
    deps.log.error('lead_failed', { requestId: record.requestId, kind: record.kind, code: errorCode(error) });
    return record;
  }
  const linked = { ...record, leadId };
  try {
    await deps.engagements.update(record.id, { leadId });
  } catch (error) {
    // The Lead exists. The next pass finds it again by the request id, so the link is only delayed.
    deps.log.error('lead_link_failed', { requestId: record.requestId, kind: record.kind, code: errorCode(error) });
  }
  return linked;
}

/** Sends the notification once. `true` means it was accepted and the row is marked. */
export async function notifyFor(deps: Deps, record: EngagementRecord): Promise<boolean> {
  if (record.notifiedAt !== '') return true;
  try {
    await deps.notifier.notify(buildNotifyEvent(record, deps.settings.crmUrl));
  } catch (error) {
    deps.log.warn('notify_failed', { requestId: record.requestId, kind: record.kind, code: errorCode(error) });
    return false;
  }
  try {
    await deps.engagements.update(record.id, { notifiedAt: new Date(deps.clock.now()) });
  } catch (error) {
    // The email is on its way; an unmarked row would be notified again by the sweep, so say so loudly.
    deps.log.error('notify_mark_failed', { requestId: record.requestId, kind: record.kind, code: errorCode(error) });
  }
  return true;
}
