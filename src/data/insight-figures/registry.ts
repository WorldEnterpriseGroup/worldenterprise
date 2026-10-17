import { figureById } from './figures.ts';
import type { InsightFigure } from './figures.ts';

/**
 * Which figures each /insights/ article shows (WP-26). Keys are `<desk>/<slug>`, the article's path under src/content/insights without its
 * extension; values are figure ids from figures.ts, drawn in order under the heading "In the data". Every article file must appear exactly
 * once, either here or in INLINE_FIGURE_ARTICLES (tests/unit/wp-26/figures.test.ts walks the content folder to prove it).
 *
 * Figures are chosen for what the article argues: survival and time figures for the planning pieces, firm-size and firm-age figures for
 * selling and operating, funding-clock figures for the raising pieces, sector exit rates for the sector desk, and the AI and labor sources
 * for the AI and team desks.
 */
export const ARTICLE_FIGURES: Readonly<Record<string, readonly string[]>> = {
  // AI
  'ai/ai-features-and-customer-data-what-to-decide-first': ['btos-ai-by-sector'],
  'ai/ai-regulation-for-a-small-saas-company-what-to-ask-counsel': ['nist-ai-rmf-core', 'btos-ai-use'],
  'ai/choosing-a-model-provider-the-questions-that-matter': ['btos-ai-use'],
  'ai/evaluating-an-llm-feature-before-you-ship-it': ['owasp-llm-top-10-2025'],
  'ai/human-review-in-an-ai-feature-where-to-keep-a-person-in-the-loop': ['nist-ai-rmf-core'],
  'ai/metering-and-budgeting-model-usage': ['owasp-llm-top-10-2025'],
  'ai/prompt-injection-and-the-owasp-top-10-for-llm-applications': ['owasp-llm-top-10-2025'],
  'ai/retrieval-augmented-generation-what-it-is-and-where-it-breaks': ['owasp-llm-top-10-2025'],
  'ai/the-nist-ai-risk-management-framework-for-a-small-team': ['nist-ai-rmf-core'],
  // Build
  'build/a-boring-first-technology-stack': ['bed-information-survival-2015'],
  'build/an-operating-rhythm-for-a-remote-offshore-team': ['bls-tenure-by-age'],
  'build/architecture-decisions-to-defer-in-the-first-six-months': ['bed-information-survival-2015'],
  'build/build-versus-buy-for-auth-billing-and-email': ['bds-firms-by-size'],
  'build/cutting-an-mvp-the-cut-line-test': ['slope-payroll'],
  'build/estimating-a-first-release-ranges-and-what-they-hide': ['slope-payroll'],
  'build/observability-for-a-small-team-logs-metrics-and-alerts-you-will-actually-read': ['bds-firms-by-size'],
  'build/product-management-for-a-first-saas-roles-backlog-and-decisions': ['bds-exit-by-firm-age'],
  'build/shipping-safely-with-feature-flags-and-rollback': ['bed-information-survival-2015'],
  'build/what-a-dedicated-team-seat-is-and-is-not': ['bls-tenure-by-age'],
  'build/writing-a-product-requirements-document-people-read': ['bds-exit-by-firm-age'],
  // Dream
  'dream/bottom-up-market-sizing-for-a-first-saas': ['bds-firms-by-size'],
  'dream/customer-discovery-interviews-without-false-positives': ['slope-sectors'],
  'dream/fake-door-and-concierge-tests': ['waffle-2021-applications'],
  'dream/is-your-saas-idea-a-business-or-a-feature': ['bds-startups-by-year'],
  'dream/kill-criteria-deciding-in-advance-when-to-stop': ['waffle-2015'],
  'dream/mapping-the-alternatives-a-customer-already-uses': ['bds-jobs-by-firm-age'],
  'dream/write-the-problem-brief-before-the-code': ['waffle-2021-applications'],
  // Fundable
  'fundable/answering-a-security-and-privacy-questionnaire': ['bds-jobs-by-firm-age'],
  'fundable/choosing-the-right-first-investors-for-a-saas-company': ['carta-round-ages'],
  'fundable/customer-evidence-and-reference-calls': ['bds-jobs-by-firm-age'],
  'fundable/evidence-over-narrative-what-diligence-actually-tests': ['carta-round-gaps'],
  'fundable/ip-contracts-and-access-diligence-for-small-engineering-teams': ['bds-firms-by-size'],
  'fundable/ordering-a-pre-seed-evidence-pack': ['carta-round-gaps'],
  'fundable/questions-to-ask-your-counsel-before-you-sign': ['carta-dilution'],
  'fundable/the-founder-time-budget-of-a-raise': ['carta-round-gaps'],
  // Funding
  'funding/angels-micro-funds-and-funds-what-the-rules-say-and-what-to-ask': ['carta-round-ages'],
  'funding/cap-table-basics-for-founders': ['carta-dilution'],
  'funding/crowdfunding-and-regulation-cf-for-a-software-company': ['waffle-2015'],
  'funding/funding-a-first-saas-from-customer-revenue': ['bds-exit-by-firm-age'],
  'funding/funding-a-software-startup-the-routes': ['carta-round-ages'],
  'funding/grants-and-sbir-programs-for-software-companies': ['waffle-2015'],
  'funding/reading-a-term-sheet-line-by-line': ['carta-dilution'],
  'funding/revenue-based-financing-and-venture-debt-when-they-apply': ['carta-round-gaps'],
  'funding/runway-and-burn-the-arithmetic': ['carta-round-gaps'],
  'funding/safe-or-convertible-note-how-the-two-instruments-differ': ['carta-dilution'],
  // Grow
  'grow/feedback-loops-that-reach-the-product': ['bds-exit-by-firm-age'],
  'grow/onboarding-is-acquisition-time-to-first-value': ['ridgeline-exits'],
  'grow/pricing-page-fundamentals-for-a-first-saas': ['bds-firms-by-size'],
  'grow/retention-basics-for-a-first-saas': ['ridgeline-exits'],
  'grow/support-at-five-customers-not-fifty': ['bds-firms-by-size'],
  'grow/your-first-ten-customers-a-founder-led-sequence': ['bds-jobs-by-firm-age'],
  // Go to market
  'gtm/a-one-page-positioning-statement': ['slope-sectors'],
  'gtm/choosing-your-first-channels': ['bds-firms-by-size'],
  'gtm/cold-outreach-that-follows-can-spam': ['bds-firms-by-size'],
  'gtm/customer-references-and-case-studies-without-breaking-ftc-rules': ['bds-jobs-by-firm-age'],
  'gtm/founder-led-sales-calls-a-structure': ['bds-jobs-by-firm-age'],
  'gtm/landing-page-tests-you-can-read': ['waffle-2021-applications'],
  'gtm/marketplaces-and-partner-channels-when-a-listing-helps': ['slope-sectors'],
  'gtm/pricing-a-first-saas-value-packaging-and-the-questions-to-ask': ['ridgeline-exits'],
  'gtm/trials-demos-and-self-serve-how-a-customer-first-meets-the-product': ['bds-exit-by-firm-age'],
  'gtm/writing-a-landing-page-that-says-what-the-product-does': ['slope-sectors'],
  // Legal
  'legal/choosing-an-entity-llc-or-c-corporation': ['waffle-2021-applications'],
  'legal/founder-equity-splits-and-vesting': ['waffle-2015'],
  'legal/founder-ip-assignment-and-confidentiality-agreements': ['bed-information-survival-2015'],
  'legal/open-source-licenses-inside-a-commercial-product': ['bed-information-survival-2015'],
  'legal/privacy-law-basics-for-a-small-product': ['bds-firms-by-size'],
  'legal/terms-of-service-and-privacy-policy-what-each-document-is-for': ['bds-firms-by-size'],
  'legal/the-83b-election-and-its-deadline': ['carta-dilution'],
  'legal/trademark-name-clearance-before-you-commit': ['bds-startups-by-year'],
  // Models
  'models/api-first-products-and-developer-tools': ['bed-information-survival-2015'],
  'models/b2b-saas-how-the-model-works-and-what-it-asks-of-a-first-company': ['bds-jobs-by-firm-age'],
  'models/marketplaces-the-two-sided-start-up-problem': ['slope-sectors'],
  'models/open-core-and-open-source-businesses': ['bed-information-survival-2015'],
  'models/platforms-and-ecosystems-when-a-product-becomes-a-platform': ['bds-jobs-by-firm-age'],
  'models/product-led-and-sales-led-growth-choosing-between-them': ['bds-firms-by-size'],
  'models/usage-based-seat-based-and-hybrid-pricing-models': ['bds-firms-by-size'],
  'models/vertical-saas-depth-over-breadth': ['slope-sectors'],
  // Operations
  'ops/a-weekly-operating-rhythm-for-a-founder': ['bds-exit-by-firm-age'],
  'ops/books-and-basic-accounting-for-a-software-startup': ['waffle-2015'],
  'ops/burnout-recognizing-it-and-what-to-change': ['ridgeline-exits'],
  'ops/choosing-and-managing-a-small-companys-software-stack': ['bds-firms-by-size'],
  'ops/insurance-for-a-software-startup-what-exists-and-what-to-ask': ['bds-exit-by-firm-age'],
  'ops/meetings-async-work-and-decision-records-for-a-small-team': ['bls-tenure-by-age'],
  'ops/the-tax-calendar-a-us-software-startup-should-know-exists': ['bds-firms-by-size'],
  'ops/working-through-a-disagreement-with-a-co-founder': ['waffle-2015'],
  // Pathways
  'pathways/acquiring-a-small-software-product-instead-of-building-one': ['bds-jobs-by-firm-age'],
  'pathways/acquisitions-acqui-hires-and-wind-downs-the-exits-to-recognize': ['ridgeline-exits'],
  'pathways/customers-as-capital-pilots-prepayment-and-design-partners': ['carta-round-gaps'],
  'pathways/from-client-work-to-a-product-productizing-a-service-business': ['slope-sectors'],
  'pathways/from-side-project-to-company-the-decision-points': ['slope-payroll'],
  'pathways/joining-as-a-founding-team-member-what-to-ask-before-you-commit': ['bls-tenure-by-age'],
  'pathways/matching-a-funding-route-to-a-stage-a-decision-guide': ['carta-round-ages'],
  'pathways/paying-a-first-team-before-funding-the-options-and-what-each-risks': ['bls-alternative-arrangements'],
  'pathways/spinning-a-product-out-of-an-employer-what-to-settle-first': ['range-founder-age'],
  'pathways/three-ways-to-start-an-idea-a-skill-a-lived-problem': ['area-age-share'],
  // Sectors
  'sectors/climate-tech-software-considerations-before-you-build': ['bds-exit-utilities'],
  'sectors/edtech-saas-considerations-before-you-build': ['bds-exit-education'],
  'sectors/fintech-saas-considerations-before-you-build': ['bds-exit-finance'],
  'sectors/government-software-considerations-for-selling-to-the-public-sector': ['bds-exit-professional'],
  'sectors/healthtech-saas-considerations-before-you-build': ['bds-exit-health-care'],
  'sectors/hr-and-recruiting-software-considerations-before-you-build': ['bds-exit-administrative'],
  'sectors/legal-software-considerations-before-you-build': ['bds-exit-professional'],
  'sectors/security-software-considerations-before-you-build': ['bds-exit-information'],
  // Starting
  'starting/a-non-technical-founder-building-saas-what-to-own-and-what-to-delegate': ['bed-information-survival-2015'],
  'starting/a-technical-founders-blind-spots-selling-pricing-and-saying-no': ['bds-exit-by-firm-age'],
  'starting/choosing-a-co-founder-or-deciding-not-to': ['waffle-2015'],
  'starting/founders-inside-a-company-intellectual-property-and-employment-agreements': ['range-founder-age'],
  'starting/founding-from-outside-the-united-states-what-changes-for-a-remote-founder': ['bds-startups-by-year'],
  'starting/part-time-to-full-time-deciding-when-to-commit': ['slope-payroll'],
  'starting/second-career-founders-turning-domain-knowledge-into-a-saas-idea': ['area-age-share'],
  'starting/solo-founders-where-a-second-pair-of-eyes-comes-from': ['bds-firms-by-size'],
  'starting/student-founders-the-questions-to-settle-before-you-start': ['range-founder-age'],
  'starting/what-a-first-time-founder-should-settle-first': ['waffle-2015'],
  // Team
  'team/contractors-and-employees-the-classification-tests': ['bls-alternative-arrangements'],
  'team/hiring-across-borders-employees-contractors-and-employers-of-record': ['bls-alternative-arrangements'],
  'team/offer-letters-what-they-should-state': ['bls-tenure-by-age'],
  'team/onboarding-a-new-team-member-what-to-prepare-before-day-one': ['bls-tenure-by-age'],
  'team/stock-options-for-early-employees-what-an-option-is-and-what-to-ask': ['carta-dilution'],
  'team/structured-interviews-for-a-small-team': ['bls-tenure-by-age'],
  'team/writing-a-job-description-people-can-answer': ['bls-tenure-by-age'],
  'team/writing-down-how-a-remote-team-works-a-team-handbook': ['bls-tenure-by-age'],
  'team/your-first-hire-what-to-settle-before-you-write-the-job': ['bds-firms-by-size'],
};

