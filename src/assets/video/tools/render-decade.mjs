#!/usr/bin/env node
/**
 * Renders "A company's first decade, in one minute" (WP-22, #88) from its storyboard (src/components/media/decade.ts) and writes every
 * derived file. A developer tool, reproducible from the repository: it is not part of the build and never runs in CI.
 *
 *   node src/assets/video/tools/render-decade.mjs                 # everything
 *   node src/assets/video/tools/render-decade.mjs vtt poster      # only some outputs: vtt, poster, stills, video
 *
 * Outputs:
 *   src/assets/video/decade.webm        AV1 (SVT-AV1, 10-bit 4:2:0), 1920x1080, 30 fps, silent
 *   src/assets/video/decade.mp4         H.264 High, 8-bit 4:2:0, the fallback for browsers without AV1 decoding
 *   src/assets/video/decade.en.vtt      WebVTT captions (from decadeVtt())
 *   src/assets/video/decade-poster.avif 3840x2160 poster master (the title over the year 5 world)
 *   src/assets/media/decade/<id>.avif   2560x1440 gallery stills, one per chapter with a figure, without on-screen text
 *
 * How: headless Chromium (Playwright's, or CHROMIUM_PATH) draws each frame with canvas 2D (decade-scene.js), a pure function of time
 * with seeded randomness; PNG frames stream into two ffmpeg encoders at once; sharp encodes the AVIF masters. Needs ffmpeg with
 * libsvtav1 and libx264 on PATH (or FFMPEG_PATH). Encoder settings are pinned below so a re-render is comparable in size.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import {
  DECADE_CHAPTERS,
  DECADE_DURATION,
  DECADE_FPS,
  DECADE_SIZE,
  SURVIVAL_POINTS,
  chapterSources,
  chapterStat,
  decadeSources,
  decadeVtt,
} from '../../../components/media/decade.ts';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const VIDEO_DIR = join(ROOT, 'src/assets/video');
const STILL_DIR = join(ROOT, 'src/assets/media/decade');
const FFMPEG = process.env.FFMPEG_PATH ?? 'ffmpeg';

/** Pinned encoder settings. Both files must stay at or under 4 MB (tests/unit/wp-22/media-files.test.ts). */
const ENCODERS = [
  {
    file: 'decade.webm',
    args: ['-c:v', 'libsvtav1', '-preset', '4', '-crf', '40', '-g', '240', '-pix_fmt', 'yuv420p10le', '-svtav1-params', 'tune=0'],
  },
  {
    file: 'decade.mp4',
    args: ['-c:v', 'libx264', '-preset', 'veryslow', '-crf', '25', '-tune', 'animation', '-profile:v', 'high', '-level', '4.1', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'],
  },
];
const POSTER = { time: 38.5, width: 3840, height: 2160, chapter: 'title', file: 'decade-poster.avif' };
const STILL = { width: 2560, height: 1440, before: 1.2 };

/** The storyboard, reduced to what the frame renderer reads. */
function sceneData() {
  const stats = {};
  for (const chapter of DECADE_CHAPTERS) {
    const s = chapterStat(chapter);
    if (s === undefined) continue;
    stats[chapter.id] = {
      value: s.value,
      text: s.label,
      source: chapterSources(chapter)
        .map((src) => src.short)
        .join('; '),
    };
  }
  return {
    chapters: DECADE_CHAPTERS.map(({ id, start, end, stage, year, when, title, line }) => ({ id, start, end, stage, year, when, title, line })),
    stats,
    survival: SURVIVAL_POINTS.map(({ year, percent }) => ({ year, percent })),
    sources: decadeSources().map((s) => s.short),
  };
}

async function openRenderer() {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await page.setContent('<!doctype html><html><body><canvas id="c"></canvas></body></html>');
  const fonts = ['600', '700'].map((weight) => ({
    weight,
    data: readFileSync(join(ROOT, `src/assets/fonts/titillium-web-latin-${weight}-normal.woff2`)).toString('base64'),
  }));
  await page.evaluate(async (list) => {
    for (const f of list) {
      const bytes = Uint8Array.from(atob(f.data), (ch) => ch.charCodeAt(0));
      const face = new FontFace('Titillium Web', bytes.buffer, { weight: f.weight });
      await face.load();
      document.fonts.add(face);
    }
  }, fonts);
  await page.addScriptTag({ content: readFileSync(join(ROOT, 'src/assets/video/tools/decade-scene.js'), 'utf8') });
  const data = sceneData();
  /** One frame as PNG bytes. */
  const frame = async (t, width, height, opts = {}) => {
    const b64 = await page.evaluate(
      ({ t, width, height, data, opts }) => {
        const canvas = document.getElementById('c');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        window.drawDecade(ctx, t, data, opts);
        return canvas.toDataURL('image/png').slice('data:image/png;base64,'.length);
      },
      { t, width, height, data, opts },
    );
    return Buffer.from(b64, 'base64');
  };
  return { browser, frame };
}

function encoder(file, args) {
  const out = join(VIDEO_DIR, file);
  const child = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(DECADE_FPS), '-c:v', 'png', '-i', '-', ...args, '-an', out], {
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  const done = new Promise((resolve, reject) => {
    child.on('error', (error) => reject(new Error(`ffmpeg could not start for ${file}: ${error.message}`)));
    child.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`ffmpeg exited with ${code} while encoding ${file}`))));
  });
  return { child, done, file };
}

