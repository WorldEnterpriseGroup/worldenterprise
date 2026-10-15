/**
 * The authorization status of SBIR and STTR, verified from SBA, DOE, NASA and a law-firm summary of the statute on the retrieval date
 * (WP-34, #83). The statement always carries its date. It is a fact that changes, so it names where to check the latest.
 */
import type { SbirSourceId } from './sources.ts';

export const STATUS_AS_OF = '2026-10-15';
export const STATUS_AS_OF_LABEL = 'October 15, 2026';
export const AUTHORIZED_THROUGH = 'September 30, 2031';
export const LAPSE_START = 'September 30, 2025';
export const SIGNED_ON = 'April 13, 2026';
export const CHECK_LATEST = 'Always check sbir.gov and the agency’s own SBIR/STTR page for the latest: agencies are still updating policies and solicitations to match the new law.';

export interface StatusEvent {
  readonly date: string;
  /** ISO date, for ordering and the dateTime attribute. */
  readonly iso: string;
  readonly text: string;
  readonly sources: readonly SbirSourceId[];
}

export const STATUS_HEADLINE = `SBIR and STTR are authorized through ${AUTHORIZED_THROUGH}.`;

export const STATUS_BODY: readonly string[] = [
  `As of ${STATUS_AS_OF_LABEL}: the programs are open again. The earlier authority expired on ${LAPSE_START}, and for a little over six months agencies could not make new awards. President Trump signed S. 3971, the Small Business Innovation and Economic Security Act, on ${SIGNED_ON}. It extends both programs through ${AUTHORIZED_THROUGH}.`,
  'The law keeps the programs and tightens how they are run. Agencies must screen owners and key personnel for ties to countries of concern. From fiscal year 2027 agencies set limits on how many proposals one company may submit. A new Strategic Breakthrough award, a large Phase II for agencies with big SBIR budgets, is added (the summary below is from a law-firm alert; read the statute and the agency notice before you rely on it).',
  CHECK_LATEST,
];

export const STATUS_EVENTS: readonly StatusEvent[] = [
  {
    date: LAPSE_START,
    iso: '2025-09-30',
    text: 'The previous authorization expired. New awards under both programs paused across agencies.',
    sources: ['crowell-lapse'],
  },
  {
    date: 'March 3, 2026',
    iso: '2026-03-03',
    text: 'The Senate passed S. 3971.',
    sources: ['crowell-lapse'],
  },
  {
    date: 'March 17, 2026',
    iso: '2026-03-17',
    text: 'The House passed S. 3971.',
    sources: ['crowell-lapse'],
  },
  {
    date: SIGNED_ON,
    iso: '2026-04-13',
    text: `S. 3971 was signed into law. SBA reports the programs now run through ${AUTHORIZED_THROUGH}. DOE’s SBIR page states the programs were reauthorized effective this date.`,
    sources: ['sba-release-26-43', 'doe-sbir'],
  },
  {
    date: 'October 14, 2026',
    iso: '2026-10-14',
    text: 'NASA’s SBIR/STTR page lists solicitations open now and decisions scheduled for November and December 2026.',
    sources: ['nasa-sbir'],
  },
];

/** What changed in the law, in plain words. Each line is from the law-firm summary of S. 3971 unless it names another source. */
export const LAW_CHANGES: readonly { readonly title: string; readonly body: string; readonly sources: readonly SbirSourceId[] }[] = [
  {
    title: 'Five and a half more years',
    body: `Authority now runs through ${AUTHORIZED_THROUGH}, the longest extension in the programs’ history according to a university federal-relations office, and the longest period of certainty small businesses have had in years.`,
    sources: ['sba-release-26-43', 'uw-federal-relations'],
  },
  {
    title: 'Foreign-risk screening',
    body: 'Agencies must look at owners, covered individuals and key personnel for foreign affiliations, investment ties, licensing or joint ventures with countries of concern. An applicant turned away on security grounds is told in writing and may apply again in a later cycle.',
    sources: ['crowell-lapse'],
  },
  {
    title: 'Proposal limits from fiscal year 2027',
    body: 'Agencies set their own limits on proposals per company, per solicitation or per topic, and announce them at least 90 days before the fiscal year starts. Plan a few strong proposals, not many.',
    sources: ['crowell-lapse'],
  },
  {
    title: 'Strategic Breakthrough awards',
    body: 'A new kind of Phase II for agencies whose yearly SBIR spending tops $100 million: awards that may reach $30 million over up to 48 months, for companies with a prior Phase I or II award and matching funds equal to the award.',
    sources: ['crowell-lapse'],
  },
  {
    title: 'Phase III and plain procedures',
    body: 'SBA must update its policy directive to make the move from research into purchase by an agency easier, and agencies are to standardize Phase I, II and III procedures and model contracts where practicable.',
    sources: ['crowell-lapse'],
  },
];
