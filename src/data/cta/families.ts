import { DESKS } from '../desks.ts';
import type { DeskId } from '../desks.ts';
import type { FamilyId } from '../families.ts';
import type { ResolveInput, TargetKey } from './types.ts';

/**
 * The default call to action of every page family (docs/wave8-contracts.md, section 6.2, and W8-25, the customer-journey contract), as
 * data. `map.ts` decides a band at run time; this table says what each family is meant to carry when every target is live, so a family
 * that is added to the registry, a desk that is added to `desks.ts` or a surface that loses its row fails a test instead of shipping with
 * no next step. The tests resolve every row through `resolveCta` and compare, and the surface matrix e2e visits a sample route of each.
 *
 * A row says: this kind of document gets this primary action and, at most, this secondary one; or it gets no band at all (a form, a thanks
 * page, a legal page, a machine page), because the form is the action there and a band beside it would be a second ask.
 */

/** The page families of the registry, plus the families that exist as collections and sections rather than registry entries. */
export type LegacyFamily =
  | 'home'
  | 'program'
  | 'pricing'
  | 'services'
  | 'founders-hub'
  | 'articles'
  | 'playbooks'
  | 'guides'
  | 'library'
  | 'tools'
  | 'research'
  | 'hubs'
  | 'investors'
  | 'network'
  | 'partners'
  | 'about'
  | 'form-and-machine';

export type FamilyKey = FamilyId | LegacyFamily;

/** What the contract names for a document: the first-choice primary, the secondary, and whether a long document carries a mid-body band. */
export interface FamilyExpectation {
  readonly primary: TargetKey;
  readonly secondary?: TargetKey;
  /** The mid-body band's target, for a document of 900 words or more. */
  readonly mid?: TargetKey;
}

export interface FamilySurface {
  readonly id: string;
  readonly family: FamilyKey;
  /** One representative document. For an article only `topic` is meaningful: the e2e picks a live article of that desk. */
  readonly input: ResolveInput;
  /** Null: no band on this surface. */
  readonly expect: FamilyExpectation | null;
}

const page = (id: string, family: FamilyKey, path: string, expect: FamilyExpectation | null): FamilySurface => ({ id, family, input: { path, collection: 'pages' }, expect });
const entry = (id: string, family: FamilyKey, collection: ResolveInput['collection'], path: string, expect: FamilyExpectation | null): FamilySurface => ({ id, family, input: { path, collection }, expect });

const APPLY_AND_BRIEFS: FamilyExpectation = { primary: 'apply', secondary: 'briefs' };

/** An article: the brief of the desk first, Apply behind it, Apply again in the middle of a long one. */
function article(desk: DeskId, primary: TargetKey, secondary?: TargetKey): FamilySurface {
  return {
    id: `articles:${desk}`,
    family: 'articles',
    input: { path: `/insights/sample-${desk}/`, collection: 'insights', topic: desk },
    expect: { primary, ...(secondary !== undefined ? { secondary } : {}), mid: 'apply' },
  };
}

