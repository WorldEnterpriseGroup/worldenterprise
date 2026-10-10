import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { AUDIENCE_LINKS } from '../../../src/data/cta/audiences.ts';
import { HUB_HEADINGS } from '../../../src/data/cta/hubs.ts';
import { resolveCta } from '../../../src/data/cta/index.ts';
import { DESK_DEFINITIONS } from '../../../src/data/desks.ts';
import { SEGMENTS } from '../../../src/data/families.ts';

/**
 * WP-62's surfaces: the home page's audience band, its end band and its insights row; the founders hub driven by the segments registry; the
 * insights hub copy that names the 14 desks. The hero is not WP-62's: its markup and its image are pinned by hash, so a change to either
 * fails here and a change to the hero is a decision of its own.
 */
const root = new URL('../../../', import.meta.url).pathname;
const read = (rel: string): string => readFileSync(join(root, rel), 'utf8');
const sha256 = (data: string | Buffer): string => createHash('sha256').update(data).digest('hex');

const HOME_PAGE = read('src/pages/index.astro');

// ---------------------------------------------------------------------------------------------------------------------------------
// The hero stays as demo has it
// ---------------------------------------------------------------------------------------------------------------------------------

test('the hero component, its call on the home page and its image are byte-identical to the demo branch', () => {
  assert.equal(sha256(read('src/components/home/HomeHero.astro')), '9d40e1d96b88c954ec462d1d5fb44799f85acc3bd77a9ed0f17e65e79106fd37');
  const call = HOME_PAGE.split('\n').filter((line) => line.includes('<HomeHero'));
  assert.equal(call.length, 1);
  assert.equal(sha256(`${call[0]}\n`), '0cc28f8c6213e706ba7f20a6f1a4c2c00e876e66a759f440c28c268393d6b95e');
  assert.equal(sha256(readFileSync(join(root, 'src/assets/photo/band-1.avif'))), 'a84923e99deed2e46e9dc3f26f42aeb462905ace134d4e8b1f847649bf3fa450');
});

// ---------------------------------------------------------------------------------------------------------------------------------
// The home page
// ---------------------------------------------------------------------------------------------------------------------------------

test('the audience band sits directly under the hero and is the only thing between the hero and "What you leave with"', () => {
  const hero = HOME_PAGE.indexOf('<HomeHero');
  const audience = HOME_PAGE.indexOf('<HomeAudience />');
  const leave = HOME_PAGE.indexOf('id="home-leave-with"');
  assert.ok(hero !== -1 && audience > hero && leave > audience);
  assert.equal(HOME_PAGE.split('<HomeAudience').length - 1, 1);
});