function write(stream, buffer) {
  return new Promise((resolve, reject) => {
    if (stream.write(buffer)) {
      resolve();
      return;
    }
    const onError = (error) => {
      stream.off('drain', onDrain);
      reject(new Error(`ffmpeg input closed early: ${error.message}`));
    };
    const onDrain = () => {
      stream.off('error', onError);
      resolve();
    };
    stream.once('drain', onDrain);
    stream.once('error', onError);
  });
}

async function renderVideo(frame) {
  mkdirSync(VIDEO_DIR, { recursive: true });
  const encoders = ENCODERS.map((e) => encoder(e.file, e.args));
  const total = Math.round(DECADE_DURATION * DECADE_FPS);
  for (let i = 0; i < total; i += 1) {
    const png = await frame(i / DECADE_FPS, DECADE_SIZE.width, DECADE_SIZE.height);
    await Promise.all(encoders.map((e) => write(e.child.stdin, png)));
    if (i % 150 === 0) console.log(`video: frame ${i} of ${total}`);
  }
  for (const e of encoders) e.child.stdin.end();
  for (const path of await Promise.all(encoders.map((e) => e.done))) console.log(`video: ${path} ${(statSync(path).size / 1024).toFixed(0)} KB`);
}

async function renderPoster(frame) {
  const png = await frame(POSTER.time, POSTER.width, POSTER.height, { chapterOverride: POSTER.chapter });
  const out = join(VIDEO_DIR, POSTER.file);
  await sharp(png).avif({ quality: 52, effort: 6, chromaSubsampling: '4:2:0' }).toFile(out);
  console.log(`poster: ${out} ${(statSync(out).size / 1024).toFixed(0)} KB`);
}

async function renderStills(frame) {
  mkdirSync(STILL_DIR, { recursive: true });
  for (const chapter of DECADE_CHAPTERS.filter((c) => c.still !== undefined)) {
    const png = await frame(chapter.end - STILL.before, STILL.width, STILL.height, { text: false });
    const out = join(STILL_DIR, `${chapter.id}.avif`);
    await sharp(png).avif({ quality: 55, effort: 6, chromaSubsampling: '4:2:0' }).toFile(out);
    console.log(`still: ${out} ${(statSync(out).size / 1024).toFixed(0)} KB`);
  }
}

function renderVtt() {
  const out = join(VIDEO_DIR, 'decade.en.vtt');
  writeFileSync(out, decadeVtt());
  console.log(`captions: ${out}`);
}

const wanted = new Set(process.argv.slice(2));
const want = (name) => wanted.size === 0 || wanted.has(name);
try {
  if (want('vtt')) renderVtt();
  if (want('poster') || want('stills') || want('video')) {
    const { browser, frame } = await openRenderer();
    try {
      if (want('poster')) await renderPoster(frame);
      if (want('stills')) await renderStills(frame);
      if (want('video')) await renderVideo(frame);
    } finally {
      await browser.close();
    }
  }
} catch (error) {
  console.error(`render-decade: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