export const FAMILY_SURFACES: readonly FamilySurface[] = [
  // The wave 8 registry families.
  page('segments:first-time-founders', 'segments', '/founders/first-time-founders/', APPLY_AND_BRIEFS),
  page('segments:corporate-innovators', 'segments', '/founders/corporate-innovators/', { primary: 'brief:corporate-spinouts', secondary: 'contact' }),
  page('industries:hub', 'industries', '/industries/', { primary: 'apply', secondary: 'path:/insights/topic/sectors/' }),
  page('industries:fintech', 'industries', '/industries/fintech/', { primary: 'apply', secondary: 'path:/insights/topic/sectors/' }),
  page('compare:hub', 'compare', '/compare/', { primary: 'apply', secondary: 'path:/program/how-it-works/' }),
  page('compare:pair', 'compare', '/compare/build-vs-buy/', { primary: 'apply', secondary: 'path:/program/how-it-works/' }),
  page('journey:hub', 'journey', '/journey/', { primary: 'apply', secondary: 'journey' }),
  page('journey:after-you-apply', 'journey', '/journey/after-you-apply/', { primary: 'apply', secondary: 'path:/journey/first-months/' }),
  page('journey:first-months', 'journey', '/journey/first-months/', { primary: 'apply', secondary: 'path:/journey/onboarding-checklist/' }),
  page('journey:onboarding-checklist', 'journey', '/journey/onboarding-checklist/', { primary: 'apply', secondary: 'tools' }),
  page('briefs:hub', 'briefs', '/briefs/', { primary: 'apply' }),
  entry('briefs:squeeze', 'briefs', 'briefs', '/briefs/funding-paths/', null),
  page('briefs:thanks', 'briefs', '/briefs/thanks/', null),

  // The families that existed before wave 8.
  page('home', 'home', '/', APPLY_AND_BRIEFS),
  page('program', 'program', '/program/how-it-works/', { primary: 'apply', secondary: 'journey' }),
  page('program:how-we-decide', 'program', '/program/how-we-decide/', { primary: 'apply', secondary: 'journey' }),
  page('pricing', 'pricing', '/pricing/', { primary: 'apply', secondary: 'contact' }),
  entry('services', 'services', 'services', '/services/digital-incubation/', { primary: 'contact', secondary: 'apply' }),
  page('founders-hub', 'founders-hub', '/founders/', APPLY_AND_BRIEFS),

  article('funding', 'brief:funding-paths', 'apply'),
  article('legal', 'brief:company-setup', 'apply'),
  article('team', 'brief:first-hires', 'apply'),
  article('ai', 'brief:ai-native-build', 'apply'),
  article('gtm', 'brief:first-100-customers', 'apply'),
  article('grow', 'brief:first-100-customers', 'apply'),
  article('dream', 'brief:first-100-customers', 'apply'),
  article('models', 'brief:first-100-customers', 'apply'),
  article('fundable', 'brief:pre-seed-evidence-pack', 'apply'),
  article('starting', 'brief:company-setup', 'apply'),
  article('pathways', 'brief:funding-paths', 'apply'),
  article('build', 'brief:ai-native-build', 'apply'),
  article('sectors', 'apply', 'path:/industries/'),
  article('ops', 'tools', 'apply'),

  entry('playbooks', 'playbooks', 'playbooks', '/playbooks/validate-the-problem/', { primary: 'apply', secondary: 'tools' }),
  entry('guides', 'guides', 'guides', '/fundability/safe-explained/', { primary: 'tools', secondary: 'apply', mid: 'apply' }),
  entry('library', 'library', 'library', '/library/one-page-problem-brief/', { primary: 'tools' }),
  page('tools:hub', 'tools', '/tools/', APPLY_AND_BRIEFS),
  page('tools:team-composer', 'tools', '/tools/team-composer/', { primary: 'apply', secondary: 'contact' }),
  page('tools:page', 'tools', '/tools/metrics-calculator/', { primary: 'apply' }),
  entry('research', 'research', 'research', '/research/saas-security-baseline-year-one/', { primary: 'briefs', secondary: 'apply' }),
  page('hubs:insights', 'hubs', '/insights/', APPLY_AND_BRIEFS),
  page('hubs:library', 'hubs', '/library/', APPLY_AND_BRIEFS),
  page('hubs:playbooks', 'hubs', '/playbooks/', APPLY_AND_BRIEFS),
  page('hubs:resources', 'hubs', '/resources/', APPLY_AND_BRIEFS),
  page('hubs:glossary', 'hubs', '/glossary/', APPLY_AND_BRIEFS),
  page('hubs:faq', 'hubs', '/faq/', APPLY_AND_BRIEFS),
  page('hubs:research', 'hubs', '/research/', APPLY_AND_BRIEFS),
  page('investors', 'investors', '/investors/', { primary: 'investor-interest', secondary: 'brief:early-stage-diligence' }),
  page('network', 'network', '/network/', { primary: 'apply', secondary: 'partner-enquiry' }),
  page('network:operators', 'network', '/network/operators/', { primary: 'apply', secondary: 'contact' }),
  page('partners', 'partners', '/network/partners/', { primary: 'partner-enquiry', secondary: 'brief:partnering-with-founders' }),
  page('about', 'about', '/about/manifesto/', { primary: 'apply', secondary: 'contact' }),
  page('about:trust', 'about', '/trust/', { primary: 'apply', secondary: 'contact' }),
  page('about:press', 'about', '/press/', { primary: 'apply', secondary: 'contact' }),

  // No band: the form is the action, the page is legal or machine-made, or the visitor has just acted.
  page('none:apply', 'form-and-machine', '/apply/', null),
  page('none:apply-thanks', 'form-and-machine', '/apply/thanks/', null),
  page('none:contact', 'form-and-machine', '/contact/', null),
  page('none:newsletter', 'form-and-machine', '/newsletter/', null),
  page('none:investor-interest', 'form-and-machine', '/investors/interest/', null),
  page('none:investor-interest-thanks', 'form-and-machine', '/investors/interest/thanks/', null),
  page('none:partner-enquire', 'form-and-machine', '/network/partners/enquire/', null),
  page('none:partner-enquire-thanks', 'form-and-machine', '/network/partners/enquire/thanks/', null),
  page('none:privacy', 'form-and-machine', '/legal/privacy/', null),
  page('none:search', 'form-and-machine', '/search/', null),
  page('none:styleguide', 'form-and-machine', '/styleguide/', null),
  page('none:sitemap', 'form-and-machine', '/sitemap/', null),
  page('none:not-found', 'form-and-machine', '/404.html', null),
];

/** Every desk, so a desk added to `desks.ts` without a row fails the family test. */
export const ARTICLE_DESKS: readonly DeskId[] = DESKS;
