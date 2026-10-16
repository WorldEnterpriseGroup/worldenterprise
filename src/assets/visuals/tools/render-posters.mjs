#!/usr/bin/env node
/**
 * Regenerates the scene posters in src/assets/visuals/posters/ from the scenes themselves, so a poster is exactly the frame the live
 * scene starts its crossfade from. A developer tool: it is not part of the build and never runs in CI.
 *
 *   node src/assets/visuals/tools/render-posters.mjs            # every poster
 *   node src/assets/visuals/tools/render-posters.mjs galaxy launch
 *
 * How: esbuild bundles the scene modules with three into one script, headless Chromium (SwiftShader, so no GPU is needed) renders each
 * scene once at its `posterTime` through three's WebGPURenderer on its WebGL2 backend (the same node materials the live scene runs),
 * at a pixel ratio of 2 over the frame color the Scene component paints, and sharp encodes a 3840-wide AVIF master (quality 56, 4:4:4).
 * Point sizes are CSS pixels, so the frame is the same picture as at 1920, only sharper. Astro derives the 640/1024/1440/1920/2560/3840
 * srcset from the master at build time.
 *
 * Needs the dev dependencies (three, esbuild, playwright-core, sharp) and a Chromium: the Playwright one by default, or set
 * CHROMIUM_PATH.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const OUT = join(ROOT, 'src/assets/visuals/posters');
/** Master resolution: CSS width x RATIO pixels (1920 x 2 = 3840, the 4K candidate). */
const RATIO = 2;

/** Every poster the components reference (src/components/visuals/poster.ts POSTER_KEYS), with the scene options it shows. */
const POSTERS = [
  { key: 'galaxy', scene: 'galaxy', width: 1920, height: 1080, options: {} },
  { key: 'galaxy-end', scene: 'galaxy', width: 1920, height: 1080, options: { align: 'end' } },
  { key: 'launch', scene: 'launch', width: 1920, height: 1080, options: { waypoints: 6 } },
  { key: 'orbit-7-single', scene: 'orbit', width: 1920, height: 1080, options: { count: 7, rings: 'single' } },
  { key: 'orbit-10-nested', scene: 'orbit', width: 1920, height: 1080, options: { count: 10, rings: 'nested' } },
  { key: 'orbit-base', scene: 'orbit', width: 1920, height: 1080, options: { count: 0 } },
  { key: 'worldforge', scene: 'worldforge', width: 1920, height: 1080, options: { moons: 7 } },
  { key: 'starfield', scene: 'starfield', width: 1920, height: 640, options: {} },
  { key: 'accretion', scene: 'accretion', width: 1920, height: 1080, options: {} },
  { key: 'accretion-end', scene: 'accretion', width: 1920, height: 1080, options: { align: 'end' } },
];

/** The browser-side renderer: builds a scene, advances it to its poster time, composites it over the frame color, returns a PNG. */
const ENTRY = `
import { PerspectiveCamera, Scene, WebGPURenderer } from 'three/webgpu';
import * as galaxy from './src/scripts/visuals/scenes/galaxy.ts';
import * as launch from './src/scripts/visuals/scenes/launch.ts';
import * as orbit from './src/scripts/visuals/scenes/orbit.ts';
import * as worldforge from './src/scripts/visuals/scenes/worldforge.ts';
import * as starfield from './src/scripts/visuals/scenes/starfield.ts';
import * as accretion from './src/scripts/visuals/scenes/accretion.ts';
const MODS = { galaxy, launch, orbit, worldforge, starfield, accretion };
window.renderPoster = async (name, w, h, options, background, ratio) => {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: true, depth: true, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: true });
  const renderer = new WebGPURenderer({ canvas, antialias: true, alpha: true, forceWebGL: true, context: gl });
  await renderer.init();
  renderer.setPixelRatio(ratio);
  renderer.setSize(w, h, false);
  renderer.setClearColor(0x000000, 0);
  const scene = new Scene();
  const camera = new PerspectiveCamera(40, w / h, 0.05, 200);
  const instance = MODS[name].create({ renderer, scene, camera, options, aspect: w / h, quality: 1 });
  instance.update(instance.posterTime, 0);
  await renderer.compileAsync(scene, camera);
  renderer.render(scene, camera);
  const out = document.createElement('canvas');
  out.width = w * ratio;
  out.height = h * ratio;
  const ctx = out.getContext('2d');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(canvas, 0, 0);
  const png = out.toDataURL('image/png');
  instance.dispose();
  renderer.dispose();
  return png;
};
`;

/** The frame color, resolved by the browser from the same tokens and color-mix() the Scene component uses. */
const FRAME_PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
:root { --we-blue-night: oklch(31.86% 0.0797 249.9); --we-charcoal: oklch(24.42% 0.0064 0.6); }
#frame { background-color: color-mix(in oklab, var(--we-blue-night) 45%, var(--we-charcoal)); }
</style></head><body><div id="frame"></div></body></html>`;

async function main() {
  const wanted = process.argv.slice(2);
  const unknown = wanted.filter((k) => !POSTERS.some((p) => p.key === k));
  if (unknown.length > 0) throw new Error(`unknown poster(s): ${unknown.join(', ')}; known: ${POSTERS.map((p) => p.key).join(', ')}`);
  const jobs = wanted.length > 0 ? POSTERS.filter((p) => wanted.includes(p.key)) : POSTERS;

  const [{ build }, { chromium }, { default: sharp }] = await Promise.all([import('esbuild'), import('playwright-core'), import('sharp')]);

  const work = mkdtempSync(join(tmpdir(), 'we-posters-'));
  try {
    const result = await build({ stdin: { contents: ENTRY, resolveDir: ROOT, loader: 'js' }, bundle: true, format: 'iife', write: false, logLevel: 'warning' });
    const bundle = result.outputFiles[0]?.text;
    if (bundle === undefined) throw new Error('esbuild produced no output');

    const browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    });
    try {
      const page = await browser.newPage();
      page.on('pageerror', (error) => console.error('[page error]', error.message));
      await page.setContent(FRAME_PAGE);
      await page.addScriptTag({ content: bundle });
      const background = await page.evaluate(() => getComputedStyle(document.getElementById('frame')).backgroundColor);

      for (const job of jobs) {
        const dataUrl = await page.evaluate(([n, w, h, o, bg, r]) => window.renderPoster(n, w, h, o, bg, r), [job.scene, job.width, job.height, job.options, background, RATIO]);
        const png = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
        const pngPath = join(work, `${job.key}.png`);
        writeFileSync(pngPath, png);
        const info = await sharp(pngPath).avif({ quality: 56, effort: 7, chromaSubsampling: '4:4:4' }).toFile(join(OUT, `${job.key}.avif`));
        console.log(`${job.key}: ${info.width}x${info.height}, ${(info.size / 1024).toFixed(0)} KB`);
      }
    } finally {
      await browser.close();
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('render-posters:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
