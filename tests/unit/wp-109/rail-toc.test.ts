import assert from 'node:assert/strict';
import test from 'node:test';
import { plainText, railToc, slugify } from '../../../src/lib/rail-toc.ts';

// WP-109 (issue #109): the rail's "on this page" list is built from the h2 headings of a rendered body.

test('plainText drops tags, decodes references and collapses white space', () => {
  assert.equal(plainText('Who  <em>files</em>,&nbsp;and what&#39;s next &amp; why'), "Who files, and what's next & why");
  assert.equal(plainText('A &#x2014; B'), 'A — B');
  assert.equal(plainText('Unknown &zzz; stays'), 'Unknown &zzz; stays');
});

test('slugify gives a stable ascii id and never an empty one', () => {
  assert.equal(slugify('The name and the motto'), 'the-name-and-the-motto');
  assert.equal(slugify('Café: what’s 100%?'), 'cafe-what-s-100');
  assert.equal(slugify('???'), 'section');
});

test('railToc lists h2 headings, keeps existing ids and adds the missing ones', () => {
  const html = '<h2 id="intro">Intro</h2><p>x</p><h2>Second <a href="/x">part</a></h2><h3>Not listed</h3><h2 class="k">Third</h2>';
  const { items, html: out } = railToc(html);
  assert.deepEqual(items, [
    { id: 'intro', text: 'Intro' },
    { id: 'second-part', text: 'Second part' },
    { id: 'third', text: 'Third' },
  ]);
  assert.match(out, /<h2 id="intro">Intro<\/h2>/);
  assert.match(out, /<h2 id="second-part">Second <a href="\/x">part<\/a><\/h2>/);
  assert.match(out, /<h2 id="third" class="k">Third<\/h2>/);
  assert.match(out, /<h3>Not listed<\/h3>/);
});

test('railToc de-duplicates ids, including ones that exist elsewhere in the body', () => {
  const { items } = railToc('<div id="sources"></div><h2>Sources</h2><h2>Same</h2><h2>Same</h2>');
  assert.deepEqual(
    items.map((i) => i.id),
    ['sources-2', 'same', 'same-2'],
  );
});

test('railToc skips an empty heading and a page without headings has no items', () => {
  assert.deepEqual(railToc('<h2> </h2><p>no headings</p>').items, []);
  assert.equal(railToc('<p>plain</p>').html, '<p>plain</p>');
});

test('hasFrameBlocks tells a body of running text from one that needs the frame', async () => {
  const { hasFrameBlocks } = await import('../../../src/lib/rail-toc.ts');
  assert.equal(hasFrameBlocks('<h2>Title</h2><p class="lead">Text</p><aside class="callout"><p>Note</p></aside><figure class="composition"></figure>'), false);
  assert.equal(hasFrameBlocks('<div class="grid grid--min-16"></div>'), true);
  assert.equal(hasFrameBlocks('<div class="stack split hww"></div>'), true);
  assert.equal(hasFrameBlocks('<div class="table-wrap"><TABLE></TABLE></div>'), true);
  assert.equal(hasFrameBlocks('<p class="gridlike">a class that only contains a name</p>'), false);
});
