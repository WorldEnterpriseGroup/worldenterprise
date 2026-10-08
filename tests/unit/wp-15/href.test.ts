import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAbsolute, buildAsset, buildHref } from '../../../src/lib/url-core.ts';

const PREVIEW = '/worldenterprise/';

test('href is idempotent: resolving an already resolved link changes nothing', () => {
  for (const path of ['/', '/program/', '/program/how-it-works', '/search/?q=seat#results', '/rss.xml', '#top']) {
    for (const base of ['/', '', undefined, PREVIEW, '/worldenterprise']) {
      const once = buildHref(path, base);
      assert.equal(buildHref(once, base), once, `${path} with base ${String(base)}`);
    }
  }
});

test('on the preview a resolved link keeps one prefix, including the bare base', () => {
  assert.equal(buildHref('/worldenterprise/program/', PREVIEW), '/worldenterprise/program/');
  assert.equal(buildHref('/worldenterprise', PREVIEW), '/worldenterprise/');
  assert.equal(buildHref('/worldenterprise/', PREVIEW), '/worldenterprise/');
  assert.equal(buildHref('/worldenterprise/feed.xml', PREVIEW), '/worldenterprise/feed.xml');
});

test('a path that only starts with the base letters is still a site path', () => {
  assert.equal(buildHref('/worldenterprise-news/', PREVIEW), '/worldenterprise/worldenterprise-news/');
});

test('production has no base, so nothing is treated as resolved', () => {
  assert.equal(buildHref('/worldenterprise/program/', '/'), '/worldenterprise/program/');
  assert.equal(buildHref('program', undefined), '/program/');
});

test('the absolute URL never carries the preview base', () => {
  assert.equal(buildAbsolute('/program/how-it-works', 'https://worldenterprise.org'), 'https://worldenterprise.org/program/how-it-works/');
});

test('asset is idempotent too', () => {
  assert.equal(buildAsset('/favicon.svg', PREVIEW), '/worldenterprise/favicon.svg');
  assert.equal(buildAsset('/worldenterprise/favicon.svg', PREVIEW), '/worldenterprise/favicon.svg');
  assert.equal(buildAsset('/favicon.svg', '/'), '/favicon.svg');
});
