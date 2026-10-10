/**
 * The sources ledger rule (docs/wave8-contracts.md, section 9): every source a document cites was fetched in the writing session and the
 * package's sources file records the fetch. `checkSourcesFile` is pure so the test can run it over the real files and over fabricated
 * ones that break each rule. The host allowlist is here, in the test, and only a decision extends it (OP-HOSTS).
 */

export interface FetchRecord {
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly publisher: string;
  /** ISO 8601 timestamp, UTC. */
  readonly fetchedAt: string;
  readonly status: number;
  readonly tool: string;
}

export type ClaimKind = 'statistic' | 'regulation' | 'definition' | 'paraphrase';

export interface ClaimRecord {
  readonly id: string;
  readonly sentence: string;
  readonly kind: ClaimKind;
  readonly sourceId: string;
  readonly locator: string;
  readonly quote?: string;
}

export interface DocumentRecord {
  readonly path: string;
  readonly claims?: readonly ClaimRecord[];
}

export interface MarkerRecord {
  readonly path: string;
  readonly rule: string;
  readonly reason: string;
  readonly sourceId: string;
}

export interface SourcesFile {
  readonly wp: string;
  readonly fetches: readonly FetchRecord[];
  readonly documents?: readonly DocumentRecord[];
  readonly markers?: readonly MarkerRecord[];
}

