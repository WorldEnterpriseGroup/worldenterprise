/**
 * Which CSS chunks Astro inlines into the page and which stay a render-blocking <link> (vite build.assetsInlineLimit, used by
 * Astro's `build.inlineStylesheets: 'auto'`).
 *
 * Why this exists (WP-32, home LCP at the 2,500 ms budget): Astro 7 decides per chunk in
 * node_modules/astro/dist/core/build/plugins/plugin-css.js (astro:rollup-plugin-inline-stylesheets) through shouldInlineAsset() in
 * node_modules/astro/dist/core/build/plugins/util.js. When assetsInlineLimit is a function that returns undefined, the chunk is
 * inlined only if Buffer.byteLength(source) < 4096, measured on the raw minified CSS. The per-component chunks Lighthouse reported at
 * 1 to 2.5 KB are gzip transfer sizes; on disk they are 4.4 to 13 KB, so every one of them missed the 4 KiB default and shipped as
 * its own render-blocking stylesheet (five on the home page).
 *
 * The rule now:
 * - The shared base chunk (everything src/layouts/BaseLayout.astro imports, on every page) stays one external file, so the browser
 *   downloads it once and caches it for the whole site.
 * - Every other stylesheet chunk is page or component CSS and is inlined, so a page has exactly one render-blocking request.
 * - A ceiling keeps an unexpectedly large chunk external rather than copying it into every HTML file that uses it.
 *
 * Inlined blocks are covered by the CSP: Astro's `security.csp` hashes every <style> it emits into style-src-elem, and
 * scripts/audit-csp.mjs fails the build output when a block is missing its hash. Nothing becomes a data: URI: every non-CSS asset
 * returns false (never inline), because img-src and font-src grant only 'self'.
 */

/** The shared base chunk: Vite names it after src/layouts/BaseLayout.astro, the first module that imports it. */
export const BASE_STYLESHEET = /(?:^|\/)BaseLayout\.[\w-]+\.css$/;

/** Raw bytes above which a non-base chunk stays external (about 6 to 7 KB gzip). The largest page chunk today is under 27 KB. */
export const INLINE_CSS_CEILING = 32 * 1024;

/**
 * vite build.assetsInlineLimit. Returns true to inline, false to keep the file. It never returns undefined, so Astro's 4 KiB
 * fallback never applies.
 */
export function inlineAssetLimit(file: string, content: Buffer): boolean {
  if (!file.endsWith('.css')) return false;
  if (BASE_STYLESHEET.test(file)) return false;
  return content.byteLength <= INLINE_CSS_CEILING;
}
