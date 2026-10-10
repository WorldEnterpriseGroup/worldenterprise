/**
 * Who WE fits and who it probably does not (WP-43, wave 7). One home for the two lists that /program/who-its-for/ and
 * /program/how-we-decide/ both render, so the pages cannot drift apart. The sentences are moved verbatim from
 * who-its-for.astro; tests/unit/wp-43/fit.test.ts pins them against a fixture. Adding a criterion here is an operator
 * decision (DP-5): this module restates what the site already said and nothing more.
 *
 * Pure data, free of Astro globals, so node tests import it as well as pages.
 */

export const FIT_HEADING = 'You are a good fit if';
export const NOT_FIT_HEADING = 'WE is probably not the right fit if';

export const FITS: readonly string[] = [
  'You have a SaaS idea or an early product, and you can say who it is for.',
  'You can describe the problem as the customer would, even if you are not yet sure it is real.',
  'You are willing to test the idea with real customers, including when the answers are unwelcome.',
  'You can make decisions for the company and join a review at each cycle.',
  'You want a team and a method to carry out the work, and you will keep ownership of the direction.',
];

export const NOT_FITS: readonly string[] = [
  'You need a physical office, on-site staff or in-person work. WE is fully remote.',
  'You are looking for money rather than a team. WE makes no promise of funding.',
  'You want WE to run your product in production or to provide round-the-clock support.',
  'You want WE to give legal or tax advice, keep your books or file your taxes.',
  'Your idea is not a software-as-a-service product.',
];
