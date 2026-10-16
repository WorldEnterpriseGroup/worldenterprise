/**
 * The authorization status of SBIR and STTR, verified from SBA, DOE, NASA and the SBIR.gov award data on the retrieval date
 * (WP-34, #83). The statement always carries its date. It is a fact that changes, so it names where to check the latest.
 */
import type { SbirSourceId } from './sources.ts';

export const STATUS_AS_OF = '2026-10-15';
export const STATUS_AS_OF_LABEL = 'October 15, 2026';
export const AUTHORIZED_THROUGH = 'September 30, 2031';
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
  `As of ${STATUS_AS_OF_LABEL}: the programs are open. President Trump signed S. 3971, the Small Business Innovation and Economic Security Act, on ${SIGNED_ON}. SBA reports that it reauthorizes SBIR and STTR through ${AUTHORIZED_THROUGH}. The public award data shows new awards nearly stopped from October 2025 to March 2026, before the new law.`,
  'SBA describes the reforms as strengthening program integrity, protecting against foreign adversaries, expanding access for new innovative businesses and making sure taxpayer dollars deliver measurable results. Agencies are still publishing how they will apply the new law, so read the current solicitation and the agency notice before you rely on any detail.',
  CHECK_LATEST,
];

export const STATUS_EVENTS: readonly StatusEvent[] = [
  {
    date: 'October 2025 to March 2026',
    iso: '2025-10-01',
    text: 'New awards in the public SBIR.gov data fell from 1,479 in the same six months a year earlier to 243. The programs were paused in practice.',
    sources: ['sbir-award-data'],
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
  {
    date: AUTHORIZED_THROUGH,
    iso: '2031-09-30',
    text: 'The date through which SBA reports the programs are authorized: five years of certainty for a founder who plans a long run.',
    sources: ['sba-release-26-43'],
  },
];

/** What changed in the law, in plain words, as SBA and the agencies describe it. */
export const LAW_CHANGES: readonly { readonly title: string; readonly body: string; readonly sources: readonly SbirSourceId[] }[] = [
  {
    title: 'Five more years',
    body: `Authority now runs through ${AUTHORIZED_THROUGH}. SBA says the law backs America’s Seed Fund programs for five years, the longest period of certainty small businesses have had in a while.`,
    sources: ['sba-release-26-43'],
  },
  {
    title: 'Program integrity and foreign-risk protection',
    body: 'SBA says the law strengthens program integrity and protects against foreign adversaries. DOE and NIH each publish a foreign risk management or disclosure page for applicants: read yours before you apply.',
    sources: ['sba-release-26-43', 'doe-sbir', 'nih-seed'],
  },
  {
    title: 'More access for new businesses',
    body: 'SBA says the reforms expand access to new innovative businesses and aim for measurable results from taxpayer dollars. How each agency applies this is still being published.',
    sources: ['sba-release-26-43'],
  },
];
