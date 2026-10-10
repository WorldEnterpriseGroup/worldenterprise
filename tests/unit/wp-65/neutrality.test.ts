import assert from 'node:assert/strict';
import test from 'node:test';
import { read, scannedFiles } from './surfaces.ts';

/**
 * The neutrality rule and the word bans of the partner journey (plan WP-65; docs/wave8-contracts.md section 0). No page may say that
 * WE uses, endorses or partners with a named product, so no well-known vendor or platform name appears on a partner or network page.
 * And no sentence uses the words the program must never use. Both lists are scanned over every source file behind the pages, and each
 * scan proves itself on planted text first, so an emptied list or a broken pattern cannot pass.
 */

/** Well-known vendors, platforms and programs. Matched as whole words, case-sensitively, so ordinary words do not trip a name. */
export const VENDORS: readonly string[] = [
  'Microsoft', 'Azure', 'AWS', 'Amazon', 'Google', 'GCP', 'Alphabet', 'Apple', 'Meta', 'Facebook', 'Oracle', 'IBM', 'SAP', 'Salesforce', 'HubSpot',
  'Atlassian', 'Jira', 'Confluence', 'Slack', 'Notion', 'Asana', 'Airtable', 'Zapier', 'Zoom', 'Dropbox', 'Box', 'Figma', 'Canva', 'Adobe',
  'GitHub', 'GitLab', 'Bitbucket', 'Vercel', 'Netlify', 'Cloudflare', 'Heroku', 'DigitalOcean', 'Fastly', 'Datadog', 'Sentry', 'Twilio', 'SendGrid',
  'Stripe', 'PayPal', 'Square', 'Brex', 'Mercury', 'Ramp', 'Carta', 'Pilot', 'Gusto', 'Rippling', 'Deel', 'QuickBooks', 'Xero', 'Bill.com',
  'Shopify', 'Intercom', 'Zendesk', 'Segment', 'Mixpanel', 'Amplitude', 'Okta', 'Auth0', 'Clerk', 'Supabase', 'Firebase', 'MongoDB', 'Snowflake',
  'Databricks', 'OpenAI', 'Anthropic', 'Cohere', 'Mistral', 'Linear', 'Intuit', 'Wix', 'Squarespace', 'WordPress', 'LinkedIn', 'Twitter', 'Reddit',
  'Y Combinator', 'YC', 'Techstars', 'Plug and Play', 'Founders Fund', 'Sequoia', 'Andreessen', 'Clerky', 'Cooley', 'Gunderson', 'Wilson Sonsini',
  'Fenwick', 'Orrick', 'Deloitte', 'KPMG', 'PwC', 'EY', 'Accenture', 'McKinsey', 'Thoughtworks', 'Toptal', 'Upwork', 'Fiverr',
];

const vendorPattern = (name: string): RegExp => new RegExp(`(?<![A-Za-z0-9])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9])`);

/** The words the partner program never uses: an offer, a saving, a peer program or a promise of one. `network of` is the C-14 phrasing. */
export const BANNED: readonly { readonly word: string; readonly pattern: RegExp }[] = [
  { word: 'free', pattern: /\bfree\b/i },
  { word: 'perk', pattern: /perk/i },
  { word: 'discount', pattern: /discount/i },
  { word: 'accelerator', pattern: /accelerator/i },
  { word: 'cohort', pattern: /cohort/i },
  { word: 'mentor', pattern: /mentor/i },
  { word: 'network of', pattern: /network\s+of/i },
];

const files = scannedFiles();

/** The text of a file with its frontmatter and code comments left in: a vendor name in a comment is still a name on the site's source. */
const textOf = (file: string): string => read(file);

test('the scan covers the pages, the content, the copy module and the network components', () => {
  for (const expected of [
    'src/pages/network/index.astro',
    'src/pages/network/partners/index.astro',
    'src/pages/network/partners/enquire/thanks.astro',
    'src/content/pages/network/index.mdx',
    'src/content/pages/network/partners/faq.mdx',
    'src/components/partners/copy.ts',
    'src/components/network/NetworkIntro.astro',
  ]) {
    assert.ok(files.includes(expected), `${expected} is scanned`);
  }
});

test('the vendor scan finds planted names and ignores ordinary words', () => {
  const planted = ['WE partners with Stripe.', 'Credits from Google Cloud.', 'We use Y Combinator templates.', 'AWS credits', 'Slack community'];
  for (const text of planted) assert.ok(VENDORS.some((v) => vendorPattern(v).test(text)), text);
  for (const text of ['A box of tools.', 'The square root.', 'A pilot program.', 'The segment a company serves.', 'A linear path.', 'Amazing news.']) {
    assert.ok(!VENDORS.some((v) => vendorPattern(v).test(text)), text);
  }
});

test('no partner or network page names a well-known vendor or platform', () => {
  for (const file of files) {
    const text = textOf(file);
    for (const vendor of VENDORS) assert.doesNotMatch(text, vendorPattern(vendor), `${file} names ${vendor}`);
  }
});

test('the word scan finds planted words', () => {
  const planted = ['A free trial', 'perks for founders', 'a discount', 'an accelerator', 'the next cohort', 'meet your mentor', 'a network of partners'];
  for (const text of planted) assert.ok(BANNED.some((b) => b.pattern.test(text)), text);
  for (const text of ['A freedom to choose.', 'The enquiry form.', 'WE reads each enquiry.']) assert.ok(!BANNED.some((b) => b.pattern.test(text)), text);
});

test('no partner or network page uses free, perk, discount, accelerator, cohort, mentor or network of', () => {
  for (const file of files) {
    const text = textOf(file);
    for (const banned of BANNED) assert.doesNotMatch(text, banned.pattern, `${file} uses "${banned.word}"`);
  }
});