/** What the checker needs to know about one content file: read from the file, never from the sources file. */
export interface DocumentFacts {
  readonly path: string;
  readonly sources: readonly { readonly id: string; readonly url: string; readonly accessed: string }[];
  readonly noStatistics: boolean;
  /** The `data-claim-allow` and `data-generic-definition` markers the file carries: `claim-allow:<rule>` or `generic-definition`. */
  readonly markers: readonly string[];
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Host allowlist
// ---------------------------------------------------------------------------------------------------------------------------------

/** Government and regulator domains, matched as a domain suffix. Other national and state agency domains are added by decision. */
const GOVERNMENT_SUFFIXES: readonly string[] = ['.gov', '.gov.uk', '.gov.au', '.gov.sg', '.gc.ca', '.europa.eu', '.mil', '.state.us', '.parliament.uk', '.legislation.gov.uk'];

/** Standards and law bodies, and the publishers of the instruments an article describes (matched as the host or a subdomain of it). */
const STANDARDS_AND_LAW_HOSTS: readonly string[] = [
  'iso.org', 'w3.org', 'ietf.org', 'owasp.org', 'law.cornell.edu', 'ecfr.gov', 'oecd.org', 'wto.org',
  // The SAFE publisher and the publishers of model documents.
  'ycombinator.com', 'nvca.org', 'cooleygo.com',
];

/** Universities and academic publishers. */
const UNIVERSITY_SUFFIXES: readonly string[] = ['.edu', '.ac.uk', '.edu.au'];

/** Vendor documentation hosts. They source an attributed vendor claim only, never a statistic or a regulation. */
const VENDOR_DOCUMENTATION_HOSTS: readonly string[] = [
  'developer.mozilla.org', 'web.dev', 'docs.stripe.com', 'docs.github.com', 'learn.microsoft.com', 'docs.aws.amazon.com', 'cloud.google.com',
  'sre.google', 'paulgraham.com',
];

const onHost = (host: string, hosts: readonly string[]): boolean => hosts.some((h) => host === h || host.endsWith(`.${h}`));
const onSuffix = (host: string, suffixes: readonly string[]): boolean => suffixes.some((s) => host.endsWith(s) || host === s.slice(1));

export type HostClass = 'government' | 'standards' | 'university' | 'vendor' | 'unlisted';

export function classifyHost(url: string): HostClass {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return 'unlisted';
  }
  if (onSuffix(host, GOVERNMENT_SUFFIXES)) return 'government';
  if (onHost(host, STANDARDS_AND_LAW_HOSTS)) return 'standards';
  if (onSuffix(host, UNIVERSITY_SUFFIXES)) return 'university';
  if (onHost(host, VENDOR_DOCUMENTATION_HOSTS)) return 'vendor';
  return 'unlisted';
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The check
// ---------------------------------------------------------------------------------------------------------------------------------

const MAX_QUOTE_WORDS = 25;
const wordCount = (text: string): number => text.split(/\s+/).filter(Boolean).length;

/** The calendar date (UTC) of an ISO timestamp, or null when it is not one. */
export function fetchDate(fetchedAt: string): string | null {
  const time = Date.parse(fetchedAt);
  return Number.isNaN(time) ? null : new Date(time).toISOString().slice(0, 10);
}

/**
 * The problems with one sources file against the documents it covers. `facts` maps a repository path to what the file says about itself.
 * An empty list means the file holds.
 */
export function checkSourcesFile(file: SourcesFile, facts: ReadonlyMap<string, DocumentFacts>): string[] {
  const problems: string[] = [];
  const at = `${file.wp}`;

  const byId = new Map<string, FetchRecord>();
  const byUrl = new Map<string, FetchRecord>();
  for (const f of file.fetches) {
    if (byId.has(f.id)) problems.push(`${at}: fetch id "${f.id}" is used twice`);
    byId.set(f.id, f);
    byUrl.set(f.url, f);
    if (f.status !== 200) problems.push(`${at}: fetch "${f.id}" returned status ${f.status}; a source is a page that loaded`);
    if (fetchDate(f.fetchedAt) === null) problems.push(`${at}: fetch "${f.id}" has no valid fetchedAt timestamp`);
    if (!/^https:\/\//.test(f.url)) problems.push(`${at}: fetch "${f.id}" is not an https URL`);
    if (classifyHost(f.url) === 'unlisted') problems.push(`${at}: fetch "${f.id}" host ${hostOf(f.url)} is not on the host allowlist (OP-HOSTS extends it by decision)`);
  }

  for (const doc of file.documents ?? []) {
    const own = facts.get(doc.path);
    if (own === undefined) {
      problems.push(`${at}: document ${doc.path} does not exist or is not a content document`);
      continue;
    }
    const distinct = new Set(own.sources.map((s) => s.url));
    if (distinct.size < 2 && !own.noStatistics) problems.push(`${at}: ${doc.path} has ${distinct.size} distinct sources and is not noStatistics`);
    for (const s of own.sources) {
      const record = byUrl.get(s.url);
      if (record === undefined) {
        problems.push(`${at}: ${doc.path} cites ${s.url} with no fetch record`);
        continue;
      }
      const date = fetchDate(record.fetchedAt);
      if (date !== null && s.accessed !== date) problems.push(`${at}: ${doc.path} says ${s.id} was accessed ${s.accessed}, but it was fetched ${date}`);
    }
    for (const claim of doc.claims ?? []) {
      const fetched = byId.get(claim.sourceId);
      if (fetched === undefined) {
        problems.push(`${at}: ${doc.path} claim ${claim.id} names unknown sourceId "${claim.sourceId}"`);
        continue;
      }
      if (claim.kind === 'statistic' || claim.kind === 'regulation') {
        const quote = (claim.quote ?? '').trim();
        if (quote === '') problems.push(`${at}: ${doc.path} claim ${claim.id} is a ${claim.kind} and needs a verbatim quote`);
        else if (wordCount(quote) > MAX_QUOTE_WORDS) problems.push(`${at}: ${doc.path} claim ${claim.id} quote is ${wordCount(quote)} words; at most ${MAX_QUOTE_WORDS}`);
        if (classifyHost(fetched.url) === 'vendor') problems.push(`${at}: ${doc.path} claim ${claim.id} is a ${claim.kind} sourced from a vendor documentation host`);
        if (claim.kind === 'regulation' && !['government', 'standards'].includes(classifyHost(fetched.url))) {
          problems.push(`${at}: ${doc.path} claim ${claim.id} is a regulation and needs a statute, agency or standards-body source`);
        }
      }
    }
  }

  const markers = file.markers ?? [];
  for (const m of markers) {
    if (!byId.has(m.sourceId)) problems.push(`${at}: marker for ${m.path} (${m.rule}) names unknown sourceId "${m.sourceId}"`);
    if (m.reason.trim() === '') problems.push(`${at}: marker for ${m.path} (${m.rule}) has no reason`);
  }
  return problems;
}

/** A `data-claim-allow` or `data-generic-definition` marker in a file needs an entry in `markers` of some sources file. */
export function checkMarkers(facts: ReadonlyMap<string, DocumentFacts>, files: readonly SourcesFile[]): string[] {
  const problems: string[] = [];
  const recorded = new Set(files.flatMap((f) => (f.markers ?? []).map((m) => `${m.path}\u0000${m.rule}`)));
  for (const doc of facts.values()) {
    for (const marker of doc.markers) {
      const rule = marker === 'generic-definition' ? 'generic-definition' : marker.replace(/^claim-allow:/, '');
      if (!recorded.has(`${doc.path}\u0000${rule}`)) problems.push(`${doc.path} carries a ${marker} marker with no entry in any sources file`);
    }
  }
  return problems;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
