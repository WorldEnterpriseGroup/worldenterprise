/**
 * Sending mail for a stored engagement: the requested brief, and the follow-ups. Used by the intake handler, the retry
 * sweep and the nurture sweep, so the link, the unsubscribe token and the suppression rule live in one place.
 */

import { decryptToken, keyHash } from '../logic/crypto.ts';
import { errorCode } from '../logic/log.ts';
import { renderBriefEmail, renderNurtureEmail, type MailContext } from '../logic/mail.ts';
import type { EngagementRecord } from '../logic/mapping.ts';
import type { BriefEntry } from './ports.ts';
import type { Deps } from './deps.ts';

export class DeliveryError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = 'DeliveryError';
    this.code = code;
  }
}

export async function findBrief(deps: Deps, briefId: string): Promise<BriefEntry | null> {
  const entries = await deps.registry.list();
  return entries.find((entry) => entry.id === briefId) ?? null;
}

export function emailHashOf(email: string): string {
  return keyHash('email', email);
}

function unsubscribeUrl(deps: Deps, record: EngagementRecord): string {
  const token = decryptToken(record.tokenCiphertext, deps.settings.unsubscribeKey);
  return `${deps.settings.apiOrigin}/api/unsubscribe?token=${encodeURIComponent(token)}`;
}

function baseContext(deps: Deps, record: EngagementRecord, entry: BriefEntry, briefUrl: string | null): MailContext {
  return {
    name: record.name,
    briefTitle: entry.title,
    briefId: entry.id,
    siteOrigin: deps.settings.siteOrigin,
    briefUrl,
    unsubscribeUrl: unsubscribeUrl(deps, record),
    footerAddress: deps.settings.footerAddress,
  };
}

/**
 * Sends the brief the person asked for. This is a reply to an explicit request, so it is not held back by a follow-up
 * suppression. Throws DeliveryError on any failure; the caller records `delivery-failed`.
 */
export async function sendRequestedBrief(deps: Deps, record: EngagementRecord): Promise<void> {
  try {
    const entry = await findBrief(deps, record.briefId);
    if (entry === null) throw new DeliveryError('brief_not_published');
    const url = await deps.links.mintLink(entry, deps.clock.now());
    await deps.mailer.send(renderBriefEmail(record.email, baseContext(deps, record, entry, url)));
  } catch (error) {
    throw error instanceof DeliveryError ? error : new DeliveryError(errorCode(error));
  }
}

export type FollowUpOutcome = 'sent' | 'suppressed';

/** Sends follow-up number `stage`. Suppression is read immediately before the send, every time. */
export async function sendFollowUp(deps: Deps, record: EngagementRecord, stage: number): Promise<FollowUpOutcome> {
  const suppressed = await deps.suppression.get(emailHashOf(record.email));
  if (suppressed !== null) return 'suppressed';
  try {
    const entry = await findBrief(deps, record.briefId);
    if (entry === null) throw new DeliveryError('brief_not_published');
    await deps.mailer.send(renderNurtureEmail(record.email, stage, baseContext(deps, record, entry, null)));
    return 'sent';
  } catch (error) {
    throw error instanceof DeliveryError ? error : new DeliveryError(errorCode(error));
  }
}
