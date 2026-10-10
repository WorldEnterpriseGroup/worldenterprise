import { AUDIENCES, AUDIENCE_LABELS } from '../families.ts';
import type { Audience } from '../families.ts';

/**
 * The four doors of the audience strip (docs/wave8-contracts.md, section 6.1): startups, investors, partners, corporate teams. The strip
 * is the band of the home page and the hubs, so it has no button and no promise, only where each audience should start.
 */
export interface AudienceLink {
  readonly audience: Audience;
  readonly label: string;
  readonly text: string;
  readonly href: string;
}

const TEXT: Readonly<Record<Audience, { readonly text: string; readonly href: string }>> = {
  startup: { text: 'How WE works with early-stage founders.', href: '/founders/' },
  investor: { text: 'How WE prepares companies, and what WE does not do.', href: '/investors/' },
  partner: { text: 'How an organization can partner with WE.', href: '/network/partners/' },
  corporate: { text: 'For a team that builds a new company from inside a larger one.', href: '/founders/corporate-innovators/' },
};

export const AUDIENCE_LINKS: readonly AudienceLink[] = AUDIENCES.map((audience) => ({
  audience,
  label: AUDIENCE_LABELS[audience],
  text: TEXT[audience].text,
  href: TEXT[audience].href,
}));