/**
 * The twelve articles WP-38 (wave 10, MR !90) already gave sourced figures inside the article body. The layout adds nothing to them, so
 * no page carries a second copy of the same chart.
 */
export const INLINE_FIGURE_ARTICLES: readonly string[] = [
  'funding/bootstrapping-versus-raising-over-a-ten-year-horizon',
  'funding/sbir-and-sttr-as-patient-capital-for-research-based-companies',
  'funding/the-time-between-funding-rounds-what-carta-data-reports',
  'ops/coworking-and-community-what-the-research-shows-about-staying-power',
  'ops/shutdown-data-and-what-survivors-do-differently',
  'ops/the-longevity-paradox-sprint-weekly-endure-for-a-decade',
  'pathways/choosing-a-startup-program-that-fits-a-decision-guide',
  'pathways/using-sba-resource-partners-sbdc-score-wbc-and-vboc',
  'starting/encore-founders-starting-a-company-after-fifty',
  'starting/founder-age-and-growth-what-the-census-study-of-2-7-million-founders-found',
  'starting/from-first-filing-to-first-payroll-what-the-timing-data-says',
  'starting/women-and-immigrant-founders-what-the-census-and-research-data-show',
];

/** The route slug of a registry key. */
export const slugOf = (key: string): string => key.slice(key.indexOf('/') + 1);

/**
 * The figures for an article page, by its route path (`/insights/<slug>/`). Any other path, including the style guide and articles with
 * inline figures, gets none.
 */
export function figuresForPath(path: string): readonly InsightFigure[] {
  const m = /^\/insights\/([a-z0-9-]+)\/$/.exec(path);
  if (m === null) return [];
  const key = Object.keys(ARTICLE_FIGURES).find((k) => slugOf(k) === m[1]);
  if (key === undefined) return [];
  return (ARTICLE_FIGURES[key] ?? []).map(figureById);
}
