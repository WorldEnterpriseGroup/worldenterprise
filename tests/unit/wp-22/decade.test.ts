import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { findDenied, PRICE } from '../../../src/components/visuals/contracts.ts';
import {
  DECADE_CHAPTERS,
  DECADE_DURATION,
  DECADE_FPS,
  DECADE_SIZE,
  DECADE_TITLE,
  SURVIVAL_POINTS,
  chapterSources,
  chapterStat,
  cueText,
  decadeMilestones,
  decadeSources,
  decadeVtt,
  durationLabel,
  isoDuration,
  litAt,
  vttTime,
} from '../../../src/components/media/decade.ts';
import { stat } from '../../../src/data/sales/stats.ts';

// WP-22 (#88): the storyboard of "A company's first decade, in one minute" drives the film, its captions, its transcript, the
// milestone carousel and the gallery. These tests pin the brief: 30 to 60 seconds, 1920x1080, register figures only, copy rules.

const root = new URL('../../../', import.meta.url);

test('the film runs 30 to 60 seconds at 1920x1080', () => {
  assert.ok(DECADE_DURATION >= 30 && DECADE_DURATION <= 60, `duration ${DECADE_DURATION}`);
  assert.deepEqual({ ...DECADE_SIZE }, { width: 1920, height: 1080 });
  assert.ok(Number.isInteger(DECADE_FPS * DECADE_DURATION));
});

test('chapters are contiguous, ordered and cover the whole film', () => {
  assert.equal(DECADE_CHAPTERS[0]?.start, 0);
  assert.equal(DECADE_CHAPTERS.at(-1)?.end, DECADE_DURATION);
  const ids = new Set<string>();
  DECADE_CHAPTERS.forEach((c, i) => {
    assert.ok(c.end > c.start, `${c.id} has a positive length`);
    if (i > 0) assert.equal(c.start, DECADE_CHAPTERS[i - 1]?.end, `${c.id} starts where the previous chapter ends`);
    assert.ok(!ids.has(c.id), `${c.id} is unique`);
    ids.add(c.id);
    assert.ok(c.year >= 0 && c.year <= 10, `${c.id} sits on the ten-year clock`);
  });
  const years = DECADE_CHAPTERS.map((c) => c.year);
  assert.deepEqual(years, [...years].sort((a, b) => a - b), 'the clock only moves forward');
});

test('the film tells incubation, launch and growth in that order', () => {
  const stages = DECADE_CHAPTERS.map((c) => c.stage).filter((s, i, all) => all.indexOf(s) === i);
  assert.deepEqual(stages, ['title', 'incubation', 'launch', 'growth', 'close']);
});

test('every figure comes from the statistics register, with at least one source', () => {
  const milestones = decadeMilestones();
  assert.equal(milestones.length, 7);
  for (const chapter of milestones) {
    const figure = chapterStat(chapter);
    assert.ok(figure !== undefined, chapter.id);
    assert.ok(chapterSources(chapter).length > 0, `${chapter.id} cites a source`);
    // The film's own wording of the figure quotes the register value.
    const value = figure.value.replace(/ months$/, '');
    assert.ok(chapter.statText?.includes(value), `${chapter.id} quotes ${figure.value}`);
  }
  for (const point of SURVIVAL_POINTS) assert.equal(`${point.percent}%`, stat(point.stat).value);
  assert.ok(decadeSources().every((s) => s.url.startsWith('https://')));
});

test('the ring of lights is data at years 1, 5 and 10 and only interpolated between them', () => {
  assert.equal(litAt(0), 100);
  assert.equal(litAt(1), 78);
  assert.equal(litAt(5), 51);
  assert.equal(litAt(10), 35);
  assert.equal(litAt(12), 35);
  assert.ok(litAt(3) < litAt(1) && litAt(3) > litAt(5));
});

test('every string the film, captions, transcript and gallery show passes the copy rules', () => {
  const strings = [
    DECADE_TITLE,
    ...DECADE_CHAPTERS.flatMap((c) => [c.title, c.line, c.when, c.picture, c.statText ?? '', c.still?.alt ?? '', c.still?.caption ?? '']),
    decadeVtt(),
  ];
  for (const text of strings) {
    assert.equal(findDenied(text), null, text);
    assert.ok(!PRICE.test(text), `no price: ${text}`);
    assert.ok(!/\b20\+\s*years\b|\btwo decades\b/i.test(text), `claims C-11: ${text}`);
    assert.ok(!/\binvestor\b|\baccelerat/i.test(text), `positioning: ${text}`);
  }
  assert.ok(DECADE_CHAPTERS.some((c) => c.title === 'WE build worlds.'));
});

test('stills have alt text and captions; the title and closing cards have none', () => {
  for (const c of DECADE_CHAPTERS) {
    if (c.stat === undefined) assert.equal(c.still, undefined, c.id);
    else {
      assert.ok((c.still?.alt.length ?? 0) > 20, `${c.id} alt`);
      assert.ok((c.still?.caption.length ?? 0) > 20, `${c.id} caption`);
    }
  }
});

test('WebVTT helpers format times and cues', () => {
  assert.equal(vttTime(0), '00:00.000');
  assert.equal(vttTime(14.8), '00:14.800');
  assert.equal(vttTime(3725.5), '01:02:05.500');
  assert.equal(durationLabel(57), '0:57');
  assert.equal(durationLabel(65), '1:05');
  assert.equal(isoDuration(57), 'PT57S');
  const first = DECADE_CHAPTERS[0];
  assert.ok(first !== undefined);
  assert.equal(cueText(first)[0], '[No sound. The on-screen text follows.]');
});

test('the committed captions file is exactly what the storyboard generates, and is valid WebVTT', () => {
  const file = readFileSync(new URL('src/assets/video/decade.en.vtt', root), 'utf8');
  assert.equal(file, decadeVtt(), 'regenerate with: node src/assets/video/tools/render-decade.mjs vtt');
  assert.ok(file.startsWith('WEBVTT\n'));
  const cues = [...file.matchAll(/^(\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}\.\d{3})$/gm)];
  assert.equal(cues.length, DECADE_CHAPTERS.filter((c) => cueText(c).length > 1).length + DECADE_CHAPTERS.length);
  const seconds = (t: string): number => {
    const [m, s] = t.split(':');
    return Number(m) * 60 + Number(s);
  };
  let previous = 0;
  for (const [, from, to] of cues) {
    assert.ok(from !== undefined && to !== undefined);
    assert.ok(seconds(to) > seconds(from), `${from} --> ${to}`);
    assert.ok(seconds(from) >= previous - 1e-9, 'cues are in order');
    previous = seconds(to);
  }
  assert.equal(previous, DECADE_DURATION, 'the last cue ends with the film');
});
