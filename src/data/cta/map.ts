import type { DeskId } from '../desks.ts';
import type { Audience } from '../families.ts';
import type { SurfaceRule, TargetKey } from './types.ts';

/**
 * The default CTA map per surface (docs/wave8-contracts.md, section 6.2), as data. The first row that matches a document decides its
 * band, so a row for one path sits above the row for its section, and the "no band" rows sit first of all.
 *
 * WP-62 refines the copy (targets.ts) and may change a mapping here, within the policy: one primary and at most one secondary per band.
 */

const S: Audience = 'startup';

/** A row with no band: legal pages, form pages, thanks pages, the squeeze pages, search, the style guide, the site map and the 404 page. */
const none = (id: string, match: SurfaceRule['match'], audience: Audience = S): SurfaceRule => ({ id, audience, match, primary: [], secondary: [] });

const row = (
  id: string,
  match: SurfaceRule['match'],
  primary: readonly TargetKey[],
  secondary: readonly TargetKey[],
  extra: { readonly audience?: Audience; readonly mid?: TargetKey; readonly frontmatter?: 'primary' | 'secondary' } = {},
): SurfaceRule => ({
  id,
  audience: extra.audience ?? S,
  match,
  primary,
  secondary,
  ...(extra.mid !== undefined ? { mid: extra.mid } : {}),
  ...(extra.frontmatter !== undefined ? { frontmatter: extra.frontmatter } : {}),
});

/** An article row: the brief of the desk, then Apply, with Apply as the secondary and the mid-body band. */
const article = (id: string, desks: readonly DeskId[], first: TargetKey | undefined): SurfaceRule =>
  row(`insights:${id}`, { collection: 'insights', desks }, first === undefined ? ['apply'] : [first, 'apply'], first === undefined ? [] : ['apply'], { mid: 'apply' });