test('the audience band takes its doors from the audience data and draws nothing when fewer than two are live', () => {
  const band = read('src/components/home/audience/HomeAudience.astro');
  assert.match(band, /AUDIENCE_LINKS/);
  assert.match(band, /state\.isLive\(link\.href\)/);
  assert.match(band, />= 2/);
  assert.match(band, /<AudienceStrip /);
  assert.match(band, /<h2 id="home-audience">\{HUB_HEADINGS\.audience\}<\/h2>/);
  assert.equal(HUB_HEADINGS.audience, 'Choose where to start');
  assert.ok(AUDIENCE_LINKS.length >= 2 && AUDIENCE_LINKS.length <= 4);
  // The band renders at once: it is in the first screens, so it carries no deferred-rendering class.
  assert.doesNotMatch(band.replace(/\/\*[\s\S]*?\*\//g, ''), /section--defer|content-visibility/);
});

test('the home page ends with one band from the CTA system, in the layout slot, and the old hard-coded band is gone', () => {
  assert.match(HOME_PAGE, /import CtaBand from '..\/components\/cta\/CtaBand\.astro'/);
  assert.doesNotMatch(HOME_PAGE, /components\/ui\/CtaBand/);
  assert.match(HOME_PAGE, /resolveCta\(\{ path: '\/', collection: 'pages' \}, state\.isLive\)/);
  assert.match(HOME_PAGE, /<Fragment slot="cta-end">\s*<CtaBand model=\{endBand\} \/>/);
  assert.equal(HOME_PAGE.split('<CtaBand').length - 1, 1);
  assert.doesNotMatch(HOME_PAGE, /Ready to test your idea\?/);
});

test('the home end band is the Apply action, with the briefs beside it, when both are live', () => {
  const live = (): boolean => true;
  const band = resolveCta({ path: '/', collection: 'pages' }, live);
  assert.equal(band?.primary.href, '/apply/');
  assert.equal(band?.secondary?.href, '/briefs/');
  assert.equal(resolveCta({ path: '/', collection: 'pages' }, (path) => path === '/apply/')?.secondary, undefined);
});

test('the insights row shows the newest article of each desk and links the desks whose topic page is live', () => {
  const row = read('src/components/home/LatestInsights.astro');
  assert.match(row, /DESK_DEFINITIONS/);
  assert.match(row, /state\.isLive\(`\/insights\/topic\/\$\{desk\.id\}\/`\)/);
  assert.match(row, /newestOfDesk/);
  assert.match(row, /aria-label="Insight desks"/);
  // No desk name is typed into the component: the names come from the registry.
  for (const desk of DESK_DEFINITIONS) assert.doesNotMatch(row, new RegExp(`['">]${desk.name}['"<]`), `${desk.name} is typed into LatestInsights`);
});

// ---------------------------------------------------------------------------------------------------------------------------------
// The founders hub
// ---------------------------------------------------------------------------------------------------------------------------------

const FOUNDERS_PAGE = read('src/pages/founders/index.astro');
const SEGMENT_LIST = read('src/components/cta/FounderSegments.astro');

test('the founders hub lists the registry segments that are launched and live, and nothing typed by hand', () => {
  assert.match(FOUNDERS_PAGE, /<FounderSegments \/>/);
  assert.match(SEGMENT_LIST, /SEGMENTS\.entries\s*\.filter\(\(entry\) => entry\.launch && state\.isLive\(entry\.path\)\)/);
  assert.match(SEGMENT_LIST, /segments\.length > 0/);
  assert.match(SEGMENT_LIST, /href=\{href\(segment\.path\)\}/);
  // A segment is a registry entry; no segment label is typed into the page or the list.
  for (const entry of SEGMENTS.entries) {
    for (const text of [FOUNDERS_PAGE, SEGMENT_LIST]) assert.ok(!text.includes(`>${entry.label}<`), `${entry.label} is typed in`);
  }
  assert.ok(SEGMENTS.entries.length > 0);
});

test('the founders hub keeps its stage table and takes its end band from the layout, not from a hard-coded band', () => {
  assert.match(FOUNDERS_PAGE, /founderStageRows\(\)/);
  assert.doesNotMatch(FOUNDERS_PAGE, /<CtaBand/);
  assert.doesNotMatch(FOUNDERS_PAGE, /slot="after"/);
  assert.doesNotMatch(FOUNDERS_PAGE, /Ready to describe your company/);
});

test('the founders hub heading above the segments list is an h2 and is drawn only with the list', () => {
  const at = SEGMENT_LIST.indexOf('id="segments-title"');
  assert.ok(at > SEGMENT_LIST.indexOf('segments.length > 0'));
  assert.match(SEGMENT_LIST, /<h2 id="segments-title">\{HUB_HEADINGS\.segments\}<\/h2>/);
  assert.equal(HUB_HEADINGS.segments, 'Find the path that fits you');
});

// ---------------------------------------------------------------------------------------------------------------------------------
// The insights hub
// ---------------------------------------------------------------------------------------------------------------------------------

test('the insights hub copy names every one of the 14 desks of the registry', () => {
  assert.equal(DESK_DEFINITIONS.length, 14);
  const copy = read('src/content/pages/insights/index.mdx');
  for (const desk of DESK_DEFINITIONS) {
    assert.ok(copy.includes(desk.name), `the insights hub copy does not name the desk "${desk.name}"`);
  }
});

test('the insights hub copy keeps the sentences that say what the articles are not', () => {
  const copy = read('src/content/pages/insights/index.mdx');
  assert.match(copy, /Nothing here is a promise of funding/);
  assert.match(copy, /nothing on legal or financial topics is advice/);
});