export const SURFACES: readonly SurfaceRule[] = [
  // No band: the form is the action, the page is a legal or machine page, or the visitor has just acted.
  none('none:legal', { prefix: '/legal/' }),
  none('none:apply', { prefix: '/apply/' }),
  none('none:contact', { prefix: '/contact/' }),
  none('none:newsletter', { prefix: '/newsletter/' }),
  none('none:search', { prefix: '/search/' }),
  none('none:styleguide', { prefix: '/styleguide/' }),
  none('none:sitemap', { prefix: '/sitemap/' }),
  none('none:not-found', { path: '/404.html' }),
  // The briefs hub keeps a band; the squeeze pages and the thanks page, which sit below it, are form pages and keep none.
  row('briefs:hub', { path: '/briefs/' }, ['apply'], []),
  none('none:brief-pages', { prefix: '/briefs/' }),
  none('none:brief-collection', { collection: 'briefs' }),
  none('none:investor-interest', { prefix: '/investors/interest/' }, 'investor'),
  none('none:partner-enquire', { prefix: '/network/partners/enquire/' }, 'partner'),

  // Home, the program and pricing.
  row('home', { path: '/' }, ['apply'], ['briefs']),
  row('program:how-we-decide', { path: '/program/how-we-decide/' }, ['apply'], ['journey']),
  row('program', { prefix: '/program/' }, ['apply'], ['journey']),
  row('pricing', { path: '/pricing/' }, ['apply'], ['contact']),

  // Services: the seven lines and their hub.
  row('services', { prefix: '/services/' }, ['contact'], ['apply']),
  row('services:collection', { collection: 'services' }, ['contact'], ['apply']),

  // Founders: the hub, the corporate segment, then the other segment pages (the frontmatter override fills the secondary).
  row('founders:hub', { path: '/founders/' }, ['apply'], ['briefs']),
  row('founders:corporate', { path: '/founders/corporate-innovators/' }, ['brief:corporate-spinouts', 'contact'], ['contact'], { audience: 'corporate' }),
  row('founders:segment', { prefix: '/founders/' }, ['apply'], ['briefs'], { frontmatter: 'secondary' }),

  // Industries and comparisons.
  row('industries', { prefix: '/industries/' }, ['apply'], ['path:/insights/topic/sectors/', 'briefs']),
  row('compare', { prefix: '/compare/' }, ['apply'], ['path:/program/how-it-works/']),

  // The customer journey.
  row('journey:after-you-apply', { path: '/journey/after-you-apply/' }, ['apply'], ['path:/journey/first-months/']),
  row('journey:first-months', { path: '/journey/first-months/' }, ['apply'], ['path:/journey/onboarding-checklist/']),
  row('journey:onboarding-checklist', { path: '/journey/onboarding-checklist/' }, ['apply'], ['tools']),
  row('journey', { prefix: '/journey/' }, ['apply'], ['journey']),

  // Investors and the network.
  row('investors', { prefix: '/investors/' }, ['investor-interest'], ['brief:early-stage-diligence'], { audience: 'investor' }),
  row('network:operators', { path: '/network/operators/' }, ['apply'], ['contact']),
  row('network:partners', { prefix: '/network/partners/' }, ['partner-enquiry'], ['brief:partnering-with-founders'], { audience: 'partner' }),
  row('network', { prefix: '/network/' }, ['apply'], ['partner-enquiry']),

  // Tools: the hub, the tools that point at a brief, the team composer, the rest.
  row('tools:hub', { path: '/tools/' }, ['apply'], ['briefs']),
  row('tools:runway', { path: '/tools/runway-calculator/' }, ['brief:funding-paths', 'apply'], ['apply']),
  row('tools:pricing-checker', { path: '/tools/pricing-page-checker/' }, ['brief:first-100-customers', 'apply'], ['apply']),
  row('tools:team-composer', { path: '/tools/team-composer/' }, ['apply'], ['contact']),
  row('tools', { prefix: '/tools/' }, ['apply'], []),

  // Hubs: the lists of articles, playbooks, guides, library items, research, terms and answers, and the desk pages.
  row('hub:insights-topic', { prefix: '/insights/topic/' }, ['apply'], ['briefs']),
  row('hub:insights', { path: '/insights/' }, ['apply'], ['briefs']),
  row('hub:library', { path: '/library/' }, ['apply'], ['briefs']),
  row('hub:playbooks', { path: '/playbooks/' }, ['apply'], ['briefs']),
  row('hub:guides', { path: '/fundability/' }, ['apply'], ['briefs']),
  row('hub:resources', { path: '/resources/' }, ['apply'], ['briefs']),
  row('hub:glossary', { path: '/glossary/' }, ['apply'], ['briefs']),
  row('hub:faq', { path: '/faq/' }, ['apply'], ['briefs']),
  row('hub:research', { path: '/research/' }, ['apply'], ['briefs']),

  // Articles, by desk. A desk with a brief offers it first and falls back to Apply while the brief is not live.
  article('funding', ['funding'], 'brief:funding-paths'),
  article('legal', ['legal'], 'brief:company-setup'),
  article('team', ['team'], 'brief:first-hires'),
  article('ai', ['ai'], 'brief:ai-native-build'),
  article('first-customers', ['gtm', 'grow', 'dream', 'models'], 'brief:first-100-customers'),
  article('fundable', ['fundable'], 'brief:pre-seed-evidence-pack'),
  article('starting', ['starting'], 'brief:company-setup'),
  article('pathways', ['pathways'], 'brief:funding-paths'),
  article('build', ['build'], 'brief:ai-native-build'),
  row('insights:sectors', { collection: 'insights', desks: ['sectors'] }, ['apply'], ['path:/industries/', 'briefs'], { mid: 'apply' }),
  row('insights:ops', { collection: 'insights', desks: ['ops'] }, ['tools'], ['apply'], { mid: 'apply' }),
  article('other', [], undefined),

  // Playbooks, guides, the library and research.
  row('playbooks', { collection: 'playbooks' }, ['apply'], ['tools']),
  row('guides', { collection: 'guides' }, ['tools'], ['apply'], { mid: 'apply' }),
  row('library', { collection: 'library' }, ['tools'], []),
  row('research', { collection: 'research' }, ['briefs', 'apply'], ['apply']),

  // About, brand story, manifesto, frameworks, trust, press.
  row('about', { prefix: '/about/' }, ['apply'], ['contact']),
  row('trust', { prefix: '/trust/' }, ['apply'], ['contact']),
  row('press', { prefix: '/press/' }, ['apply'], ['contact']),
];

/** The layout default: the row for a page that no row above names. A page of the `pages` collection offers Apply and a question. */
export const FALLBACK_SURFACE: SurfaceRule = row('fallback', {}, ['apply'], ['contact']);
